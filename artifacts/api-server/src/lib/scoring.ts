import { and, eq } from "drizzle-orm";
import {
  db,
  scores as scoresTable,
  scoreHistory,
  type Profile,
} from "@workspace/db";
import { getOrCreateProfile } from "./identity";

/**
 * Deterministic, educational readiness scoring engine.
 *
 * Rules:
 * - Pure function of the stored profile. No AI, no advice, no approve/decline.
 * - Each score is 0-100, the weighted average of its present components.
 * - A component whose underlying data is not present yet is EXCLUDED and the
 *   remaining weights are renormalized — we never invent a value to fill a gap.
 *   When any expected component is excluded, the score is marked `partial`.
 * - Each score names the single biggest helping factor (strongest present
 *   component) and the single biggest hurting factor (weakest present
 *   component) as a plain-language "why".
 */

export interface ReadinessResult {
  key: string;
  label: string;
  value: number;
  band: string;
  partial: boolean;
  helpingFactor: string | null;
  hurtingFactor: string | null;
}

const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Math.round(n)));

/** One weighted input to a score. `present` is false when its data is absent. */
interface Component {
  weight: number;
  present: boolean;
  /** Sub-score 0-100; only meaningful when `present`. */
  value: number;
  /** Plain-language reason this component helps when it is strong. */
  helps: string;
  /** Plain-language reason this component hurts when it is weak. */
  hurts: string;
}

// Band scales. Homeownership uses the product-specified ladder; the other
// scores share a general educational scale.
function homeownershipBand(value: number): string {
  if (value >= 90) return "Mortgage Ready";
  if (value >= 80) return "Likely Ready";
  if (value >= 70) return "Minor Improvements";
  if (value >= 60) return "Preparation";
  return "Foundation Building";
}

function generalBand(value: number): string {
  if (value >= 90) return "Excellent";
  if (value >= 80) return "Strong";
  if (value >= 70) return "Healthy";
  if (value >= 60) return "Fair";
  if (value >= 40) return "Developing";
  return "Foundation Building";
}

const NO_DATA_BAND = "Not enough data";

/**
 * Combine a score's components: weighted average over the present ones,
 * renormalizing weights so excluded components don't deflate the result.
 */
function buildScore(
  key: string,
  label: string,
  components: Component[],
  bandFor: (value: number) => string,
): ReadinessResult {
  const present = components.filter((c) => c.present);
  const totalWeight = present.reduce((sum, c) => sum + c.weight, 0);
  // A score is partial if any expected component was excluded.
  const partial = present.length < components.length;

  if (present.length === 0 || totalWeight === 0) {
    return {
      key,
      label,
      value: 0,
      band: NO_DATA_BAND,
      partial: true,
      helpingFactor: null,
      hurtingFactor: null,
    };
  }

  const value = clamp(
    present.reduce((sum, c) => sum + c.value * c.weight, 0) / totalWeight,
  );

  // Strongest present component helps most; weakest hurts most.
  const sorted = [...present].sort((a, b) => b.value - a.value);
  const strongest = sorted[0]!;
  const weakest = sorted[sorted.length - 1]!;

  return {
    key,
    label,
    value,
    band: bandFor(value),
    partial,
    helpingFactor: strongest.helps,
    hurtingFactor: weakest.hurts,
  };
}

// ---- Component sub-scorers (each returns a 0-100 value) -------------------

// Credit score 300-850 -> 0-100.
const creditValue = (creditScore: number) =>
  clamp(((creditScore - 300) / 550) * 100);

// Down-payment / savings cushion: $40k reads as fully ready.
const savingsValue = (cashSavings: number) => clamp((cashSavings / 40000) * 100);

// Debt-to-income: lower is healthier. Ratio of total debt to annual income.
const dtiValue = (totalDebt: number, monthlyIncome: number) => {
  const annualIncome = Math.max(monthlyIncome * 12, 1);
  return clamp(100 - (totalDebt / annualIncome) * 100);
};

