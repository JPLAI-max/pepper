import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetProfileQueryKey,
  getGetRoadmapQueryKey,
} from "@workspace/api-client-react";
import { usePepper } from "@/pepper";

/**
 * The "Hey Pep" overlay assistant.
 *
 * The orb (FAB), backdrop, sliding panel, markup, animations, and the `THEMES`
 * token object are ported VERBATIM from the provided design source. The ONLY
 * things changed from the source are:
 *   1. The demo intent-handling (`handle()`) is replaced with the real coach
 *      Mode B call (see PARTS 2-3) and a client confirm-gate.
 *   2. The demo dashboard scaffolding (`.dash`, cards, field-rows, themer) is
 *      not rendered — Pepper's real pages are the host content.
 *   3. Two integration-only adaptations (kept as small as possible):
 *      - The source declared its tokens on global `:root` and toggled a
 *        `body.overlay-open` class. Pepper's app already defines global tokens
 *        with the SAME names (`--card`, `--muted`, `--accent`, `--line`) via
 *        shadcn, so writing them on `:root` would clobber the rest of the app.
 *        The token values are therefore applied to THIS component's own root
 *        element and every selector is scoped under `.heypep` (with
 *        `body.overlay-open` -> `.heypep.open`). The variable names and values
 *        are exactly as written in the source.
 *      - The `@keyframes breathe` is namespaced to `heypep-breathe` (the
 *        injected <style> is global; the animation itself is unchanged).
 *
 * Pepper ships locked to "ember"; the full multi-theme `THEMES` object is kept
 * intact so the realtor product can expose the switcher later. No color is
 * hardcoded — everything reads from the tokens.
 */

type ThemeTokens = {
  "--bg": string;
  "--surface": string;
  "--card": string;
  "--accent": string;
  "--accent-foreground": string;
  "--ink": string;
  "--muted": string;
  "--line": string;
  "--orb-hi": string;
  "--orb-1": string;
  "--orb-2": string;
  "--orb-3": string;
  "--orb-4": string;
  "--glow": string;
  swatch: string;
};

// THEME PRESETS (verbatim from source). Realtor product exposes this; Pepper
// locks to "ember".
const THEMES: Record<string, ThemeTokens> = {
  ember: {
    "--bg": "#0b0908",
    "--surface": "#171210",
    "--card": "rgba(28,21,17,.65)",
    "--accent": "#ff7e3f",
    "--accent-foreground": "#ffffff",
    "--ink": "#f6ece1",
    "--muted": "#a8978a",
    "--line": "rgba(255,180,120,.14)",
    "--orb-hi": "#ffe6bf",
    "--orb-1": "#ffb454",
    "--orb-2": "#ff7e3f",
    "--orb-3": "#d8531f",
    "--orb-4": "#5e2410",
    "--glow": "rgba(255,126,63,.5)",
    swatch: "#ff7e3f",
  },
  sage: {
    "--bg": "#f4f6f1",
    "--surface": "#ffffff",
    "--card": "#ffffff",
    "--accent": "#6f8f6a",
    "--accent-foreground": "#ffffff",
    "--ink": "#23291f",
    "--muted": "#6b7363",
    "--line": "rgba(80,110,70,.16)",
    "--orb-hi": "#eaf2e6",
    "--orb-1": "#a9c79f",
    "--orb-2": "#6f8f6a",
    "--orb-3": "#4d6b48",
    "--orb-4": "#2f4a2c",
    "--glow": "rgba(111,143,106,.45)",
    swatch: "#6f8f6a",
  },
  ocean: {
    "--bg": "#eef3f8",
    "--surface": "#ffffff",
    "--card": "#ffffff",
    "--accent": "#3b7ea1",
    "--accent-foreground": "#ffffff",
    "--ink": "#1b2733",
    "--muted": "#5a6b78",
    "--line": "rgba(60,110,150,.16)",
    "--orb-hi": "#e3eef6",
    "--orb-1": "#9fc4dc",
    "--orb-2": "#3b7ea1",
    "--orb-3": "#275a78",
    "--orb-4": "#163a4f",
    "--glow": "rgba(59,126,161,.45)",
    swatch: "#3b7ea1",
  },
  rose: {
    "--bg": "#faf0f3",
    "--surface": "#ffffff",
    "--card": "#ffffff",
    "--accent": "#c25e7e",
    "--accent-foreground": "#ffffff",
    "--ink": "#2c1f25",
    "--muted": "#7a6670",
    "--line": "rgba(180,90,120,.16)",
    "--orb-hi": "#f7e3ea",
    "--orb-1": "#e6a6bd",
    "--orb-2": "#c25e7e",
    "--orb-3": "#9a3f5c",
    "--orb-4": "#5e2238",
    "--glow": "rgba(194,94,126,.45)",
    swatch: "#c25e7e",
  },
};

