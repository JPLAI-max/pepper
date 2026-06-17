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

**How to apply / contracts:**
- Server (text route only, overlay turns): resolve `navigateTo`, pass it into
  `buildCoachContext` (so the reply confirms by name), and emit a RAW SSE event
  `{navigate:"/x"}` BEFORE `{done:true}` in the overlay branch. It's a raw SSE
  event, NOT part of openapi.yaml — no codegen needed.
- Client: `sendText` returns `Promise<{navigate?:string}>`; `HeyPepOverlay.handle()`
  calls `setLocation` + `setOpen(false)` AFTER `await sendText` (reply already
  rendered → no premature redirect).
- Both overlay paths (typed input and mic) funnel through `handle()` because the
  overlay mic is DICTATION (`dictateStop` → transcript → `handle` → `sendText`,
  the text route) — it does NOT use the voice-messages route. So navigation only
  needed wiring in the text route + sendText, not the voice route.
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
