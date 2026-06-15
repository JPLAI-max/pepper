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
