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

**Verbatim render (the user is strict about this):** the overlay shell (orb/FAB,
backdrop, panel, markup, animations, full multi-theme `THEMES` object) is a
byte-for-byte port of the user's source HTML — only the demo `handle()` is
replaced. The source's ember is a WARM palette (orange `--accent`, dark warm bg),
NOT Pepper's app charcoal/`#E85D3F` tokens; do not substitute the app's global
tokens for the source's. Allowed deviations are only those forced by integration:
tokens/selectors are scoped to the component's own root instead of `:root`/`body`
(shadcn already owns same-named globals like `--card`/`--muted`/`--accent`, so
`:root` would clobber the app), the breathe keyframe is namespaced (global
injected `<style>`), and the demo dashboard + theme switcher aren't rendered
(Pepper pages are the host; ember ships locked).
**Why:** the user re-pastes the source and diffs against it. If the port ever
drifts, re-request the HTML and diff — never reconstruct the shell from memory.

**Confirm-gate must require fill INTENT, not just a number:** arm
`pendingFillRef` only when the message has an update intent (financial field or
set/change verb) AND a value. A bare number in an explain question
("what does 72 mean?") followed by "yes" must not send `commit:true`, or it
fires an unintended persistence/recompute pass.

**Scope decisions:** overlay is mounted in `AppLayout` (so all app-shell screens)
and hidden on `/reveal`. `/onboarding` is a deliberate full-screen takeover OUTSIDE
`AppLayout` and keeps the immersive PepperAssistant (dictation into form fields) —
it is intentionally NOT an overlay surface. `GlobalAssistant` suppresses the old
PepperAssistant on authenticated app-shell routes to avoid a duplicate orb.
