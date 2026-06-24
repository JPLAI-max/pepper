---
name: Pepper full-screen takeover / simulation routes
description: How to mount an isolated full-screen iframe page (e.g. /reveal, /market, /financing) without leaking real engines into it
---

Some Pepper routes are full-screen takeovers that embed a standalone HTML doc
verbatim via iframe (pattern from `pages/Reveal.tsx`): `pages/Market.tsx`
(/market, trading-desk demo), `pages/Financing.tsx` (/financing), and
`pages/CapitalMarkets.tsx` (/capital-markets, funding/secondary/crypto tabs).
They are **pure simulations** — no real money/securities/digital-assets, no DB
writes, no external/wallet/blockchain calls.

Two access tiers among them:
- `/market`, `/financing`, `/capital-markets` are **PUBLIC** (rendered directly
  in `App.tsx`, NOT wrapped in `ProtectedRoute`, NOT inside `AppLayout`). They
  must be guest-reachable so the guided TOUR can showcase them without an
  account — gating them (route guard or in-page auth redirect) re-introduces the
  "guest tour bounces to landing" bug. The pages themselves have NO auth gate;
  their Back button goes to `/dashboard` when authenticated else `/`.
- `/reveal` stays **auth-only** (`ProtectedRoute` → `AppLayout`).

To mount one safely, prevent real engines from leaking onto the simulation:

1. **Iframe sandbox.** Use `sandbox="allow-scripts"` WITHOUT `allow-same-origin`.
   That puts the embedded doc in an opaque origin so its scripts run but cannot
   make credentialed same-origin calls to the authenticated app API or touch
   app storage. Only safe because the demo HTML uses no localStorage/fetch/
   cookies — if a future demo needs networking, proxy it through a reviewed
   contract, do NOT add `allow-same-origin`.
2. **`App.tsx` → `TAKEOVER_ROUTES`.** `GlobalAssistant` returns null on any path
   in this list (guest OR authed), so the `PepperAssistant` orb never surfaces
   over a demo. This is the suppression that matters for the PUBLIC demo routes,
   since they render OUTSIDE `AppLayout`. (`APP_SHELL_ROUTES` only suppresses the
   orb for AUTHED users and is now redundant for these three — keep them in sync.)
3. **`AppLayout.tsx` → `isTakeover`.** Still relevant for `/reveal` (which DOES
   render inside `AppLayout`): `HeyPepOverlay` and `GlobalDropZone` are gated on
   `!isTakeover`. The public demo routes don't mount `AppLayout` at all, so those
   layers never exist there.

**Why:** architect FAILED an early cut for two reasons — unsandboxed same-origin
iframe could reach authed APIs, and the real assistant + upload surfaces stayed
live behind the takeover. Separately, gating the demo routes broke the guest
tour. Keep both boundaries: sandboxed + orb-suppressed, but publicly reachable.

**How to apply:** new full-screen demo/simulation route → render it public in
`App.tsx`, add it to `TAKEOVER_ROUTES` (and `AppLayout.isTakeover` only if it is
auth-gated like `/reveal`), and sandbox the iframe. Verbatim demo HTML lives in
`artifacts/pepper/public/` and is iframed via
`src={\`${import.meta.env.BASE_URL}<file>.html\`}`; keep its SIMULATION banner +
disclaimers untouched. Dashboard entry cards live in `pages/Dashboard.tsx`.
