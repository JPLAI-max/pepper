import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, goals } from "@workspace/db";
import { CreateGoalBody, UpdateGoalBody } from "@workspace/api-zod";
import { getSessionUserId, requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/goals", requireAuth, async (req, res) => {
  const userId = getSessionUserId(req)!;
  const rows = await db
    .select()
    .from(goals)
    .where(eq(goals.userId, userId))
    .orderBy(desc(goals.priority), desc(goals.createdAt));
  res.json(rows);
});

router.post("/goals", requireAuth, async (req, res) => {
  const parsed = CreateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid goal data" });
    return;
  }
  const userId = getSessionUserId(req)!;
  const created = await db
    .insert(goals)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(created[0]);
});

router.patch("/goals/:id", requireAuth, async (req, res) => {
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
  const userId = getSessionUserId(req)!;
  const updated = await db
    .update(goals)
    .set(parsed.data)
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .returning();
  if (!updated[0]) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  res.json(updated[0]);
});

router.delete("/goals/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = getSessionUserId(req)!;
  const deleted = await db
    .delete(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .returning();
  if (!deleted[0]) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  res.status(204).end();
});

export default router;