// Pepper ships locked to this theme.
const ACTIVE_THEME = "ember";

// Overlay CSS — verbatim from source, scoped under `.heypep` and with
// `body.overlay-open` rewritten to `.heypep.open` (see file header).
const OVERLAY_CSS = `
.heypep .fab{position:fixed;right:20px;bottom:calc(20px + env(safe-area-inset-bottom));width:64px;height:64px;border-radius:50%;border:none;cursor:pointer;z-index:30;background:radial-gradient(circle at 36% 30%,var(--orb-hi),var(--orb-1) 18%,var(--orb-2) 48%,var(--orb-3) 78%,var(--orb-4));box-shadow:0 8px 30px var(--glow);animation:heypep-breathe 6s ease-in-out infinite}
.heypep .fab:active{transform:scale(.95)}
@keyframes heypep-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.heypep .backdrop{position:fixed;inset:0;background:color-mix(in srgb,var(--bg) 78%,transparent);backdrop-filter:blur(2px);z-index:40;opacity:0;pointer-events:none;transition:opacity .3s ease}
.heypep.open .backdrop{opacity:1;pointer-events:auto}
.heypep .panel{position:fixed;left:50%;bottom:0;transform:translate(-50%,100%);width:min(560px,100%);z-index:50;background:var(--surface);border:1px solid var(--line);border-bottom:none;border-radius:24px 24px 0 0;padding:22px 20px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -20px 60px rgba(0,0,0,.45);transition:transform .35s cubic-bezier(.2,.8,.2,1)}
.heypep.open .panel{transform:translate(-50%,0)}
.heypep .panel-head{display:flex;align-items:center;gap:14px;margin-bottom:16px}
.heypep .p-orb{position:relative;width:44px;height:44px;border-radius:50%;overflow:hidden;flex:none;background:radial-gradient(circle at 36% 30%,var(--orb-hi),var(--orb-1) 18%,var(--orb-2) 48%,var(--orb-3) 78%,var(--orb-4));box-shadow:0 0 18px var(--glow);animation:heypep-breathe 6s ease-in-out infinite}
.heypep .p-orb.listening{animation-duration:2.4s}
.heypep .panel-head .title{font-weight:600}
.heypep .panel-head .title small{display:block;color:var(--muted);font-weight:400;font-size:.8rem;margin-top:2px}
.heypep .close-x{margin-left:auto;background:none;border:none;color:var(--muted);font-size:1.4rem;cursor:pointer;line-height:1}
.heypep .thread{max-height:34vh;overflow-y:auto;display:flex;flex-direction:column;gap:10px;margin-bottom:14px;padding-right:4px}
.heypep .msg{max-width:86%;padding:11px 14px;border-radius:16px;font-size:.95rem;line-height:1.45}
.heypep .msg.pep{align-self:flex-start;background:var(--card);border:1px solid var(--line)}
.heypep .msg.you{align-self:flex-end;background:color-mix(in srgb,var(--accent) 20%,transparent);border:1px solid color-mix(in srgb,var(--accent) 30%,transparent)}
.heypep .quick{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.heypep .quick button{font-size:.8rem;color:var(--muted);background:transparent;border:1px solid var(--line);border-radius:999px;padding:7px 13px;cursor:pointer}
.heypep .quick button:hover{color:var(--ink);border-color:color-mix(in srgb,var(--accent) 45%,transparent)}
.heypep .inbar{display:flex;align-items:center;gap:9px;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:7px}
.heypep .ic{flex:none;width:42px;height:42px;border-radius:50%;border:none;cursor:pointer;display:grid;place-items:center}
.heypep .ic.mic{background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent)}
.heypep .ic.mic.on{background:var(--accent);color:var(--accent-foreground)}
.heypep .ic.send{background:var(--accent);color:var(--accent-foreground)}
.heypep .inbar input{flex:1;background:none;border:none;outline:none;color:var(--ink);font-size:1rem;padding:0 4px}
.heypep .inbar input::placeholder{color:var(--muted)}
@media(min-width:600px){.heypep .panel{bottom:24px;border-radius:24px;border-bottom:1px solid var(--line)}.heypep.open .panel{transform:translate(-50%,0)}}
`;

