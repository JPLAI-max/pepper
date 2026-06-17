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

To mount one safely there are THREE coordinated places, and missing any one
leaks a real engine onto the simulation screen:

1. **Iframe sandbox.** Use `sandbox="allow-scripts"` WITHOUT `allow-same-origin`.
   That puts the embedded doc in an opaque origin so its scripts run but cannot
   make credentialed same-origin calls to the authenticated app API or touch
   app storage. Only safe because the demo HTML uses no localStorage/fetch/
   cookies — if a future demo needs networking, proxy it through a reviewed
   contract, do NOT add `allow-same-origin`.
2. **`App.tsx` → `APP_SHELL_ROUTES`.** Add the path here so the global
   `PepperAssistant` panel (mounted by `GlobalAssistant`) is suppressed.
3. **`AppLayout.tsx` → `isTakeover`.** Add the path to the `isTakeover` check;
   `HeyPepOverlay` and `GlobalDropZone` are gated on `!isTakeover`, so neither
   the "Hey Pep" overlay nor the document drop layer mounts behind the iframe.

**Why:** architect FAILED the first cut for exactly two reasons — unsandboxed
same-origin iframe could reach authed APIs, and the real assistant + upload
surfaces stayed live behind the takeover. Both are security/UX boundary bugs.

**How to apply:** any new full-screen embedded/simulation route must do all
three. Verbatim demo HTML lives in `artifacts/pepper/public/` and is iframed via
`src={\`${import.meta.env.BASE_URL}<file>.html\`}`; keep its SIMULATION banner +
disclaimers untouched. Dashboard entry cards live in `pages/Dashboard.tsx`.
