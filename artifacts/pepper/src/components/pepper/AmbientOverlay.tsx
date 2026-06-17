import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useGetProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/auth";
import { usePepper } from "@/pepper";

/**
 * The ambient "Hey Pep" layer.
 *
 * A self-contained, full-screen surface shown over the current route when the
 * wake word fires (or `openAmbient()` is called). It renders ONLY its own opaque
 * background and a large breathing orb — no input bar, chips, or route content.
 * It never changes the route or mounts a page, so dismissing it (Escape, tapping
 * the background, or saying / clicking "never mind") returns the user to exactly
 * where they were.
 *
 * Flow: open -> speak the greeting -> capture one spoken command -> send it to
 * the coach (Mode B, no commit — nothing is written) -> show + speak the reply.
 * Tapping the orb starts a fresh capture. Spoken replies use the browser Web
 * Speech API and can be muted with the on-screen toggle.
 *
 * Colors are the literal "ember" palette (matching HeyPepOverlay's tokens) so
 * this layer is visually consistent without depending on the app's shadcn
 * variables, which it must not clobber. All selectors and keyframes are scoped
 * under `.pep-ambient`.
 */

// Canonical screen names — must match the server-side `ALLOWED_SECTIONS`
// allowlist. Anything off this map sends no section and the server defaults.
const SECTION_BY_ROUTE: Record<string, string> = {
  "/dashboard": "dashboard",
  "/goals": "goals",
  "/roadmap": "roadmap",
  "/readiness": "readiness",
  "/opportunities": "opportunities",
  "/documents": "documents",
};

// "Never mind" / dismiss intent spoken into the ambient layer.
const DISMISS = /\b(never\s*mind|nevermind|cancel|forget it|that'?s all|nothing|go away|dismiss)\b/i;

const AMBIENT_CSS = `
.pep-ambient{position:fixed;inset:0;z-index:90;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;
background:radial-gradient(circle at 50% 38%,rgba(216,83,31,.18),transparent 60%),linear-gradient(#0b0908,#070605);
color:#f6ece1;font-family:'Outfit',system-ui,sans-serif;animation:pep-ambient-fade .3s ease}
@keyframes pep-ambient-fade{from{opacity:0}to{opacity:1}}
.pep-ambient .orb{width:200px;height:200px;border-radius:50%;border:none;cursor:pointer;flex:none;
background:radial-gradient(circle at 36% 30%,#ffe6bf,#ffb454 18%,#ff7e3f 48%,#d8531f 78%,#5e2410);
box-shadow:0 0 90px rgba(255,126,63,.5);animation:pep-ambient-breathe 6s ease-in-out infinite}
.pep-ambient .orb:active{transform:scale(.97)}
.pep-ambient .orb.active{animation-duration:2.4s}
@keyframes pep-ambient-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.pep-ambient .greeting{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:clamp(2.4rem,7vw,3.6rem);line-height:1.1;letter-spacing:.005em;margin:36px 0 6px;text-align:center}
.pep-ambient .sub{color:#a8978a;font-size:1.05rem;text-align:center;margin:0}
.pep-ambient .dots{display:flex;gap:9px;margin-top:26px;height:12px;align-items:center}
.pep-ambient .dots span{width:9px;height:9px;border-radius:50%;background:#ff7e3f;opacity:.35;animation:pep-ambient-dot 1.2s ease-in-out infinite}
.pep-ambient .dots span:nth-child(2){animation-delay:.2s}
.pep-ambient .dots span:nth-child(3){animation-delay:.4s}
@keyframes pep-ambient-dot{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
.pep-ambient .heard{margin-top:26px;max-width:640px;text-align:center;font-size:1.25rem;color:#f6ece1;min-height:1.4em}
.pep-ambient .reply{margin-top:18px;max-width:640px;text-align:center;font-size:1.1rem;line-height:1.5;color:#e8d9c8}
.pep-ambient .mute{position:fixed;top:calc(18px + env(safe-area-inset-top));right:20px;display:inline-flex;align-items:center;gap:8px;background:rgba(28,21,17,.65);border:1px solid rgba(255,180,120,.14);color:#f6ece1;border-radius:999px;padding:8px 14px;font-size:.85rem;cursor:pointer}
.pep-ambient .mute:hover{border-color:rgba(255,126,63,.45)}
.pep-ambient .nevermind{margin-top:40px;background:none;border:none;color:#a8978a;font-size:.95rem;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.pep-ambient .nevermind:hover{color:#f6ece1}
`;

const SpeakerOnIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);

const SpeakerOffIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);