// Emergency fund: months of expenses covered by cash; 6 months = full.
const emergencyValue = (cashSavings: number, monthlyExpenses: number) =>
  clamp((cashSavings / Math.max(monthlyExpenses, 1) / 6) * 100);

// Monthly surplus as a share of income (savings rate).
const surplusValue = (monthlyIncome: number, monthlyExpenses: number) =>
  monthlyIncome > 0
    ? clamp(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100)
    : 0;

// Investable / other assets: $50k reads as fully built.
const assetsValue = (otherAssets: number) => clamp((otherAssets / 50000) * 100);

// Liquidity: cash on hand; $20k reads as ample.
const liquidityValue = (cashSavings: number) =>
  clamp((cashSavings / 20000) * 100);

// Capital available to deploy: cash + other assets; $50k reads as ample.
const capitalValue = (cashSavings: number, otherAssets: number) =>
  clamp(((cashSavings + otherAssets) / 50000) * 100);

/**
 * Compute all readiness scores for a profile. Presence of a field is whether
 * the user has EXPLICITLY captured it (its key is in `capturedFields`) — NOT
 * `value > 0`. This is what closes the $0-vs-unfilled gap: a captured 0 (e.g.
 * confirmed "no debt") is present and real, while an unfilled default 0 stays
 * unknown and is excluded. Income-stability and credit utilization / payment
 * history are not captured yet, so any component relying on them is always
 * excluded and its score marked partial.
 */
