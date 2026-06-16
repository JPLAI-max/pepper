import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetProfileQueryKey,
  getGetRoadmapQueryKey,
} from "@workspace/api-client-react";
import { usePepper } from "@/pepper";

/**
 * The "Hey Pep" dashboard overlay assistant.
 *
 * The orb (FAB), backdrop, panel, and animations are ported verbatim from the
 * provided design source — only the demo intent-handling has been replaced with
 * the real coach (Mode B) wiring. The THEME token system is kept intact (the
 * `THEMES` object below); the demo theme switcher is removed and the "ember"
 * palette is applied. All colors come from the tokens — none are hardcoded.
 *
 * Note on scoping: the source declared its CSS variables on `:root`/`body`. To
 * avoid bleeding into the host app's global tokens, the variables are applied to
 * the overlay's own root element and every selector is scoped under `.heypep`.
 * The variable names and values are kept exactly as written in the source.
 */

const THEMES: Record<
  string,
  {
    "--bg": string;
    "--surface": string;
    "--card": string;
    "--line": string;
    "--ink": string;
    "--muted": string;
    "--accent": string;
    "--glow": string;
    "--orb-hi": string;
    "--orb-1": string;
    "--orb-2": string;
    "--orb-3": string;
    "--orb-4": string;
  }
> = {
  ember: {
    "--bg": "#0B0F14",
    "--surface": "#121821",
    "--card": "#1A222D",
    "--line": "rgba(255,255,255,0.08)",
    "--ink": "#F4EFE9",
    "--muted": "#9AA6B2",
    "--accent": "#E85D3F",
    "--glow": "rgba(232,93,63,0.45)",
    "--orb-hi": "#FFD9A0",
    "--orb-1": "#F4A259",
    "--orb-2": "#E85D3F",
    "--orb-3": "#C0392B",
    "--orb-4": "#7A1F14",
  },
  sage: {
    "--bg": "#0C1310",
    "--surface": "#121C17",
    "--card": "#19261F",
    "--line": "rgba(255,255,255,0.08)",
    "--ink": "#EDF3EE",
    "--muted": "#9DB0A4",
    "--accent": "#3FA37D",
    "--glow": "rgba(63,163,125,0.45)",
    "--orb-hi": "#CFF5E2",
    "--orb-1": "#7FD8B0",
    "--orb-2": "#3FA37D",
    "--orb-3": "#2A7B5C",
    "--orb-4": "#164936",
  },
  ocean: {
    "--bg": "#0A0F16",
    "--surface": "#101824",
    "--card": "#162130",
    "--line": "rgba(255,255,255,0.08)",
    "--ink": "#EAF1F8",
    "--muted": "#93A4B7",
    "--accent": "#3F7DE8",
    "--glow": "rgba(63,125,232,0.45)",
    "--orb-hi": "#BFE0FF",
    "--orb-1": "#6FA8F4",
    "--orb-2": "#3F7DE8",
    "--orb-3": "#2A57C0",
    "--orb-4": "#13306E",
  },
  rose: {
    "--bg": "#140B10",
    "--surface": "#1E1218",
    "--card": "#2A1A22",
    "--line": "rgba(255,255,255,0.08)",
    "--ink": "#F8EEF3",
    "--muted": "#B79AA6",
    "--accent": "#E85D8B",
    "--glow": "rgba(232,93,139,0.45)",
    "--orb-hi": "#FFD0E2",
    "--orb-1": "#F48FB1",
    "--orb-2": "#E85D8B",
    "--orb-3": "#C0395F",
    "--orb-4": "#7A142F",
  },
};

