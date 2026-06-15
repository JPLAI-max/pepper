---
name: Roadmap & readiness engine grounding rules
description: How the deterministic roadmap/scores engines stay read-only and never fabricate figures
---

# Read-only GET + single recompute chokepoint

GET /scores and GET /roadmap are READ-ONLY. They read persisted rows
(`scores`, `roadmap_steps`) and, for anything not yet persisted, compute the
result in memory and return it WITHOUT writing.

**Why:** persistence is centralized on ONE chokepoint — the
extraction-after-conversation path (`extraction.ts` → `persistReadinessScores`
then `persistRoadmap`). Manual PATCH /profile and the GET handlers deliberately
do NOT write scores/roadmap, so reads never have surprise side effects and the
recompute is in exactly one place.

**How to apply:** when adding a derived/computed resource, write only from the
extraction recompute path; make the GET compute an in-memory fallback. Persist
fns replace user-scoped rows in a transaction and return rows with ids.

# Roadmap is engine-owned: status-preserving reconcile, not delete-and-rebuild

Each generated roadmap step carries a deterministic `stableKey`
(`"${horizon}:${segment}"`, e.g. `immediate:fund`) persisted in
`roadmap_steps.stable_key` (nullable). `persistRoadmap` reconciles by key:
surviving key → UPDATE content/order/horizon but **never** touch `status` (so a
user's "done" survives regeneration); new key → INSERT as todo; obsolete or
keyless row → DELETE. It is NOT a delete-and-reinsert (that would reset progress
and churn ids).

There is no manual step creation: `POST /roadmap` (route + openapi op +
`RoadmapInput`) is removed. `PATCH /roadmap/:id` is the only client write and is
**status-only** — `RoadmapUpdate` was narrowed to `{ status }` (required) so a
client cannot rewrite engine-owned title/order/horizon. Frontend Add/Edit UI was
removed accordingly.

**Why:** the roadmap is deterministically derived; the only user-owned datum on a
step is its completion status, which must be preserved across recomputes.

**How to apply:** if you add a step, give it a unique segment so its key is
stable; never widen the PATCH contract back to arbitrary fields.

# "Never fabricate a figure" in roadmap copy

The roadmap engine (`lib/roadmap.ts`) may only emit numbers that are a stored
profile value or simple arithmetic clearly derived from one: surplus
(income-expenses), surplus*12, expenses*3 (starter emergency fund), totalDebt,
creditScore. Anything else (interest rates, % utilization thresholds, "cut N
subscriptions", per-category spend on dining/subscriptions/car) is NOT stored,
so it must be phrased as a specific NON-numeric action instead.

**Why:** the product rule is goals/roadmap grounded in the user's real numbers;
inventing a figure (e.g. a fake surplus or an arbitrary count) undermines trust
and was explicitly flagged in review.

**How to apply:** if a step needs a number that isn't a permitted derived
value, reword to non-numeric. Factual constants (e.g. "all three credit
bureaus") are fine; arbitrary counts/percentages are not.
