---
name: Dashboard engine integration
description: How the Pepper dashboard stays consistent with the live engines and never fabricates money figures.
---

# Dashboard must mirror the engines, never re-derive

The Command Center dashboard renders **the same engine outputs** as the dedicated
pages, by calling the same endpoints — readiness from `GET /scores`, roadmap from
`GET /roadmap`, opportunities from `GET /opportunities/matches`. It must NOT
recompute or duplicate those in `/dashboard/summary`.

**Why:** A prior version computed its own scores/opportunities inside the summary
route, so the dashboard silently diverged from the Readiness/Roadmap/Opportunities
pages. Sourcing from the shared endpoints removes that drift class entirely.

**How to apply:** When adding a dashboard tile backed by an engine, consume the
engine's existing GET endpoint via its generated hook; do not add a parallel
computation in the summary route.

# Money fields: gate on capturedFields → null, never $0

`/dashboard/summary` money fields (netWorth, monthlyCashflow, totalAssets,
totalDebt) are emitted only when their inputs exist in `profile.capturedFields`,
otherwise `null`. Schema types are nullable; the client HIDES a card when null.

**Why:** Showing `$0` for an unfilled field is fabrication — it reads as "you have
nothing" rather than "not captured yet." Pepper's rule is never to invent numbers.

**How to apply:** Any new money figure must check capturedFields and return null
when not captured; the UI hides (not zero-fills) null money values. netWorth is
emitted when an asset component + debt are captured (partial-assets allowed — a
deliberate product choice; net worth may undercount until all asset fields exist).

# Coach turns must invalidate every engine surface

After each coach turn (PepperProvider text AND voice `finally` blocks), invalidate
profile + dashboardSummary + readinessScores + roadmap + opportunityMatches.

**Why:** Extraction runs after the turn and can move financials, scores, roadmap,
and matches; invalidating only profile left the dashboard stale.

**How to apply:** Mirror the `useDocumentUpload` invalidation set anywhere a write
path can change engine inputs.
