---
name: Pepper ambient "Hey Pep" layer + spoken replies
description: The full-screen ambient wake surface (distinct from the bottom overlay panel) and browser speechSynthesis replies
---

# Ambient "Hey Pep" layer (AmbientOverlay) + browser spoken replies

Distinct from the bottom slide-up `HeyPepOverlay` panel. Wake word ("Hey Pep")
now opens THIS ambient layer, not the bottom panel.

**Ambient surface contract:** own full-screen OPAQUE background (radial ember
over near-black), a centered ~200px breathing orb, greeting "Hey [firstName]" +
sub, a listening cue, the heard transcript, the reply line, and dismiss
affordances ("never mind" spoken, Escape, background tap). NO input bar / chips /
route content. It must NEVER change the route — it overlays the current route and
dismiss returns to that exact route untouched.

**z-index:** the ambient root must sit ABOVE all global app-shell UI. `TourBanner`
is `z-[80]`, so ambient uses `z-index:90`. If you add higher-z global UI, raise
ambient too — the spec requires the ambient surface ALONE be visible.

**Spoken replies (browser `speechSynthesis`, not OpenAI TTS here):** speak the
greeting on wake, then speak the coach reply in addition to on-screen text. Gated
behind a visible mute toggle (SVG icon + text label — NO emojis). Dismiss cancels
in-flight speech.

**Late-reply / dismiss race (the bug to guard):** the coach `sendText(...).then()`
resolves async. If the user dismisses (or re-captures) before it resolves, the
stale resolution must NOT render or speak. Guard with a monotonic `turnRef` token:
capture `myTurn = ++turnRef.current` at `startCapture`, bump `turnRef` on close
(open-effect cleanup) and on each new capture, and bail in `.then` when
`myTurn !== turnRef.current`. Cancelling current speech on close is NOT enough on
its own because the pending promise can start a NEW utterance after close.

**Profile query gating:** `AmbientOverlay` is mounted globally, so `useGetProfile`
must be `enabled: isAuthenticated` (with an explicit `queryKey`) or anonymous
routes spam `/api/profile` 401s. Same gating pattern App.tsx already uses.

**Wake vs ambient recognition exclusivity:** both use the browser SpeechRecognition
API and cannot run concurrently. The wake-word effect is guarded to pause while
`ambient === true`; ambient command capture (`captureCommand`) only runs while open.
