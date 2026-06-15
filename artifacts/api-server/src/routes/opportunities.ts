import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, goals as goalsTable, opportunities } from "@workspace/db";
import { getOrCreateProfile } from "../lib/identity";
import { computeReadiness } from "../lib/scoring";
import { computeOpportunityMatches } from "../lib/opportunities";
import { getSessionUserId, requireAuth } from "../lib/auth";

const router: IRouter = Router();

// GET /opportunities — the bare catalog of products. Behind requireAuth because
// it carries gated future products we don't want publicly enumerable pre-launch.
router.get("/opportunities", requireAuth, async (_req, res) => {
  const rows = await db
    .select()
    .from(opportunities)
    .orderBy(desc(opportunities.recommended), desc(opportunities.createdAt));
  res.json(rows);
});

// GET /opportunities/matches — the deterministic, educational opportunity
// matcher for the SESSION user. Computes tool categories from the user's
// profile + primary goal + readiness scores. READ-ONLY: computed on read with
// no write side-effect (same discipline as GET /scores). Session-scoped, so a
// user can never see another's matches.
router.get("/opportunities/matches", requireAuth, async (req, res) => {
  const userId = getSessionUserId(req)!;
  const profile = await getOrCreateProfile(userId);
  const goals = await db
    .select()
    .from(goalsTable)
    .where(eq(goalsTable.userId, userId));
  const scores = computeReadiness(profile);
  res.json(computeOpportunityMatches(profile, goals, scores));
});

export default router;
