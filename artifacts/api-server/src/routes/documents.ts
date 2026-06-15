import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, documents } from "@workspace/db";
import { CreateDocumentBody, UpdateDocumentBody } from "@workspace/api-zod";
import { getSessionUserId, requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/documents", requireAuth, async (req, res) => {
  const userId = getSessionUserId(req)!;
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(asc(documents.orderIndex), asc(documents.createdAt));
  res.json(rows);
});

router.post("/documents", requireAuth, async (req, res) => {
  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid document data" });
    return;
  }
  const userId = getSessionUserId(req)!;
  const created = await db
    .insert(documents)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(created[0]);
});

router.patch("/documents/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid document data" });
    return;
  }
  const userId = getSessionUserId(req)!;
  const updated = await db
    .update(documents)
    .set(parsed.data)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .returning();
  if (!updated[0]) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json(updated[0]);
});

router.delete("/documents/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = getSessionUserId(req)!;
  const deleted = await db
    .delete(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .returning();
  if (!deleted[0]) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.status(204).end();
});

export default router;
