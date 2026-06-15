import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, scores as scoresTable } from "@workspace/db";
import { computeScores } from "../lib/insights";
import { computeReadiness } from "../lib/scoring";
import { getOrCreateProfile } from "../lib/identity";
import { getSessionUserId, requireAuth } from "../lib/auth";

const router: IRouter = Router();

// GET /scores — deterministic, educational readiness scores for the session
// user. READ-ONLY: it returns the persisted scores when they exist; if a score
// has not been persisted yet it computes that score in memory and returns it
// WITHOUT writing. Persistence happens only on the recompute-after-extraction
// path (see lib/scoring persistReadinessScores), never on this read.
//
// Each entry keeps the legacy fields (key/label/score/tier/summary) for
// back-compat plus the engine's value/band and the "why" factors.
router.get("/scores", requireAuth, async (req, res) => {
  const userId = getSessionUserId(req)!;
  const profile = await getOrCreateProfile(userId);

  const legacy = computeScores(profile);

  // Persisted scores (source of truth when present).
  const persisted = await db
    .select()
    .from(scoresTable)
    .where(eq(scoresTable.userId, userId));
  const persistedByKey = new Map(persisted.map((row) => [row.key, row]));

  // In-memory fallback for any key not yet persisted — no write.
  const computed = computeReadiness(profile);
  const computedByKey = new Map(computed.map((r) => [r.key, r]));

  const merged = legacy.map((l) => {
    const row = persistedByKey.get(l.key);
    if (row) {
      return {
        ...l,
        value: row.value,
        band: row.band,
        partial: row.partial,
        helpingFactor: row.helpingFactor,
        hurtingFactor: row.hurtingFactor,
      };
    }
    const r = computedByKey.get(l.key);
    return {
      ...l,
      value: r ? r.value : l.score,
      band: r ? r.band : l.tier,
      partial: r ? r.partial : false,
      helpingFactor: r ? r.helpingFactor : null,
      hurtingFactor: r ? r.hurtingFactor : null,
    };
  });

  res.json(merged);
});

export default router;
