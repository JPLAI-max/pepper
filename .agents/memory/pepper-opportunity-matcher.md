---
name: Pepper opportunity matcher (educational, future-gated)
description: Rules the deterministic opportunity-matching engine must always obey
---

# Deterministic, educational-only matcher

`lib/opportunities.ts` `computeOpportunityMatches(profile, goals, scores)` is a
pure function (no AI, no randomness, no persistence) exposed read-only via
`GET /opportunities/matches` (requireAuth, session-scoped, compute-on-read —
mirrors `GET /scores`). The existing `GET /opportunities` marketplace is a
separate, unchanged endpoint.

It matches tool *categories* (FHA, conventional, DSCR, HELOC/cash-out,
mortgage_general fallback, foundation), never specific priced products. Copy is
always educational ("tools that may help"), never "you qualify" / "apply now",
and never invents a rate or dollar amount. When goal readiness < 50 it returns a
"foundation first" item (sometimes the right answer is no financing step yet).
HELOC is phrased conditionally because the profile has no home-equity field — it
never asserts ownership.

# Future divisions are NEVER "available" from the matcher

Investment marketplace, Property Income Units, and margin are future-only. The
matcher must only ever emit them with `status: "coming_later"` (in the
`comingLater` array), regardless of the `FEATURE_FLAGS` (securitiesLive /
incomeUnitsLive / marginLive, default off). A flag being *on* means the real,
regulated surface lives elsewhere, so the matcher simply DROPS that division from
the teaser — it does not promote it to "available".

**Why:** hard compliance rule — these divisions must never read as "buy/invest
now" in this build; an env flag must not be able to flip educational content into
an actionable offer.

**How to apply:** keep the matcher's future loop emitting `coming_later` only;
any "go live" must be a separate real implementation, not a status flip here.
