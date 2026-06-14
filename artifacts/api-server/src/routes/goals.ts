import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, goals } from "@workspace/db";
import { CreateGoalBody, UpdateGoalBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/goals", async (_req, res) => {
  const rows = await db
    .select()
    .from(goals)
    .orderBy(desc(goals.priority), desc(goals.createdAt));
  res.json(rows);
});

router.post("/goals", async (req, res) => {
  const parsed = CreateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid goal data" });
    return;
  }
  const created = await db.insert(goals).values(parsed.data).returning();
  res.status(201).json(created[0]);
});

router.patch("/goals/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid goal data" });
    return;
  }
  const updated = await db
    .update(goals)
    .set(parsed.data)
    .where(eq(goals.id, id))
    .returning();
  if (!updated[0]) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  res.json(updated[0]);
});

router.delete("/goals/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const deleted = await db.delete(goals).where(eq(goals.id, id)).returning();
  if (!deleted[0]) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  res.status(204).end();
});

export default router;
