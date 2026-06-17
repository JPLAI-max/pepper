---
name: Pepper readiness scoring engine
description: Decisions behind the deterministic (no-AI) readiness scoring engine, the "0 = unfilled" presence rule, and the additive /scores contract.
---

# Pepper readiness scoring engine

Deterministic, educational scoring engine lives in `artifacts/api-server/src/lib/scoring.ts`
(`computeReadiness` + `persistReadinessScores`). Six scores: homeownership, credit, debt,
investing, passive_income, wealth. Each is a weighted average over **present components only**,
weights renormalized, `partial=true` when any component is excluded.

## Presence = field ∈ `profiles.capturedFields` (NOT `value > 0`) — the core rule
**Rule:** Presence of a money/credit field is whether its key is in `profiles.capturedFields`
(a jsonb `string[]` of NUMERIC_PROFILE_FIELDS keys), NOT `value > 0`. A captured value may
legitimately be `0` (e.g. confirmed "I have no debt") and is then a REAL zero; an uncaptured
field stays unknown and its component is EXCLUDED with `partial=true`.
**Why:** `value > 0` conflated a true $0 with the unfilled default 0, so a user with genuinely
zero debt got debt excluded as if unknown (and couldn't ever get a real perfect DTI). An earlier
review had *also* caught the inverse bug (unfilled 0 masquerading as perfect health) — both are
fixed by keying off explicit capture instead of the value.
**How to apply:** Both `scoring.ts` `computeReadiness` and `roadmap.ts` `computeRoadmap` build
`const captured = new Set(p.capturedFields ?? [])` and gate every component via
`captured.has("totalDebt")` etc. DTI still requires `hasIncome && hasDebt` (income capture + debt
capture). Keep the two engines' presence flags identical. Verify the captured-0 path with the
esbuild-bundled pure-engine test (see `esm-api-server-standalone-scripts.md`): uncaptured-0 debt →
"Not enough data"; captured-0 debt + income → debt value 100.

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