const OVERLAY_CSS = `
.heypep .fab{position:fixed;right:20px;bottom:calc(20px + env(safe-area-inset-bottom));width:64px;height:64px;border-radius:50%;border:none;cursor:pointer;z-index:30;background:radial-gradient(circle at 36% 30%,var(--orb-hi),var(--orb-1) 18%,var(--orb-2) 48%,var(--orb-3) 78%,var(--orb-4));box-shadow:0 8px 30px var(--glow);animation:heypep-breathe 6s ease-in-out infinite}
.heypep .fab:active{transform:scale(.95)}
@keyframes heypep-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.heypep .backdrop{position:fixed;inset:0;background:color-mix(in srgb,var(--bg) 78%,transparent);backdrop-filter:blur(2px);z-index:40;opacity:0;pointer-events:none;transition:opacity .3s ease}
.heypep.open .backdrop{opacity:1;pointer-events:auto}
.heypep .panel{position:fixed;left:50%;bottom:0;transform:translate(-50%,100%);width:min(560px,100%);z-index:50;background:var(--surface);border:1px solid var(--line);border-bottom:none;border-radius:24px 24px 0 0;padding:22px 20px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -20px 60px rgba(0,0,0,.45);transition:transform .35s cubic-bezier(.2,.8,.2,1);color:var(--ink);font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.heypep.open .panel{transform:translate(-50%,0)}
.heypep .panel-head{display:flex;align-items:center;gap:14px;margin-bottom:16px}
.heypep .p-orb{position:relative;width:44px;height:44px;border-radius:50%;overflow:hidden;flex:none;background:radial-gradient(circle at 36% 30%,var(--orb-hi),var(--orb-1) 18%,var(--orb-2) 48%,var(--orb-3) 78%,var(--orb-4));box-shadow:0 0 18px var(--glow);animation:heypep-breathe 6s ease-in-out infinite}
.heypep .p-orb.listening{animation-duration:2.4s}
.heypep .title{font-weight:600;line-height:1.2}
.heypep .title small{display:block;color:var(--muted);font-weight:400;font-size:.8rem;margin-top:2px}
.heypep .close-x{margin-left:auto;background:none;border:none;color:var(--muted);font-size:1.5rem;cursor:pointer;line-height:1;padding:2px 6px}
.heypep .close-x:hover{color:var(--ink)}
.heypep .thread{max-height:34vh;overflow-y:auto;display:flex;flex-direction:column;gap:10px;margin-bottom:14px;padding-right:4px}
.heypep .msg{max-width:86%;padding:11px 14px;border-radius:16px;font-size:.95rem;line-height:1.45;white-space:pre-wrap}
.heypep .msg.pep{align-self:flex-start;background:var(--card);border:1px solid var(--line)}
.heypep .msg.you{align-self:flex-end;background:color-mix(in srgb,var(--accent) 20%,transparent);border:1px solid color-mix(in srgb,var(--accent) 30%,transparent)}
.heypep .quick{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.heypep .quick button{font-size:.8rem;color:var(--muted);background:transparent;border:1px solid var(--line);border-radius:999px;padding:7px 13px;cursor:pointer}
.heypep .quick button:hover{color:var(--ink);border-color:color-mix(in srgb,var(--accent) 45%,transparent)}
.heypep .inbar{display:flex;align-items:center;gap:9px;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:7px}
.heypep .ic{flex:none;width:42px;height:42px;border-radius:50%;border:none;cursor:pointer;display:grid;place-items:center}
.heypep .ic:disabled{opacity:.5;cursor:default}
.heypep .ic.mic{background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent)}
.heypep .ic.mic.on{background:var(--accent);color:#fff}
.heypep .ic.send{background:var(--accent);color:#fff}
.heypep .inbar input{flex:1;background:none;border:none;outline:none;color:var(--ink);font-size:1rem;padding:0 4px}
.heypep .inbar input::placeholder{color:var(--muted)}
@media(min-width:600px){.heypep .panel{bottom:24px;border-radius:24px;border-bottom:1px solid var(--line)}}
`;

const MicIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const SECTION_LABELS: Record<string, string> = {
  "/dashboard": "Command Center",
  "/goals": "Goals",
  "/roadmap": "Roadmap",
  "/readiness": "Readiness",
  "/opportunities": "Opportunities",
  "/documents": "Documents",
};

