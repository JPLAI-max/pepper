---
name: Pepper overlay navigation (Mode B)
description: How "Hey Pep" overlay voice/typed navigation resolves a route, why it uses a gated separate classifier, and the SSE/return-value contract.
---

# Hey Pep overlay navigation (Mode B)

The overlay coach can take the user to an in-app section by name ("take me to the
trading desk" → /market). Routes are an ALLOWLIST enforced server-side in
`lib/navigation.ts` (`NAV_ALLOWLIST`: /dashboard, /market, /financing,
/capital-markets, /roadmap, /reveal — a SUBSET that excludes /goals, /readiness,
/documents, /opportunities). `classifyNavigation()` maps NL→route then
`isAllowedRoute` is the final authority; anything off-list/external → null.

**Why a separate classifier call (not the streamed reply):** making the main coach
emit a JSON `navigate` field would print raw JSON into the streamed chat (see
pepper-coach-prompt.md). Instead the route is resolved by a dedicated JSON-only
OpenAI call, gated behind a cheap deterministic `mightBeNavigation()` regex so
non-nav overlay turns (explain/dictation) skip the extra call entirely.

**Nav/tour runs on EVERY coach turn + short-circuits the coach (current model).**
`classifyOverlayIntent(content)` runs for ALL `/messages` turns — the main landing
chat AND the overlay — not overlay-only. When it resolves a navigate OR tour, the
server SHORT-CIRCUITS *before* the coach LLM: persist the user msg, emit a
deterministic `{content}` reply from `navConfirmationReply(intent)`, persist it as
the assistant msg, emit `{tour:{stops}}` or `{navigate}`, then `{done}`, return.
**Why:** an explicit nav/tour command is navigation, not an advice request — going
through the coach risked the "not-a-licensed-advisor" refusal. Short-circuiting
guarantees it never reaches that guardrail (and is faster). Consequence: nav/tour
turns no longer pass `navigateTo/tour` into `buildCoachContext` (that confirm-by-
name path is now dead for nav; the coach still HAS the blocks for legacy callers).

**How to apply / contracts:**
- Server: see short-circuit above. The `{navigate}`/`{tour}` SSE events are RAW
  (not in openapi.yaml — no codegen).
- Safety unchanged: `mightBeOverlayIntent` deterministic pre-filter + `isAllowedRoute`
  allowlist (final authority, off-list→null, no open redirect) + try/catch→NO_INTENT.
  A normal message resolves to no intent, never navigates/throws, always gets the
  normal streamed coach answer. Onboarding is unaffected except explicit nav/tour
  phrases (the pre-filter won't fire on financial-disclosure turns).
- Clients consuming `sendText`'s `{navigate?, tour?}` result and ACTING on it:
  `HeyPepOverlay.handle()` (setLocation+setOpen(false)), `PepperAssistant` main-chat
  onSubmit (startTour/setLocation), and `AmbientOverlay.runCommand` (closeAmbient+
  startTour/setLocation). All act AFTER `await sendText` so the reply renders first.
- Both OVERLAY paths (typed input and overlay mic) funnel through `handle()`
  because the overlay mic is DICTATION (`dictateStop` → transcript → `handle` →
  `sendText`, the text route). The WAKE word opens the ambient layer, whose
  capture → `sendText` (text route) too. So those paths resolve nav/tour via the
  text route.
- BUT the main `PepperAssistant` push-to-talk mic is the ONE true voice path:
  `toggleListening` → `stopListening` → `sendVoiceBlob` → the `/voice-messages`
  route. That route ALSO resolves nav/tour now (it must — spoken "take me on a
  tour" used to fall through to the coach and only show a text reply, never
  navigating). It runs `classifyOverlayIntent` right after STT and, on nav/tour,
  short-circuits: emit typed `{type:"transcript"}` (the deterministic
  `navConfirmationReply`) + `{type:"audio"}` (TTS so Pepper SPEAKS it) +
  `{type:"navigate"}`|`{type:"tour",data:{stops}}`, persist both msgs, `{done}`,
  return (never reaches coach; no extraction). Voice SSE stays TYPED (`{type,data}`)
  unlike the text route's untyped chunks — so `navigate`/`tour` are typed events
  there. `sendVoiceBlob` returns `{navigate?,tour?}`; `stopListening`/
  `toggleListening` propagate it; `PepperAssistant`'s mic onClick acts on the
  result (startTour/setLocation), mirroring its typed-submit handler.
- First name for the signed-in greeting is `displayName.split(" ")[0]`, server/
  session-derived, skipped when "Friend" (unset default).

## Guided tour (extends the above)

A "tour" intent ("give me the tour", "take me through the demos", "show me
everything") walks the demo routes in order: /market → /financing →
/capital-markets. Same architecture as single-route nav, with these specifics:

- Server: the classifier is now `classifyOverlayIntent()` returning
  `{navigate, tour}` (gated by `mightBeOverlayIntent`). Tour stops are
  SERVER-OWNED + allowlisted: `TOUR_STOPS` in `lib/navigation.ts`
  (`{route,name,intro}[]`, typed `satisfies …NavRoute…`). Overlay branch emits a
  RAW SSE `{tour:{stops:TOUR_STOPS}}` (priority over `{navigate}`), no codegen.
  `buildCoachContext` gets `tour?:boolean` → one-sentence announcement only.
- Client: `sendText` returns `{navigate?, tour?: TourStop[]}`. Provider holds
  tour DATA only (`{stops,index}` + `startTour/tourNext/tourStop`) — it lives
  OUTSIDE the wouter Router so it CANNOT navigate.
- **CRITICAL render constraint:** `HeyPepOverlay` is suppressed on takeover
  routes (AppLayout `isTakeover`). So the banner is a separate global
  `<TourBanner/>` mounted in App.tsx INSIDE the Router (alongside
  GlobalAssistant). TourBanner does the wouter navigation via a `useEffect` on
  the current stop's route, renders the persistent banner, and carries its OWN
  mic (dictate→regex next/stop) because the overlay isn't present on demo pages.
- `tourNext` auto-ends after the last stop; `tourStop` removes the banner.
  `reset()` (logout) MUST also clear tour state or a stale banner survives.
- **Tour must REVEAL the demo, not narrate behind the chat.** TourBanner's
  navigate `useEffect` calls `setOpen(false)` alongside `setLocation(route)`, so
  the chat panel closes on tour start AND every Next (effect keys on the stop's
  route, which changes each advance) — the demo route shows beneath the floating
  banner, never the conversation covering it. **Why:** the panel otherwise stayed
  open over the navigated demo page.
- **Suppress typed chatter during an active tour.** PepperAssistant's submit
  early-returns (clears input, no `sendText`) while `tour !== null`, so a stray
  "ok let's go" can't reach the coach and trip the advice guardrail mid-tour. The
  banner's Next is the primary control during a tour; coach behavior is unchanged
  when no tour is running. (Stricter than "only non-nav" — but nav during a tour
  is redundant since the banner already drives navigation.)
