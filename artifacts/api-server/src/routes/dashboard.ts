import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, goals, roadmapSteps, documents } from "@workspace/db";
import { getOrCreateProfile } from "../lib/identity";
import { getSessionUserId, requireAuth } from "../lib/auth";

const router: IRouter = Router();

// GET /dashboard/summary — header figures + progress counts for the session
// user. Deliberately NARROW: it owns only the money snapshot, goal/document
// counts, and the single "next step" used by the hero CTA. Readiness scores,
// the roadmap, and opportunity matches are NOT duplicated here — the client
// reads them from GET /scores, GET /roadmap and GET /opportunities/matches so
// the dashboard always reflects the exact same engine output as those pages.
//
// Money figures are gated on the profile's EXPLICITLY captured fields (mirrors
// lib/scoring / lib/roadmap): a value is returned only when its inputs were
// actually captured, otherwise it is null and the client hides the figure. A
// captured 0 is real; an unfilled default 0 must never render as a fabricated
// "$0".
router.get("/dashboard/summary", requireAuth, async (req, res) => {
  const userId = getSessionUserId(req)!;
  const profile = await getOrCreateProfile(userId);
  const [allGoals, steps, docs] = await Promise.all([
    db.select().from(goals).where(eq(goals.userId, userId)),
    db
      .select()
      .from(roadmapSteps)
      .where(eq(roadmapSteps.userId, userId))
      .orderBy(asc(roadmapSteps.orderIndex), asc(roadmapSteps.createdAt)),
    db.select().from(documents).where(eq(documents.userId, userId)),
  ]);

  const captured = new Set(profile.capturedFields ?? []);
  const hasIncome = captured.has("monthlyIncome");
  const hasExpenses = captured.has("monthlyExpenses");
  const hasSavings = captured.has("cashSavings");
  const hasOtherAssets = captured.has("otherAssets");
  const hasDebt = captured.has("totalDebt");

  const hasAssets = hasSavings || hasOtherAssets;
  const totalAssets = hasAssets
    ? (hasSavings ? profile.cashSavings : 0) +
      (hasOtherAssets ? profile.otherAssets : 0)
    : null;
  const totalDebt = hasDebt ? profile.totalDebt : null;
  // Net worth is meaningful only when we have both an asset figure AND a debt
  // figure — otherwise we'd be assuming the missing side is zero.
  const netWorth =
    hasAssets && hasDebt ? (totalAssets as number) - (totalDebt as number) : null;
  const monthlyCashflow =
    hasIncome && hasExpenses
      ? profile.monthlyIncome - profile.monthlyExpenses
      : null;

  const nextStep =
    steps.find((s) => s.status === "in_progress") ??
    steps.find((s) => s.status === "todo") ??
    null;

  res.json({
    netWorth,
    monthlyCashflow,
    totalAssets,
    totalDebt,
    activeGoals: allGoals.filter((g) => g.status === "active").length,
    achievedGoals: allGoals.filter((g) => g.status === "achieved").length,
    documentsComplete: docs.filter((d) => d.status === "complete").length,
    documentsTotal: docs.length,
    nextStep,
  });
});

export default router;
