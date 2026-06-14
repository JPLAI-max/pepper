import {
  db,
  opportunities,
  roadmapSteps,
  documents,
  goals,
  pool,
} from "@workspace/db";

async function seed() {
  const existing = await db.select().from(opportunities).limit(1);
  if (existing.length > 0) {
    console.log("Already seeded — skipping.");
    await pool.end();
    return;
  }

  await db.insert(opportunities).values([
    {
      kind: "lending",
      title: "First-Home Conventional Loan",
      summary: "Competitive fixed-rate mortgage for first-time buyers.",
      detail:
        "A 30-year fixed conventional mortgage with as little as 3% down for qualified first-time buyers. Predictable payments and no surprises.",
      rate: "6.75% APR",
      term: "30-year fixed",
      minAmount: 0,
      tag: "First-Time Buyer",
      recommended: true,
    },
    {
      kind: "lending",
      title: "HELOC — Home Equity Line",
      summary: "Tap your home's equity for renovations or your next move.",
      detail:
        "A flexible line of credit secured by your home equity. Borrow what you need, when you need it, and only pay interest on what you use.",
      rate: "8.25% variable",
      term: "10-year draw",
      minAmount: 10000,
      tag: "Equity",
      recommended: false,
    },
    {
      kind: "lending",
      title: "DSCR Investment Property Loan",
      summary: "Finance a rental based on the property's income, not yours.",
      detail:
        "Debt-Service Coverage Ratio loans qualify you on the rental income of the property itself — ideal for building a real-estate portfolio.",
      rate: "7.50% APR",
      term: "30-year fixed",
      minAmount: 75000,
      tag: "Rental Income",
      recommended: true,
    },
    {
      kind: "investment",
      title: "Fractional Real Estate Fund",
      summary: "Own a slice of income-producing properties — start small.",
      detail:
        "Pool with other investors to own shares of cash-flowing residential properties. Earn quarterly distributions without being a landlord.",
      rate: "8–10% target",
      term: "Flexible",
      minAmount: 500,
      tag: "Passive Income",
      recommended: true,
    },
    {
      kind: "investment",
      title: "High-Yield Savings Builder",
      summary: "A safe place to grow your down-payment fund.",
      detail:
        "Park your savings in an FDIC-insured high-yield account while you prepare for your goals. Liquid, safe, and earning.",
      rate: "4.40% APY",
      term: "No lock-up",
      minAmount: 0,
      tag: "Safety Net",
      recommended: false,
    },
    {
      kind: "investment",
      title: "REIT Index Portfolio",
      summary: "Diversified real estate exposure through public REITs.",
      detail:
        "Invest in a basket of real estate investment trusts spanning residential, industrial, and commercial properties for broad diversification.",
      rate: "Market-based",
      term: "Long-term",
      minAmount: 100,
      tag: "Diversified",
      recommended: false,
    },
  ]);

  await db.insert(roadmapSteps).values([
    {
      title: "Complete your financial snapshot",
      description:
        "Tell Pep about your income, savings, and debt so your plan is truly yours.",
      status: "in_progress",
      orderIndex: 0,
      actionLabel: "Update snapshot",
    },
    {
      title: "Build a 3-month safety net",
      description:
        "Set aside a cushion that covers three months of expenses before investing.",
      status: "todo",
      orderIndex: 1,
      actionLabel: "Set savings goal",
    },
    {
      title: "Check and understand your credit",
      description:
        "Know your score and the small habits that strengthen it over time.",
      status: "todo",
      orderIndex: 2,
      actionLabel: "Add credit score",
    },
    {
      title: "Map your path to a down payment",
      description:
        "We'll figure out your target and a comfortable monthly savings plan.",
      status: "todo",
      orderIndex: 3,
      actionLabel: "Plan down payment",
    },
    {
      title: "Explore your first opportunity",
      description:
        "Once you're ready, take a first look at lending and investment options.",
      status: "todo",
      orderIndex: 4,
      actionLabel: "View opportunities",
    },
  ]);

  await db.insert(documents).values([
    { name: "Recent pay stubs (last 2)", category: "Income", status: "needed", orderIndex: 0 },
    { name: "W-2 / 1099 forms", category: "Income", status: "needed", orderIndex: 1 },
    { name: "Bank statements (last 2 months)", category: "Assets", status: "needed", orderIndex: 2 },
    { name: "Government-issued ID", category: "Identity", status: "needed", orderIndex: 3 },
    { name: "Credit report", category: "Credit", status: "needed", orderIndex: 4 },
    { name: "Tax returns (last 2 years)", category: "Income", status: "needed", orderIndex: 5 },
  ]);

  await db.insert(goals).values([
    {
      title: "Save for a home down payment",
      category: "homeownership",
      targetAmount: 40000,
      currentAmount: 6500,
      status: "active",
      priority: 10,
      note: "Aiming for a 3-bed starter home.",
    },
  ]);

  console.log("Seed complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
