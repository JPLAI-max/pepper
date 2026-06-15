import { Router, type IRouter } from "express";
import { asc, desc, eq } from "drizzle-orm";
import {
  db,
  goals,
  roadmapSteps,
  documents,
  opportunities,
} from "@workspace/db";
import {
  computeScores,
  netWorth,
  monthlyCashflow,
} from "../lib/insights";
import { getOrCreateProfile } from "../lib/identity";
import { getSessionUserId, requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/scores", requireAuth, async (req, res) => {
  const profile = await getOrCreateProfile(getSessionUserId(req)!);
  res.json(computeScores(profile));
});

router.get("/dashboard/summary", requireAuth, async (req, res) => {
  const profile = await getOrCreateProfile(getSessionUserId(req)!);
  const [allGoals, steps, docs, recommended] = await Promise.all([
    db.select().from(goals),
    db
      .select()
      .from(roadmapSteps)
      .orderBy(asc(roadmapSteps.orderIndex), asc(roadmapSteps.createdAt)),
    db.select().from(documents),
    db
      .select()
      .from(opportunities)
      .where(eq(opportunities.recommended, true))
      .orderBy(desc(opportunities.createdAt)),
  ]);

  const scores = computeScores(profile);
  const avgReadiness = Math.round(
    scores.reduce((sum, s) => sum + s.score, 0) / scores.length,
  );
  const topScore = [...scores].sort((a, b) => b.score - a.score)[0];
  const nextStep =
    steps.find((s) => s.status === "in_progress") ??
    steps.find((s) => s.status === "todo") ??
    null;

  res.json({
    netWorth: netWorth(profile),
    monthlyCashflow: monthlyCashflow(profile),
    totalAssets: profile.cashSavings + profile.otherAssets,
    totalDebt: profile.totalDebt,
    activeGoals: allGoals.filter((g) => g.status === "active").length,
    achievedGoals: allGoals.filter((g) => g.status === "achieved").length,
    avgReadiness,
    documentsComplete: docs.filter((d) => d.status === "complete").length,
    documentsTotal: docs.length,
    topScore,
    nextStep,
    recommendedOpportunities: recommended,
  });
});

export default router;
