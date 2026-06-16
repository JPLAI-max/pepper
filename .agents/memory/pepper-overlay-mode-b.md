---
name: Pepper "Hey Pep" overlay (coach Mode B)
description: How the dashboard overlay gates persistence and why every overlay turn still persists its message
---

# "Hey Pep" overlay — Mode B coach + gated persistence

The dashboard overlay assistant reuses the SAME conversation/`usePepper` plumbing
as the main PepperAssistant. The only difference is `sendText(content, { mode:
"overlay", section, commit })`, which the server threads into `buildCoachContext`
(adds a short Mode-B block naming the screen) and into a persistence gate.

**Persistence gate (overlay turns):**
- The overlay turn runs `extractAndPersist` (financial data + score/roadmap
  recompute) ONLY when `commit === true`, and AWAITS it before emitting the SSE
  `done` so the client's post-turn query invalidation sees fresh data.
- Non-commit overlay turns (explain a screen, propose a value) run NO extraction.
- Non-overlay chat is unchanged: fire-and-forget `scheduleExtraction` after
  `res.end()`.

**Why explain turns STILL insert their chat message (do not "fix" this):**
`extractAndPersist` reads the WHOLE conversation history from the `messages`
table. The value is stated on the proposal turn ("my income is 9000") and only
confirmed ("yes") on a later commit turn. If overlay message inserts were gated
behind `commit`, the stated number would be absent from history at commit time
and extraction would persist nothing. So "explain = read-only / no writes" means
no *financial-data* writes (profile/scores/roadmap), NOT no transcript writes.

**Client confirm-gate** lives in `HeyPepOverlay` (`pendingFillRef`): a turn
containing a number sets pending; an affirmative reply while pending sends
`commit: true`; a negative clears it. No client-supplied userId or numbers ever
go to the server — the value is extracted server-side from history under the
session userId.

**Scope decisions:** overlay is mounted in `AppLayout` (so all app-shell screens)
and hidden on `/reveal`. `/onboarding` is a deliberate full-screen takeover OUTSIDE
`AppLayout` and keeps the immersive PepperAssistant (dictation into form fields) —
it is intentionally NOT an overlay surface. `GlobalAssistant` suppresses the old
PepperAssistant on authenticated app-shell routes to avoid a duplicate orb.
