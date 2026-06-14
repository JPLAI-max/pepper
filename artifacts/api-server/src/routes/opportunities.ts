import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, opportunities } from "@workspace/db";

const router: IRouter = Router();

router.get("/opportunities", async (_req, res) => {
  const rows = await db
    .select()
    .from(opportunities)
    .orderBy(desc(opportunities.recommended), desc(opportunities.createdAt));
  res.json(rows);
});

export default router;
