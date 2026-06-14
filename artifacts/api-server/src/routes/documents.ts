import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, documents } from "@workspace/db";
import { CreateDocumentBody, UpdateDocumentBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/documents", async (_req, res) => {
  const rows = await db
    .select()
    .from(documents)
    .orderBy(asc(documents.orderIndex), asc(documents.createdAt));
  res.json(rows);
});

router.post("/documents", async (req, res) => {
  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid document data" });
    return;
  }
  const created = await db.insert(documents).values(parsed.data).returning();
  res.status(201).json(created[0]);
});

router.patch("/documents/:id", async (req, res) => {
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
  const updated = await db
    .update(documents)
    .set(parsed.data)
    .where(eq(documents.id, id))
    .returning();
  if (!updated[0]) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json(updated[0]);
});

router.delete("/documents/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const deleted = await db
    .delete(documents)
    .where(eq(documents.id, id))
    .returning();
  if (!deleted[0]) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.status(204).end();
});

export default router;
