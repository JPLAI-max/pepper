import { eq, inArray } from "drizzle-orm";
import {
  db,
  goals as goalsTable,
  roadmapSteps,
  ROADMAP_HORIZONS,
  type Goal,
  type Profile,
} from "@workspace/db";
import { getOrCreateProfile } from "./identity";
import { computeReadiness, type ReadinessResult } from "./scoring";

/**
 * Deterministic, educational roadmap engine.
 *
 * Rules (mirror the scoring engine):
 * - Pure function of the user's stored numbers + primary goal + scores. No AI,
 *   no randomness, no advice, never "you qualify" / "buy this".
 * - Every quantified figure is a stored value or simple arithmetic clearly
 *   derived from stored values (e.g. surplus = income - expenses). If a figure
 *   needed for a step is NOT present, the step falls back to a specific
 *   non-numeric action — we never fabricate a number.
 * - The primary obstacle for the goal is the weakest PRESENT component among the
 *   components that matter for that goal; it maps to a single roadmap focus.
 */

export type RoadmapHorizon = (typeof ROADMAP_HORIZONS)[number];

export interface RoadmapPosition {
  goalTitle: string | null;
  goalCategory: string | null;
  /** The readiness score matching the goal category, if computable. */
  focusScore: { key: string; value: number; band: string } | null;
  netWorth: number;
  /** income - expenses; null when either is not stored. */
  monthlySurplus: number | null;
  /** True when key inputs for the goal are missing. */
  partial: boolean;
}

export interface RoadmapObstacle {
  /** credit | debt | savings | cashflow */
  key: string;
  label: string;
  /** The roadmap focus this obstacle drives. */
  focus: string;
  detail: string;
  /** Component value 0-100; null when no relevant data is present. */
  value: number | null;
}

export interface RoadmapOpportunity {
  key: string;
  label: string;
  detail: string;
  /** Quantified only from stored numbers; null when not derivable. */
  monthlyImpact: number | null;
  annualImpact: number | null;
}

export interface RoadmapPlanStep {
  horizon: RoadmapHorizon;
  action: string;
  detail: string | null;
  status: string;
  order: number;
  /**
   * Deterministic key (`<horizon>:<focus>`) identifying what this step IS,
   * independent of its wording. persistRoadmap uses it to preserve the user's
   * status across regenerations. Stable across runs for the same situation.
   */
  key: string;
  /** Present only when the step is read from a persisted roadmap_steps row. */
  id?: number;
}

export interface RoadmapPlan {
  position: RoadmapPosition;
  primaryObstacle: RoadmapObstacle | null;
  opportunities: RoadmapOpportunity[];
  steps: RoadmapPlanStep[];
}

const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Math.round(n)));

const usd = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

// Component sub-scores (kept in step with lib/scoring so the obstacle the
// roadmap names matches the readiness scores the user sees).
const creditValue = (creditScore: number) =>
  clamp(((creditScore - 300) / 550) * 100);
const savingsValue = (cashSavings: number) => clamp((cashSavings / 40000) * 100);
const dtiValue = (totalDebt: number, monthlyIncome: number) =>
  clamp(100 - (totalDebt / Math.max(monthlyIncome * 12, 1)) * 100);
const surplusRate = (monthlyIncome: number, monthlyExpenses: number) =>
  monthlyIncome > 0
    ? clamp(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100)
    : 0;

// Friendly noun for the goal, used inside grounded step copy.
function goalNoun(category: string | null): string {
  switch (category) {
    case "homeownership":
      return "down-payment";
    case "investing":
      return "investment";
    case "passive_income":
      return "passive-income";
    case "debt":
      return "debt-payoff";
    case "credit":
      return "credit-building";
    case "wealth":
      return "wealth";
    default:
      return "goal";
  }
}

// Which obstacle components matter for each goal category.
function relevantFocuses(category: string | null): string[] {
  switch (category) {
    case "homeownership":
      return ["credit", "savings", "debt", "cashflow"];
    case "credit":
      return ["credit", "cashflow"];
    case "debt":
      return ["debt", "cashflow"];
    case "investing":
      return ["savings", "cashflow"];
    case "passive_income":
      return ["savings", "cashflow"];
    case "wealth":
    default:
      return ["credit", "savings", "debt", "cashflow"];
  }
}