export function computeReadiness(p: Profile): ReadinessResult[] {
  const captured = new Set(p.capturedFields ?? []);
  const hasIncome = captured.has("monthlyIncome");
  const hasExpenses = captured.has("monthlyExpenses");
  const hasSavings = captured.has("cashSavings");
  const hasAssets = captured.has("otherAssets");
  const hasCredit = captured.has("creditScore");
  // A captured debt figure may legitimately be $0 ("I have no debt"); only then
  // is debt-to-income real. We still gate DTI on income being captured too, so
  // an unknown debt balance never masquerades as perfect debt health.
  const hasDebt = captured.has("totalDebt");

  // Shared component definitions (built once, reused across scores).
  const credit: Component = {
    weight: 25,
    present: hasCredit,
    value: creditValue(p.creditScore),
    helps: "Strong credit score",
    hurts: "Credit score has room to grow",
  };
  const savings: Component = {
    weight: 25,
    present: hasSavings,
    value: savingsValue(p.cashSavings),
    helps: "Healthy savings cushion",
    hurts: "Limited savings so far",
  };
  const dti: Component = {
    weight: 25,
    present: hasIncome && hasDebt,
    value: dtiValue(p.totalDebt, p.monthlyIncome),
    helps: "Low debt relative to income",
    hurts: "High debt relative to income",
  };
  // No income-stability data is stored, so this component is always excluded.
  const incomeStability: Component = {
    weight: 25,
    present: false,
    value: 0,
    helps: "Stable, dependable income",
    hurts: "Income stability not captured yet",
  };

  const homeownership = buildScore(
    "homeownership",
    "Homeownership",
    [credit, savings, dti, incomeStability],
    homeownershipBand,
  );

  // Credit health: credit score is captured; utilization and payment history
  // are not, so those components are excluded (partial).
  const creditHealth = buildScore(
    "credit",
    "Credit",
    [
      { ...credit, weight: 60 },
      {
        weight: 25,
        present: false,
        value: 0,
        helps: "Low credit utilization",
        hurts: "Credit utilization not captured yet",
      },
      {
        weight: 15,
        present: false,
        value: 0,
        helps: "Clean payment history",
        hurts: "Payment history not captured yet",
      },
    ],
    generalBand,
  );

  // Debt health: debt-to-income is captured; utilization and interest burden
  // are not.
  const debtHealth = buildScore(
    "debt",
    "Debt",
    [
      { ...dti, weight: 60 },
      {
        weight: 25,
        present: false,
        value: 0,
        helps: "Low credit utilization",
        hurts: "Credit utilization not captured yet",
      },
      {
        weight: 15,
        present: false,
        value: 0,
        helps: "Manageable interest burden",
        hurts: "Interest burden not captured yet",
      },
    ],
    generalBand,
  );

  const investing = buildScore(
    "investing",
    "Investment",
    [
      {
        weight: 25,
        present: hasSavings,
        value: liquidityValue(p.cashSavings),
        helps: "Good liquidity",
        hurts: "Low liquidity",
      },
      {
        weight: 25,
        present: hasSavings && hasExpenses,
        value: emergencyValue(p.cashSavings, p.monthlyExpenses),
        helps: "Solid emergency fund",
        hurts: "Emergency fund is thin",
      },
      {
        ...dti,
        weight: 25,
        helps: "Manageable debt load",
        hurts: "Heavy debt load",
      },
      { ...incomeStability, weight: 25 },
    ],
    generalBand,
  );

  const passiveIncome = buildScore(
    "passive_income",
    "Passive Income",
    [
      {
        weight: 40,
        present: hasSavings || hasAssets,
        value: capitalValue(p.cashSavings, p.otherAssets),
        helps: "Capital available to deploy",
        hurts: "Limited capital to deploy",
      },
      {
        weight: 30,
        present: hasIncome && hasExpenses,
        value: surplusValue(p.monthlyIncome, p.monthlyExpenses),
        helps: "Positive monthly surplus",
        hurts: "Little monthly surplus",
      },
      {
        weight: 30,
        present: hasAssets,
        value: assetsValue(p.otherAssets),
        helps: "Existing investments at work",
        hurts: "Few investments yet",
      },
    ],
    generalBand,
  );

  const wealth = buildScore(
    "wealth",
    "Wealth",
    [
      { ...incomeStability, weight: 20 },
      { ...savings, weight: 20 },
      {
        ...dti,
        weight: 20,
        helps: "Debt well managed",
        hurts: "Debt weighs on net worth",
      },
      { ...credit, weight: 20 },
      {
        weight: 20,
        present: hasAssets,
        value: assetsValue(p.otherAssets),
        helps: "Assets building net worth",
        hurts: "Few assets building net worth",
      },
    ],
    generalBand,
  );

  // Keep the order aligned with the legacy computeScores ordering.
  return [
    homeownership,
    investing,
    creditHealth,
    debtHealth,
    wealth,
    passiveIncome,
  ];
}

/**
 * Recompute readiness scores for a user, persist them (upsert one row per
 * key), and append a score_history row whenever a score's value or band
 * changed. Returns the freshly computed results.
 */
export async function persistReadinessScores(
  userId: number,
): Promise<ReadinessResult[]> {
  const profile = await getOrCreateProfile(userId);
  const results = computeReadiness(profile);

  const existing = await db
    .select()
    .from(scoresTable)
    .where(eq(scoresTable.userId, userId));
  const prevByKey = new Map(existing.map((row) => [row.key, row]));

  for (const r of results) {
    const prev = prevByKey.get(r.key);
    const changed = !prev || prev.value !== r.value || prev.band !== r.band;

    await db
      .insert(scoresTable)
      .values({
        userId,
        key: r.key,
        value: r.value,
        band: r.band,
        helpingFactor: r.helpingFactor,
        hurtingFactor: r.hurtingFactor,
        partial: r.partial,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [scoresTable.userId, scoresTable.key],
        set: {
          value: r.value,
          band: r.band,
          helpingFactor: r.helpingFactor,
          hurtingFactor: r.hurtingFactor,
          partial: r.partial,
          updatedAt: new Date(),
        },
      });

    if (changed) {
      await db.insert(scoreHistory).values({
        userId,
        key: r.key,
        value: r.value,
        band: r.band,
      });
    }
  }

  return results;
}
