import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, goals as goalsTable, roadmapSteps } from "@workspace/db";
import { CreateRoadmapStepBody, UpdateRoadmapStepBody } from "@workspace/api-zod";
import { getOrCreateProfile } from "../lib/identity";
import { computeReadiness } from "../lib/scoring";
import {
  computeRoadmap,
  type RoadmapHorizon,
  type RoadmapPlanStep,
} from "../lib/roadmap";
import { getSessionUserId, requireAuth } from "../lib/auth";

const router: IRouter = Router();

// GET /roadmap — the structured, deterministic roadmap for the session user:
// current position, primary obstacle, opportunities, and the horizon steps.
// READ-ONLY: position/obstacle/opportunities are computed in memory; the steps
// are read from persisted roadmap_steps when present (so they carry ids and any
// status the user toggled), and computed in memory WITHOUT writing when the
// roadmap has not been generated yet. Regeneration happens only on the
// recompute-after-extraction path (see lib/roadmap persistRoadmap).
router.get("/roadmap", requireAuth, async (req, res) => {
  const userId = getSessionUserId(req)!;
  const profile = await getOrCreateProfile(userId);
  const goals = await db
    .select()
    .from(goalsTable)
    .where(eq(goalsTable.userId, userId));
  const scores = computeReadiness(profile);
  const plan = computeRoadmap(profile, goals, scores);

  const persisted = await db
    .select()
    .from(roadmapSteps)
    .where(eq(roadmapSteps.userId, userId))
    .orderBy(asc(roadmapSteps.orderIndex), asc(roadmapSteps.createdAt));

  const steps: RoadmapPlanStep[] =
    persisted.length > 0
      ? persisted.map((row) => ({
          id: row.id,
          horizon: (row.horizon ?? "immediate") as RoadmapHorizon,
          action: row.title,
          detail: row.description,
          status: row.status,
          order: row.orderIndex,
        }))
      : plan.steps;

  res.json({ ...plan, steps });
});

router.post("/roadmap", requireAuth, async (req, res) => {
  const parsed = CreateRoadmapStepBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid roadmap data" });
    return;
  }
  const userId = getSessionUserId(req)!;
  const created = await db
    .insert(roadmapSteps)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(created[0]);
});

router.patch("/roadmap/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateRoadmapStepBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid roadmap data" });
    return;
  }
  const userId = getSessionUserId(req)!;
  const updated = await db
    .update(roadmapSteps)
    .set(parsed.data)
    .where(and(eq(roadmapSteps.id, id), eq(roadmapSteps.userId, userId)))
    .returning();
  if (!updated[0]) {
    res.status(404).json({ error: "Step not found" });
    return;
  }
  res.json(updated[0]);
});

export default router;
