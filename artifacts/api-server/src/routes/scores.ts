import { Router, type IRouter } from "express";
import { computeScores } from "../lib/insights";
import { computeReadiness, persistReadinessScores } from "../lib/scoring";
import { getOrCreateProfile } from "../lib/identity";
import { getSessionUserId, requireAuth } from "../lib/auth";

const router: IRouter = Router();

// GET /scores — deterministic, educational readiness scores for the session
// user. Returns the legacy fields (key/label/score/tier/summary) for
// back-compat plus the engine's value/band and the "why" factors, and persists
// the latest scores + history.
router.get("/scores", requireAuth, async (req, res) => {
  const userId = getSessionUserId(req)!;
  const profile = await getOrCreateProfile(userId);

  const legacy = computeScores(profile);
  const rich = computeReadiness(profile);
  await persistReadinessScores(userId);

  const byKey = new Map(rich.map((r) => [r.key, r]));
  const merged = legacy.map((l) => {
    const r = byKey.get(l.key);
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
