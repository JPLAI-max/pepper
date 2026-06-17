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
