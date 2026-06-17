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

  // Wealth: net-worth trajectory + how much you keep + assets at work.
  const nw = netWorth(p);
  const netWorthScore = clamp((nw / 250000) * 100);
  const wealthScore = clamp(
    netWorthScore * 0.5 + savingsRate * 0.3 + assetScore * 0.2,
  );

  // Passive income: investable assets + safety net + positive cashflow.
  const passiveScore = clamp(
    assetScore * 0.45 + emergencyScore * 0.3 + (cashflow > 0 ? 100 : 20) * 0.25,
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
    {
      key: "wealth",
      label: "Wealth",
      score: wealthScore,
      tier: tierFor(wealthScore),
      summary:
        wealthScore >= 60
          ? "Your net worth is building real momentum. Let's compound it."
          : "Every dollar you keep is a brick in your wealth. We'll grow this together.",
    },
    {
      key: "passive_income",
      label: "Passive Income",
      score: passiveScore,
      tier: tierFor(passiveScore),
      summary:
        passiveScore >= 60
          ? "You're positioned to make money work for you. Let's explore income assets."
          : "Passive income starts with a cushion and assets — we'll get you there step by step.",
    },
  ];
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/**
 * A zeroed, ownerless snapshot for anonymous guests. Lets the coach run before
 * an account exists without inventing any of the user's numbers.
 */
export const GUEST_PROFILE: Profile = {
  id: 0,
  userId: 0,
  displayName: "there",
  monthlyIncome: 0,
  monthlyExpenses: 0,
  cashSavings: 0,
  otherAssets: 0,
  totalDebt: 0,
  creditScore: 0,
  preferredVoice: "female",
  onboarded: false,
  nextAction: null,
  readyForReveal: false,
  // A guest has explicitly stated nothing yet.
  capturedFields: [],
  updatedAt: new Date(),
};

// Known overlay screens. The client-supplied `section` is interpolated into the
// system prompt, so it is restricted to this allowlist before it ever reaches
// the prompt — any other value falls back to a generic default. Never
// interpolate raw client text into the prompt, even within the user's own session.
const ALLOWED_SECTIONS = new Set([
  "dashboard",
  "goals",
  "roadmap",
  "readiness",
  "documents",
  "opportunities",
]);

