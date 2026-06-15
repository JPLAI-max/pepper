import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, roadmapSteps } from "@workspace/db";
import { CreateRoadmapStepBody, UpdateRoadmapStepBody } from "@workspace/api-zod";
import { getSessionUserId, requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/roadmap", requireAuth, async (req, res) => {
  const userId = getSessionUserId(req)!;
  const rows = await db
    .select()
    .from(roadmapSteps)
    .where(eq(roadmapSteps.userId, userId))
    .orderBy(asc(roadmapSteps.orderIndex), asc(roadmapSteps.createdAt));
  res.json(rows);
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
