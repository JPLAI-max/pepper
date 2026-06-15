---
name: Reveal screen (iframe-embedded static page)
description: How "The Reveal" is served and why its CTA/data wiring works the way it does
---
# The Reveal screen

A standalone marketing-style page (`artifacts/pepper/public/pepper-reveal.html`) embedded full-screen via an iframe (`src/pages/Reveal.tsx`), same pattern as the public landing. Route `/reveal` is client-side auth-gated only (anon redirected to `/`); the data it shows is protected because every `/api/*` fetch is `requireAuth`.

**Why the CTA is overridden in the parent:** an inline `onclick="location.href='/dashboard'"` inside the iframe navigates the IFRAME, loading the SPA route *inside* the iframe (nested app). The parent (`Reveal.tsx`) must reassign the button's `.onclick` on iframe load to call wouter `setLocation('/dashboard')` so navigation happens at the top level.

**Reveal trigger (`readyForReveal`):** the flag is set server-side during coach extraction; the client only learns it by refetching the profile. So `PepperProvider` invalidates `getGetProfileQueryKey()` after every text/voice turn, and a global `RevealRedirect` watcher routes to `/reveal` once (localStorage `pepper.revealShown` guard, re-armed when the flag goes false).

**Never-fabricate rule:** the static HTML ships with sample values (e.g. name "Jordan", "$8,000"). The live script must overwrite or hide EVERY bound element, including clearing the name when no profile/displayName, so a failed fetch never leaves sample data visible. Empty stats/sections are hidden, not shown as $0.
