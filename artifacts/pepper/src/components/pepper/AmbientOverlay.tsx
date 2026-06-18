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
.pep-ambient .thinking{margin-top:24px;color:#a8978a;font-size:1rem;letter-spacing:.02em;animation:pep-ambient-pulse 1.4s ease-in-out infinite}
@keyframes pep-ambient-pulse{0%,100%{opacity:.45}50%{opacity:1}}
.pep-ambient .hint{margin-top:28px;max-width:520px;text-align:center;font-size:.92rem;line-height:1.5;color:#a8978a}
.pep-ambient .askbar{margin-top:24px;display:flex;align-items:center;gap:8px;width:min(520px,92%);background:rgba(28,21,17,.65);border:1px solid rgba(255,180,120,.14);border-radius:999px;padding:8px 8px 8px 18px}
.pep-ambient .askbar:focus-within{border-color:rgba(255,126,63,.45)}
.pep-ambient .ask{flex:1;min-width:0;background:none;border:none;outline:none;color:#f6ece1;font-size:1rem;font-family:inherit}
.pep-ambient .ask::placeholder{color:#a8978a}
.pep-ambient .ask-send{flex:none;width:38px;height:38px;border-radius:50%;border:none;cursor:pointer;display:grid;place-items:center;background:#ff7e3f;color:#fff;transition:opacity .15s ease}
.pep-ambient .ask-send:disabled{opacity:.45;cursor:default}
`;

const SendIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

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
    speechRecognitionSupported,
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
  const [inputText, setInputText] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
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

  // Send one command (spoken OR typed) to the coach, then show + speak the reply.
  // Shared by voice capture and the typed fallback so both paths behave identically.
  const runCommand = useCallback(
    (raw: string) => {
      const t = raw.trim();
      if (!t) return;
      if (DISMISS.test(t)) {
        closeAmbient();
        return;
      }
      // New command invalidates any in-flight response from a previous one.
      const myTurn = ++turnRef.current;
      setHeard(t);
      setReply("");
      setPhase("thinking");
      void sendTextRef.current(t, {
        mode: "overlay",
        section: sectionRef.current,
      }).then((result) => {
        // Ignore if the layer was dismissed or a newer command started: never
        // speak or render a reply for a stale turn.
        if (myTurn !== turnRef.current) return;
        const answer = result.reply ?? "";
        setReply(answer);
        setPhase("answered");
        if (answer) speak(answer);
      });
    },
    [closeAmbient, speak],
  );

  // Capture one spoken command via SpeechRecognition. No-op when unsupported —
  // the typed fallback covers that case so the layer never dead-ends.
  const startCapture = useCallback(() => {
    if (!speechRecognitionSupported) return;
    // Invalidate any in-flight response while we re-listen.
    turnRef.current++;
    setPhase("listening");
    setHeard("");
    setReply("");
    stopCaptureRef.current();
    stopCaptureRef.current = captureCommand({
      onInterim: (text) => setHeard(text),
      onFinal: (text) => runCommand(text),
    });
  }, [captureCommand, runCommand, speechRecognitionSupported]);

  const submitTyped = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const v = inputText.trim();
      if (!v) return;
      setInputText("");
      runCommand(v);
    },
    [inputText, runCommand],
  );

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
    setInputText("");
    if (speechRecognitionSupported) {
      // Voice path: greet, then listen once the greeting finishes.
      speak(`Hey ${firstNameRef.current}. How can I help?`, { onEnd: startCapture });
    } else {
      // No SpeechRecognition (e.g. Firefox/Safari): never spin the listening
      // dots forever. Greet (TTS is independent and may still work), then hand
      // off to the always-present typed input.
      setPhase("answered");
      speak(`Hey ${firstNameRef.current}. How can I help?`);
      window.setTimeout(() => inputRef.current?.focus(), 60);
    }
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
        className={`orb${phase === "listening" && speechRecognitionSupported ? " active" : ""}`}
        aria-label={speechRecognitionSupported ? "Tap to speak again" : "Type your request below"}
        onClick={(e) => {
          stopBubble(e);
          if (speechRecognitionSupported) startCapture();
          else inputRef.current?.focus();
        }}
      />

      <h2 className="greeting">Hey {firstName}</h2>
      <p className="sub">How can I help?</p>

      {phase === "listening" && speechRecognitionSupported && (
        <div className="dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}

      {phase === "thinking" && (
        <p className="thinking" aria-live="polite">
          Thinking…
        </p>
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

      {!speechRecognitionSupported && (
        <p className="hint" onClick={stopBubble}>
          Voice input isn&apos;t available in this browser — type your request below.
        </p>
      )}

      <form className="askbar" onSubmit={submitTyped} onClick={stopBubble}>
        <input
          ref={inputRef}
          className="ask"
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type your request…"
          aria-label="Type your request"
        />
        <button type="submit" className="ask-send" aria-label="Send" disabled={!inputText.trim()}>
          <SendIcon />
        </button>
      </form>

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
