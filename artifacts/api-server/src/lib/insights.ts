import type { Profile, Goal, RoadmapStep, Document } from "@workspace/db";

export interface ReadinessScore {
  key: string;
  label: string;
  score: number;
  tier: string;
  summary: string;
}

const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Math.round(n)));

function tierFor(score: number): string {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Building";
  if (score >= 40) return "Emerging";
  return "Getting started";
}

export function netWorth(p: Profile): number {
  return p.cashSavings + p.otherAssets - p.totalDebt;
}

export function monthlyCashflow(p: Profile): number {
  return p.monthlyIncome - p.monthlyExpenses;
}

export function computeScores(p: Profile): ReadinessScore[] {
  const annualIncome = Math.max(p.monthlyIncome * 12, 1);
  const cashflow = monthlyCashflow(p);
  const savingsRate =
    p.monthlyIncome > 0 ? clamp((cashflow / p.monthlyIncome) * 100) : 0;
  const emergencyMonths =
    p.monthlyExpenses > 0 ? p.cashSavings / p.monthlyExpenses : 0;
  const debtRatio = p.totalDebt / annualIncome;

  // Credit: map 300-850 -> 0-100. Unknown (0) reads as getting started.
  const creditScore =
    p.creditScore > 0 ? clamp(((p.creditScore - 300) / 550) * 100) : 10;

  // Debt health: lower debt-to-income is healthier.
  const debtScore = clamp(100 - debtRatio * 100);

  // Homeownership: down-payment cushion + credit + positive cashflow.
  const downPaymentReadiness = clamp((p.cashSavings / 40000) * 100);
  const homeScore = clamp(
    downPaymentReadiness * 0.4 +
      creditScore * 0.35 +
      (cashflow > 0 ? 100 : 30) * 0.25,
  );

  // Investing: emergency fund + savings rate + existing assets.
  const emergencyScore = clamp((emergencyMonths / 6) * 100);
  const assetScore = clamp((p.otherAssets / 50000) * 100);
  const investScore = clamp(
    emergencyScore * 0.4 + savingsRate * 0.35 + assetScore * 0.25,
  );

  return [
    {
      key: "homeownership",
      label: "Homeownership",
      score: homeScore,
      tier: tierFor(homeScore),
      summary:
        homeScore >= 60
          ? "You're in a solid spot to explore a home purchase. Let's map the path."
          : "We can build toward homeownership step by step — starting with your down payment cushion.",
    },
    {
      key: "investing",
      label: "Investment",
      score: investScore,
      tier: tierFor(investScore),
      summary:
        investScore >= 60
          ? "You have room to put money to work. Let's look at smart options."
          : "Once your safety net is set, investing becomes the next exciting step.",
    },
    {
      key: "credit",
      label: "Credit",
      score: creditScore,
      tier: tierFor(creditScore),
      summary:
        p.creditScore > 0
          ? "Credit opens doors to better rates. Small habits move this number."
          : "Add your credit score and I'll show you exactly how to strengthen it.",
    },
    {
      key: "debt",
      label: "Debt",
      score: debtScore,
      tier: tierFor(debtScore),
      summary:
        debtScore >= 60
          ? "Your debt is well managed relative to your income. Nice work."
          : "Let's create a plan to lighten your debt load at a comfortable pace.",
    },
  ];
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function buildCoachContext(
  p: Profile,
  goals: Goal[],
  scores: ReadinessScore[],
  steps: RoadmapStep[],
  docs: Document[],
): string {
  const goalLines = goals.length
    ? goals
        .map(
          (g) =>
            `- ${g.title} (${g.category}, ${g.status}) target ${fmt(g.targetAmount)}, saved ${fmt(g.currentAmount)}`,
        )
        .join("\n")
    : "- No goals set yet.";

  const scoreLines = scores
    .map((s) => `- ${s.label}: ${s.score}/100 (${s.tier})`)
    .join("\n");

  const stepLines = steps.length
    ? steps
        .map((s) => `- [${s.status}] ${s.title}`)
        .join("\n")
    : "- No roadmap steps yet.";

  const docsComplete = docs.filter((d) => d.status === "complete").length;

  return `You are Pepper (the user can call you "Pep"), a warm, encouraging AI wealth coach focused on real-estate-based wealth building. Your philosophy: goals and roadmap come FIRST, financial products come second. You are friendly, plainspoken, and never judgmental — money topics can feel intimidating, so make them approachable for everyone. Keep replies concise and conversational (2-4 short sentences unless asked for detail). Celebrate progress. Suggest concrete next steps. Never give one-size-fits-all generic advice — use the user's actual numbers below.

USER SNAPSHOT
- Name: ${p.displayName}
- Monthly income: ${fmt(p.monthlyIncome)}, monthly expenses: ${fmt(p.monthlyExpenses)}
- Monthly cashflow: ${fmt(monthlyCashflow(p))}
- Cash savings: ${fmt(p.cashSavings)}, other assets: ${fmt(p.otherAssets)}
- Total debt: ${fmt(p.totalDebt)}, net worth: ${fmt(netWorth(p))}
- Credit score: ${p.creditScore > 0 ? p.creditScore : "not provided"}

READINESS SCORES (educational, not judgmental)
${scoreLines}

GOALS
${goalLines}

ROADMAP
${stepLines}

DOCUMENTS: ${docsComplete} of ${docs.length} filed and complete.

When the user asks "what should I do next", reference their lowest readiness area or an in-progress roadmap step. When they hit a milestone, congratulate them by name.`;
}
