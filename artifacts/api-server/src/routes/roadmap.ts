import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, roadmapSteps } from "@workspace/db";
import { CreateRoadmapStepBody, UpdateRoadmapStepBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/roadmap", async (_req, res) => {
  const rows = await db
    .select()
    .from(roadmapSteps)
    .orderBy(asc(roadmapSteps.orderIndex), asc(roadmapSteps.createdAt));
  res.json(rows);
});

router.post("/roadmap", async (req, res) => {
  const parsed = CreateRoadmapStepBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid roadmap data" });
    return;
  }
  const created = await db.insert(roadmapSteps).values(parsed.data).returning();
  res.status(201).json(created[0]);
});

router.patch("/roadmap/:id", async (req, res) => {
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
  const updated = await db
    .update(roadmapSteps)
    .set(parsed.data)
    .where(eq(roadmapSteps.id, id))
    .returning();
  if (!updated[0]) {
    res.status(404).json({ error: "Step not found" });
    return;
  }
  res.json(updated[0]);
});

export default router;