interface ObstacleCandidate {
  key: string;
  focus: string;
  label: string;
  present: boolean;
  value: number;
  detail: string;
}

/** Pick the user's primary goal: highest priority, then most recent. */
export function primaryGoal(goals: Goal[]): Goal | null {
  const active = goals.filter((g) => g.status === "active");
  const pool = active.length > 0 ? active : goals;
  if (pool.length === 0) return null;
  return [...pool].sort(
    (a, b) =>
      b.priority - a.priority ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  )[0]!;
}

/**
 * Compute the structured roadmap from a profile, the user's goals, and the
 * already-computed readiness scores. Pure and deterministic.
 */
export function computeRoadmap(
  p: Profile,
  goals: Goal[],
  scores: ReadinessResult[],
): RoadmapPlan {
  const hasIncome = p.monthlyIncome > 0;
  const hasExpenses = p.monthlyExpenses > 0;
  const hasSavings = p.cashSavings > 0;
  const hasDebt = p.totalDebt > 0;
  const hasCredit = p.creditScore > 0;

  const goal = primaryGoal(goals);
  const category = goal?.category ?? null;
  const noun = goalNoun(category);
  // "your <noun> goal" reads as "your goal goal" when there is no goal yet, so
  // collapse it to a single word in that case.
  const goalLabel = noun === "goal" ? "goal" : `${noun} goal`;

  const monthlySurplus =
    hasIncome && hasExpenses ? p.monthlyIncome - p.monthlyExpenses : null;
  const netWorth = p.cashSavings + p.otherAssets - p.totalDebt;

  const focusScore = category
    ? (() => {
        const s = scores.find((x) => x.key === category);
        return s ? { key: s.key, value: s.value, band: s.band } : null;
      })()
    : null;

  // ---- Primary obstacle: weakest present relevant component ----------------
  const candidates: ObstacleCandidate[] = [
    {
      key: "credit",
      focus: "credit",
      label: "Credit improvement",
      present: hasCredit,
      value: creditValue(p.creditScore),
      detail: `Your credit score of ${p.creditScore} has the most room to strengthen your ${noun} plan.`,
    },
    {
      key: "savings",
      focus: "savings",
      label: "Savings acceleration",
      present: hasSavings,
      value: savingsValue(p.cashSavings),
      detail: `Your savings of ${usd(p.cashSavings)} is the biggest lever to move toward your ${goalLabel}.`,
    },
    {
      key: "debt",
      focus: "debt",
      label: "Debt reduction",
      present: hasIncome && hasDebt,
      value: dtiValue(p.totalDebt, p.monthlyIncome),
      detail: `Your debt of ${usd(p.totalDebt)} relative to income is the biggest weight on your ${noun} plan.`,
    },
    {
      key: "cashflow",
      focus: "cashflow",
      label: "Expense optimization",
      present: hasIncome && hasExpenses,
      value: surplusRate(p.monthlyIncome, p.monthlyExpenses),
      detail:
        monthlySurplus !== null && monthlySurplus <= 0
          ? `Your spending (${usd(p.monthlyExpenses)}/mo) meets or exceeds your income (${usd(p.monthlyIncome)}/mo), leaving nothing to put toward your ${goalLabel}.`
          : `Tightening monthly spending frees up more to direct at your ${goalLabel}.`,
    },
  ];

  const relevant = relevantFocuses(category);
  const present = candidates.filter(
    (c) => c.present && relevant.includes(c.focus),
  );

  let primaryObstacle: RoadmapObstacle | null = null;
  if (present.length > 0) {
    const weakest = [...present].sort((a, b) => a.value - b.value)[0]!;
    primaryObstacle = {
      key: weakest.key,
      label: weakest.label,
      focus: weakest.focus,
      detail: weakest.detail,
      value: weakest.value,
    };
  }

  const focus = primaryObstacle?.focus ?? "savings";
  const partial = present.length < relevant.length;

  // ---- Opportunities: grounded in stored numbers only ---------------------
  const opportunities: RoadmapOpportunity[] = [];

  if (monthlySurplus !== null && monthlySurplus > 0) {
    opportunities.push({
      key: "surplus",
      label: "Put your monthly surplus to work",
      detail: `Redirect your ${usd(monthlySurplus)}/mo surplus into a dedicated ${noun} account.`,
      monthlyImpact: monthlySurplus,
      annualImpact: monthlySurplus * 12,
    });
  } else if (monthlySurplus !== null && monthlySurplus <= 0) {
    opportunities.push({
      key: "cashflow",
      label: "Close the gap between income and spending",
      detail: `Your spending (${usd(p.monthlyExpenses)}/mo) meets or exceeds your income (${usd(p.monthlyIncome)}/mo). Trimming recurring costs frees money for your ${goalLabel}.`,
      monthlyImpact: null,
      annualImpact: null,
    });
  }

  if (hasDebt) {
    opportunities.push({
      key: "debt",
      label: "Reduce high-interest debt",
      detail: `You carry ${usd(p.totalDebt)} in total debt. Paying the highest-interest balances down first lowers what you owe and improves your debt-to-income.`,
      monthlyImpact: null,
      annualImpact: null,
    });
  }

  // Per-category leaks (dining, subscriptions, car payment) are not stored, so
  // we ask for the numbers rather than inventing them.
  opportunities.push({
    key: "leaks",
    label: "Audit recurring spending",
    detail:
      "Review recurring charges — dining, subscriptions, and any oversized car payment — for the easiest cuts. Share the amounts and Pepper will quantify the impact.",
    monthlyImpact: null,
    annualImpact: null,
  });

  // ---- Horizon steps: specific and grounded -------------------------------
  const steps: RoadmapPlanStep[] = [];
  let order = 0;
  // `segment` is the deterministic focus of the step (e.g. "fund", "credit").
  // Combined with the horizon it forms a stable key so status survives
  // regeneration as long as the step's nature is unchanged.
  const add = (
    horizon: RoadmapHorizon,
    segment: string,
    action: string,
    detail?: string,
  ) => {
    steps.push({
      horizon,
      key: `${horizon}:${segment}`,
      action,
      detail: detail ?? null,
      status: "todo",
      order: order++,
    });
  };

  // Immediate
  if (monthlySurplus !== null && monthlySurplus > 0) {
    add(
      "immediate",
      "fund",
      `Open a dedicated ${noun} account and move your first ${usd(monthlySurplus)} into it this week.`,
    );
  } else if (focus === "credit") {
    add(
      "immediate",
      "credit",
      "Pull your free credit report from all three bureaus and flag any errors to dispute.",
    );
  } else if (focus === "debt") {
    add(
      "immediate",
      "debt",
      "List every debt with its balance and interest rate so the most expensive one can be targeted first.",
    );
  } else if (focus === "cashflow") {
    add(
      "immediate",
      "cashflow",
      "Track every expense for one week to see exactly where your money goes.",
    );
  } else {
    add(
      "immediate",
      "foundation",
      `Open a dedicated ${noun} account so your progress is separate and visible.`,
    );
  }

  // 30-Day
  if (monthlySurplus !== null && monthlySurplus > 0) {
    add(
      "30_day",
      "automate",
      `Automate a recurring ${usd(monthlySurplus)}/mo transfer into your ${noun} account on payday.`,
    );
  } else if (focus === "credit") {
    add(
      "30_day",
      "credit",
      "Bring every credit card balance well below its limit and set autopay so no due date is missed.",
    );
  } else if (focus === "debt") {
    add(
      "30_day",
      "debt",
      "Make every minimum payment and put any extra toward the highest-interest balance.",
    );
  } else if (focus === "cashflow") {
    add(
      "30_day",
      "cashflow",
      "Cancel or pause your least-used recurring subscriptions and redirect that money to your goal.",
    );
  } else {
    add(
      "30_day",
      "foundation",
      `Set a specific monthly ${noun} target and automate the transfer.`,
    );
  }

  // 90-Day
  if (hasExpenses) {
    add(
      "90_day",
      "emergency",
      `Build a starter emergency fund of ${usd(p.monthlyExpenses * 3)} (about three months of expenses) so setbacks don't derail your plan.`,
    );
  } else if (focus === "credit") {
    add(
      "90_day",
      "credit",
      "Keep utilization low and payments on time across several statement cycles to start moving your score.",
    );
  } else if (hasDebt) {
    add(
      "90_day",
      "debt",
      "Pay your highest-interest debt down by a meaningful chunk and re-check your debt-to-income.",
    );
  } else {
    add(
      "90_day",
      "review",
      "Review your progress with Pepper and adjust your monthly target.",
    );
  }

  // 1-Year
  if (monthlySurplus !== null && monthlySurplus > 0) {
    add(
      "1_year",
      "pace",
      `At your current ${usd(monthlySurplus)}/mo pace you'll set aside about ${usd(monthlySurplus * 12)} this year — earmark it for your ${goalLabel}.`,
    );
  } else if (focus === "credit") {
    add(
      "1_year",
      "credit",
      "Aim to move your credit score into the next tier through a full year of on-time payments and low utilization.",
    );
  } else if (hasDebt) {
    add(
      "1_year",
      "debt",
      "Target paying off your smallest debt entirely to free up cash flow.",
    );
  } else {
    add(
      "1_year",
      "review",
      `Revisit your ${noun} amount and timeline with Pepper and set next year's target.`,
    );
  }

  // 5-Year
  if (category === "homeownership") {
    add(
      "5_year",
      "home",
      "Stay on pace so your down-payment fund reaches what your target home requires, then revisit financing options with Pepper.",
    );
  } else {
    add(
      "5_year",
      "reassess",
      `Reassess your full picture each year — as income grows, raise your automated contributions so your ${goalLabel} accelerates.`,
    );
  }

  return {
    position: {
      goalTitle: goal?.title ?? null,
      goalCategory: category,
      focusScore,
      netWorth,
      monthlySurplus,
      partial,
    },
    primaryObstacle,
    opportunities,
    steps,
  };
}