export function AmbientOverlay() {
  const {
    ambient,
    closeAmbient,
    speak,
    cancelSpeech,
    captureCommand,
    speechMuted,
    setSpeechMuted,
    sendText,
  } = usePepper();

  const { isAuthenticated } = useAuth();
  // Only the signed-in user has a profile; gating avoids anonymous 401 polling.
  const { data: profile } = useGetProfile({
    query: { enabled: isAuthenticated, queryKey: getGetProfileQueryKey() },
  });
  const [location] = useLocation();

  const [phase, setPhase] = useState<"listening" | "thinking" | "answered">("listening");
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");

  const stopCaptureRef = useRef<() => void>(() => {});
  // Monotonic token per capture. A response only applies (shows + speaks) if its
  // token is still current; closing the layer or starting a new capture bumps it,
  // so a late-resolving sendText after dismissal never speaks a reply.
  const turnRef = useRef(0);
  // Latest sendText/section without re-running the open effect each keystroke.
  const sendTextRef = useRef(sendText);
  sendTextRef.current = sendText;
  const sectionRef = useRef<string | undefined>(SECTION_BY_ROUTE[location]);
  sectionRef.current = SECTION_BY_ROUTE[location];

  const firstName = (() => {
    const n = profile?.displayName?.trim();
    if (!n) return "there";
    return n.split(/\s+/)[0];
  })();
  const firstNameRef = useRef(firstName);
  firstNameRef.current = firstName;

  // Capture one spoken command, then send it to the coach and speak the reply.
  const startCapture = useCallback(() => {
    // New capture invalidates any in-flight response from a previous one.
    const myTurn = ++turnRef.current;
    setPhase("listening");
    setHeard("");
    setReply("");
    stopCaptureRef.current();
    stopCaptureRef.current = captureCommand({
      onInterim: (text) => setHeard(text),
      onFinal: (text) => {
        const t = text.trim();
        if (!t) return;
        if (DISMISS.test(t)) {
          closeAmbient();
          return;
        }
        setHeard(t);
        setPhase("thinking");
        void sendTextRef.current(t, {
          mode: "overlay",
          section: sectionRef.current,
        }).then((result) => {
          // Ignore if the layer was dismissed or a new capture started: never
          // speak or render a reply for a stale turn.
          if (myTurn !== turnRef.current) return;
          const answer = result.reply ?? "";
          setReply(answer);
          setPhase("answered");
          if (answer) speak(answer);
        });
      },
    });
  }, [captureCommand, closeAmbient, speak]);

  // On open: greet (spoken + shown), then start listening once the greeting
  // finishes. On close: stop capture and cancel any speech.
  useEffect(() => {
    if (!ambient) {
      // Invalidate any in-flight turn so a late reply can't speak after close.
      turnRef.current++;
      stopCaptureRef.current();
      stopCaptureRef.current = () => {};
      return;
    }
    setPhase("listening");
    setHeard("");
    setReply("");
    speak(`Hey ${firstNameRef.current}. How can I help?`, { onEnd: startCapture });
    return () => {
      turnRef.current++;
      stopCaptureRef.current();
      stopCaptureRef.current = () => {};
      cancelSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambient]);

  // Escape dismisses the layer.
  useEffect(() => {
    if (!ambient) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAmbient();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ambient, closeAmbient]);

  if (!ambient) return null;

  const stopBubble = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      className="pep-ambient"
      role="dialog"
      aria-label="Pepper voice assistant"
      onClick={closeAmbient}
    >
      <style>{AMBIENT_CSS}</style>

      <button
        type="button"
        className="mute"
        onClick={(e) => {
          stopBubble(e);
          setSpeechMuted(!speechMuted);
        }}
        aria-pressed={speechMuted}
      >
        {speechMuted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
        {speechMuted ? "Voice muted" : "Voice on"}
      </button>

      <button
        type="button"
        className={`orb${phase === "listening" ? " active" : ""}`}
        aria-label="Tap to speak again"
        onClick={(e) => {
          stopBubble(e);
          startCapture();
        }}
      />

      <h2 className="greeting">Hey {firstName}</h2>
      <p className="sub">How can I help?</p>

      {phase === "listening" && (
        <div className="dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}

      {heard && (
        <p className="heard" onClick={stopBubble}>
          {heard}
        </p>
      )}

      {reply && (
        <p className="reply" onClick={stopBubble}>
          {reply}
        </p>
      )}

      <button
        type="button"
        className="nevermind"
        onClick={(e) => {
          stopBubble(e);
          closeAmbient();
        }}
      >
        Never mind
      </button>
    </div>
  );
}