// Verbatim source SVGs.
const MicIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </svg>
);

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

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

const AFFIRMATIVE =
  /\b(yes|yep|yeah|yup|correct|confirm|confirmed|do it|go ahead|sounds? (good|right)|that'?s right|save( it)?|sure|right|ok(ay)?)\b/i;
const NEGATIVE =
  /\b(no|nope|nah|cancel|don'?t|do not|wrong|nevermind|never mind|not right|that'?s wrong)\b/i;
// A proposed fill = an explicit update intent (financial field or set/change
// verb) PLUS a number. A bare number inside an explain question
// ("what does 72 mean?") must NOT arm the confirm-gate.
const FILL_INTENT =
  /\b(income|salary|wage|debt|owe|savings?|save|credit|rent|mortgage|set|update|change|make it|raise|lower)\b/i;
const HAS_VALUE = /\$?\s?\d[\d,]{1,}(?:\.\d+)?/;

const DEFAULT_PLACEHOLDER = "Ask Pepper, or tell me a number…";

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

  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const rootRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  // True once the user has proposed a value the coach is asking them to confirm.
  const pendingFillRef = useRef(false);

  const section = SECTION_BY_ROUTE[location];

  // Apply the (ember) theme tokens onto the overlay root. THEMES is kept whole
  // so the palette can be swapped later without touching markup or CSS.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const theme = THEMES[ACTIVE_THEME];
    for (const [key, value] of Object.entries(theme)) {
      if (key === "swatch") continue;
      el.style.setProperty(key, value);
    }
  }, []);

  // Auto-scroll the thread as messages stream in.
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, status, open]);

  // ===== coach Mode-B call (replaces the source's demo handle()) =====
  const handle = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");

    const affirmative = AFFIRMATIVE.test(t) && !NEGATIVE.test(t);
    const negative = NEGATIVE.test(t);
    const proposesFill = HAS_VALUE.test(t) && FILL_INTENT.test(t);

    // Confirm-before-commit: only a "yes" to a pending value proposal commits.
    const commit = pendingFillRef.current && affirmative;

    const result = await sendText(t, { mode: "overlay", section, commit });

    // Pepper resolved an allowlisted navigation for this turn (validated
    // server-side). Its confirming reply has already streamed in; route there
    // and close the overlay. Works for both typed input and mic dictation,
    // since both arrive here through handle().
    if (result.navigate) {
      setLocation(result.navigate);
      setOpen(false);
    }

    if (commit) {
      pendingFillRef.current = false;
      // The confirmed fill was persisted server-side (awaited before `done`);
      // refresh the views that depend on it.
      void queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetRoadmapQueryKey() });
      void queryClient.invalidateQueries();
    } else if (negative) {
      pendingFillRef.current = false;
    } else if (proposesFill) {
      // An explicit update + value was stated — the coach will ask the user to
      // confirm it before anything is written.
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

      <button className="fab" aria-label="Open Pepper" onClick={() => setOpen(true)} />

      <div className="backdrop" onClick={() => setOpen(false)} aria-hidden={!open} />

      <div className="panel" role="dialog" aria-label="Pepper assistant">
        <div className="panel-head">
          <div className={`p-orb${listening ? " listening" : ""}`} />
          <div className="title">
            Pepper<small>Ask about anything on your screen</small>
          </div>
          <button className="close-x" aria-label="Close" onClick={() => setOpen(false)}>
            ×
          </button>
        </div>

        <div className="thread" ref={threadRef}>
          {bubbles.length === 0 && (
            <div className="msg pep">
              Hey — I'm right here. Ask me about anything on your screen, or just
              tell me a number to update.
            </div>
          )}
          {bubbles.map((m) => (
            <div key={m.id} className={`msg ${m.role === "user" ? "you" : "pep"}`}>
              {m.content}
            </div>
          ))}
        </div>

        <div className="quick">
          <button onClick={() => handle("What does my readiness score mean?")}>
            Explain my score
          </button>
          <button onClick={() => handle("I'd like to update my income.")}>
            Update my income
          </button>
        </div>

        <div className="inbar">
          <button
            className={`ic mic${dictating ? " on" : ""}`}
            aria-label="Speak"
            onClick={toggleMic}
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
            placeholder={dictating ? "Listening…" : DEFAULT_PLACEHOLDER}
            autoComplete="off"
          />
          <button className="ic send" aria-label="Send" onClick={() => void handle(input)}>
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
