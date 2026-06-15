---
name: Pepper readiness scoring engine
description: Decisions behind the deterministic (no-AI) readiness scoring engine, the "0 = unfilled" presence rule, and the additive /scores contract.
---

# Pepper readiness scoring engine

Deterministic, educational scoring engine lives in `artifacts/api-server/src/lib/scoring.ts`
(`computeReadiness` + `persistReadinessScores`). Six scores: homeownership, credit, debt,
investing, passive_income, wealth. Each is a weighted average over **present components only**,
weights renormalized, `partial=true` when any component is excluded.

## "0 means unfilled / unknown" — the core rule
**Rule:** In the profile, `0` is the unfilled default for every money/credit field, so it is
treated as *unknown*, NOT a real value. A component whose inputs are 0/absent must be EXCLUDED
and the score marked `partial` — never compute it with the zero.
**Why:** A code review caught that DTI was being marked present on `monthlyIncome > 0` alone, so
an unfilled `totalDebt` (0) masqueraded as perfect debt health and inflated debt/homeownership/
investing/wealth. The "never invent data" requirement forbids this.
**How to apply:** Presence flags gate every component (`hasIncome/hasDebt/hasSavings/hasAssets/
hasCredit/hasExpenses`, each `field > 0`). DTI requires `hasIncome && hasDebt`. If you ever add a
field where 0 is a legitimate value, you must add an explicit known/unknown flag rather than
relying on `> 0`.

## Data that is never stored → always excluded
Income stability, credit utilization, and payment history are NOT captured anywhere, so the
components depending on them are always excluded → those scores are always `partial`. Do not
fabricate them; if you want them to count, you must first persist real inputs.

## Two score producers coexist (do not merge them)
- `insights.ts` `computeScores` — legacy; still powers the coach context + dashboard summary and
  returns `key/label/score/tier/summary`.
- `scoring.ts` `computeReadiness` — the authoritative deterministic engine; returns
  `value/band/partial/helpingFactor/hurtingFactor` and is what gets persisted.
**`/scores` is additive:** it MERGES both shapes so the existing Readiness page (which reads the
legacy `tier`/`summary`) keeps working. Keep it additive; don't drop legacy fields without
updating the frontend.

## Bands
Homeownership uses a product-specified ladder (90+ Mortgage Ready / 80 Likely Ready / 70 Minor
Improvements / 60 Preparation / <60 Foundation Building). Other scores use a general band
(Excellent/Strong/Healthy/Fair/Developing/Foundation Building). A fully-excluded score →
"Not enough data".

## Persistence
`persistReadinessScores(userId)` upserts one row per (user, key) in `scores` and appends to
`score_history` ONLY when `value` or `band` changed (idempotent on no-op). Recompute is hooked
after the silent extraction pass in `extraction.ts`. `scores` has `unique(userId, key)`.
goals/roadmap_steps/documents `userId` now carry a real FK to `users.id` with NO default — every
insert must set it (seed.ts no longer seeds per-user rows).