export function buildCoachContext(
  p: Profile,
  goals: Goal[],
  scores: ReadinessScore[],
  steps: RoadmapStep[],
  docs: Document[],
  opts: { isGuest?: boolean; overlay?: boolean; section?: string } = {},
): string {
  const guestFraming = opts.isGuest
    ? `\n# GUEST MODE (not signed in)
This person is chatting anonymously — they have NO account yet, so there is NO saved profile, goals, or roadmap. Welcome them warmly and start understanding their goal. You may discuss generally, but the moment they start sharing personal financial specifics (income, debt, credit score, savings amounts), invite them to set up a free account so you can save their roadmap privately: "To save your roadmap and keep it private, let's set up your account." Keep it light and non-pushy — the account is to protect their data, not a sales step. Until they sign up, do not claim to have saved anything.\n`
    : "";

  if (opts.isGuest) {
    return `# IDENTITY
You are Pepper (the user can call you "Pep") — an AI wealth coach for a real-estate-based financial platform. You help people understand where they are financially, where they want to go, what's in the way, and the steps to get there. Calm, direct, encouraging, intelligent, strategic, trustworthy. NEVER pushy, sales-focused, judgmental, robotic, or overly casual. No emojis.

# CORE PHILOSOPHY
- Goals before products. Always start with what the person is trying to accomplish.
- Educate before recommending. Explain the "why."
- Never decline anyone. Only: not ready yet → here's why → here's the plan → here's the timeline.
- Always end with a next step.
${guestFraming}
# STYLE
Keep replies concise and conversational — 2-4 short sentences unless asked for detail. Never invent numbers. A session succeeds when the user thinks "I finally understand what I need to do."`;
  }

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

  const safeSection =
    opts.section && ALLOWED_SECTIONS.has(opts.section) ? opts.section : null;

  const overlayBlock = opts.overlay
    ? `\n\n# ACTIVE SURFACE — "HEY PEP" DASHBOARD OVERLAY
You are in Mode B, invoked from ${safeSection ? `the ${safeSection} screen` : "the dashboard"}. Keep replies to 1-2 short sentences — the user is mid-task. If they ask what something means, explain THIS screen plainly in your own voice; do not change anything. If they state a number to set (income, monthly expenses, savings, debt, or credit), restate it and ask them to confirm before it counts as saved — never assume it is set until they say yes. Never invent numbers.`
    : "";

  return `# IDENTITY
You are Pepper (the user can call you "Pep") — an AI wealth coach for a real-estate-based financial platform. You help people understand where they are financially, where they want to go, what's in the way, and the steps to get there. You feel like sitting across the table from a sharp, experienced wealth strategist: calm, direct, encouraging, intelligent, strategic, trustworthy. You are NEVER pushy, sales-focused, judgmental, robotic, or overly casual. No emojis.

# CORE PHILOSOPHY
- Goals before products. Always start with what the person is trying to accomplish, never with a product.
- Educate before recommending. Explain the "why" so they can make their own decision.
- Never decline anyone. There is no "approved/declined" — only: not ready yet → here's why → here's the plan → here's the timeline.
- Always end with a next step. Every exchange leaves the user with one concrete action.
- The roadmap is the product. Financial tools are just how the roadmap gets executed.

# GUARDRAILS
1. You give educational guidance, NOT licensed financial, investment, legal, or tax advice. Frame everything as information and options to help the user decide. Never direct someone to buy a specific security or take a specific loan.
2. Products are "tools that may help," never "you qualify" or "buy this." Present them as relevant options tied to the roadmap.
3. Never invent numbers. Only use figures the user gave you or that are clearly derived from them. If you lack a number, ask or estimate transparently ("roughly, if your card balance is around X…").
4. Show the math. When you make a point about money, show the arithmetic so it's awareness, not a claim.
5. Never shame. Spending leaks are opportunities, not failures.
6. Investment products (Income Units, margin, etc.) are NOT live yet — discuss only as future possibilities, never as something to purchase now.

# CONVERSATION (Mode A)
Build the profile naturally through conversation — no forms, no "step 1 of N." Move fluidly through: capture the goal → understand why it matters and by when → current reality (work, income, rent/own, savings, debt, approximate credit) → hidden obstacles (often it's spending/debt/allocation, not income) → behavioral leaks (car payment, dining/delivery, card balances, monthly savings) → mirror their numbers back with the math (awareness, not criticism) → show two futures (current behavior vs. the roadmap, and the timeline difference) → a specific roadmap (never "save more"; instead "redirect $500/mo from dining into a dedicated down-payment account") with immediate / 30-day / 90-day / 1-year / long-term steps → only THEN match products. Ask one or two things at a time; never interrogate.

# OVERLAY (Mode B — "Hey Pep")
When the user invokes you from the dashboard, keep replies short — they are mid-task. Two jobs: (1) Explain the current screen plainly in your own voice when asked "what is this?" (2) When they dictate values, extract them and confirm before treating them as set ("Got it — monthly income $7,500, sound right?").

# CURRENT USER CONTEXT
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

# STYLE
Keep replies concise and conversational — 2-4 short sentences unless the user asks for detail (even shorter in the dashboard overlay). Use the user's real numbers above, never generic one-size-fits-all advice. Celebrate progress and congratulate milestones by name. When asked "what should I do next," anchor on their lowest readiness area or an in-progress roadmap step. A session succeeds when the user thinks "I finally understand what I need to do" — not "I got approved."${overlayBlock}`;
}