const AFFIRMATIVE =
  /\b(yes|yep|yeah|yup|correct|confirm|confirmed|do it|go ahead|sounds? (good|right)|that'?s right|save( it)?|sure|right|ok(ay)?)\b/i;
const NEGATIVE =
  /\b(no|nope|nah|cancel|don'?t|do not|wrong|nevermind|never mind|not right|that'?s wrong)\b/i;
// A stated dollar figure / number to set, e.g. "9000", "$9,000", "1200".
const HAS_VALUE = /\$?\s?\d[\d,]{1,}(?:\.\d+)?/;

export function HeyPepOverlay() {
  const {
    open,
    setOpen,
    messages,
    status,
    busy,
    sendText,
    dictateStart,
    dictateStop,
    dictating,
  } = usePepper();

  const [location] = useLocation();
  const queryClient = useQueryClient();
  const rootRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  // True once the user has proposed a value the coach is asking them to confirm.
  const pendingFillRef = useRef(false);

  const section = SECTION_LABELS[location] ?? "the dashboard";

  // Apply the (ember) theme tokens onto the overlay root. THEMES is kept whole
  // so the palette can be swapped later without touching markup or CSS.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const theme = THEMES.ember;
    for (const [key, value] of Object.entries(theme)) {
      el.style.setProperty(key, value);
    }
  }, []);

  // Auto-scroll the thread as messages stream in.
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, status, open]);

  const handle = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");

    const affirmative = AFFIRMATIVE.test(t) && !NEGATIVE.test(t);
    const negative = NEGATIVE.test(t);
    const hasValue = HAS_VALUE.test(t);

    // Confirm-before-commit: only a "yes" to a pending value proposal commits.
    const commit = pendingFillRef.current && affirmative;

    await sendText(t, { mode: "overlay", section, commit });

    if (commit) {
      pendingFillRef.current = false;
      // The confirmed fill was persisted server-side (awaited before `done`);
      // refresh the views that depend on it.
      void queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetRoadmapQueryKey() });
      void queryClient.invalidateQueries();
    } else if (negative) {
      pendingFillRef.current = false;
    } else if (hasValue) {
      // A value was stated — the coach will ask the user to confirm it.
      pendingFillRef.current = true;
    }
  };

  const toggleMic = async () => {
    if (dictating) {
      const text = await dictateStop();
      if (text) await handle(text);
    } else {
      await dictateStart();
    }
  };

  const listening = dictating || status === "listening" || status === "thinking";

  const bubbles = useMemo(
    () => messages.filter((m) => m.content.trim().length > 0),
    [messages],
  );

  return (
    <div ref={rootRef} className={`heypep${open ? " open" : ""}`}>
      <style>{OVERLAY_CSS}</style>

      <button
        className="fab"
        aria-label="Open Pepper"
        onClick={() => setOpen(true)}
      />

      <div
        className="backdrop"
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />

      <div className="panel" role="dialog" aria-label="Pepper assistant" aria-modal="true">
        <div className="panel-head">
          <div className={`p-orb${listening ? " listening" : ""}`} />
          <div className="title">
            Pepper
            <small>Ask about anything on your screen</small>
          </div>
          <button className="close-x" aria-label="Close" onClick={() => setOpen(false)}>
            ×
          </button>
        </div>

        <div className="thread" ref={threadRef}>
          {bubbles.length === 0 && (
            <div className="msg pep">
              Hey — I'm right here. Ask me what anything on this screen means, or
              just tell me a number to update.
            </div>
          )}
          {bubbles.map((m) => (
            <div key={m.id} className={`msg ${m.role === "user" ? "you" : "pep"}`}>
              {m.content}
            </div>
          ))}
        </div>

        <div className="quick">
          <button onClick={() => handle("What does this screen mean?")} disabled={busy}>
            Explain this screen
          </button>
          <button onClick={() => handle("What should I do next?")} disabled={busy}>
            What's next?
          </button>
        </div>

        <div className="inbar">
          <button
            className={`ic mic${dictating ? " on" : ""}`}
            aria-label={dictating ? "Stop dictation" : "Speak"}
            onClick={toggleMic}
            disabled={busy && !dictating}
          >
            <MicIcon />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handle(input);
              }
            }}
            placeholder="Ask Pepper..."
            disabled={busy}
          />
          <button
            className="ic send"
            aria-label="Send"
            onClick={() => void handle(input)}
            disabled={!input.trim() || busy}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