/**
 * Regenerate and persist the roadmap for a user: compute the plan from the
 * current profile + goals + scores, REPLACE the user's roadmap_steps rows with
 * the new horizon steps, and return the plan with the persisted steps (so they
 * carry ids). Owns its errors at the call site; runs on the recompute path.
 */
export async function persistRoadmap(userId: number): Promise<RoadmapPlan> {
  const profile = await getOrCreateProfile(userId);
  const goals = await db
    .select()
    .from(goalsTable)
    .where(eq(goalsTable.userId, userId));
  const scores = computeReadiness(profile);
  const plan = computeRoadmap(profile, goals, scores);

  const goalId = goals.length > 0 ? primaryGoal(goals)?.id ?? null : null;

  // Status-preserving reconcile (NOT delete-and-rebuild): a step keyed the same
  // as an existing row keeps that row's status (so a user's "done" survives
  // regeneration); a newly-relevant step is inserted as not-started; a row
  // whose key no longer appears — including legacy/manual rows with no key — is
  // removed. The roadmap is engine-owned.
  const persistedSteps = await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(roadmapSteps)
      .where(eq(roadmapSteps.userId, userId));
    const byKey = new Map(
      existing.filter((r) => r.stableKey).map((r) => [r.stableKey!, r]),
    );
    const desiredKeys = new Set(plan.steps.map((s) => s.key));

    const obsolete = existing.filter(
      (r) => !r.stableKey || !desiredKeys.has(r.stableKey),
    );
    if (obsolete.length > 0) {
      await tx.delete(roadmapSteps).where(
        inArray(
          roadmapSteps.id,
          obsolete.map((r) => r.id),
        ),
      );
    }

    const rows: (typeof existing)[number][] = [];
    for (const s of plan.steps) {
      const prev = byKey.get(s.key);
      if (prev) {
        const [row] = await tx
          .update(roadmapSteps)
          .set({
            title: s.action,
            description: s.detail,
            orderIndex: s.order,
            horizon: s.horizon,
            goalId,
            // status intentionally NOT set — the user's progress is preserved.
          })
          .where(eq(roadmapSteps.id, prev.id))
          .returning();
        if (row) rows.push(row);
      } else {
        const [row] = await tx
          .insert(roadmapSteps)
          .values({
            userId,
            stableKey: s.key,
            title: s.action,
            description: s.detail,
            status: s.status,
            orderIndex: s.order,
            horizon: s.horizon,
            goalId,
          })
          .returning();
        if (row) rows.push(row);
      }
    }
    return rows.sort((a, b) => a.orderIndex - b.orderIndex);
  });

  return {
    ...plan,
    steps: persistedSteps.map((row) => ({
      id: row.id,
      horizon: (row.horizon ?? "immediate") as RoadmapHorizon,
      key: row.stableKey ?? "",
      action: row.title,
      detail: row.description,
      status: row.status,
      order: row.orderIndex,
    })),
  };
}
