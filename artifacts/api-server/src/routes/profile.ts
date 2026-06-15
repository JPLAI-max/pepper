import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, profiles } from "@workspace/db";
import { UpdateProfileBody } from "@workspace/api-zod";
import { getOrCreateProfile } from "../lib/identity";

const router: IRouter = Router();

router.get("/profile", async (_req, res) => {
  const profile = await getOrCreateProfile();
  res.json(profile);
});

router.patch("/profile", async (req, res) => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid profile data" });
    return;
  }
  const profile = await getOrCreateProfile();
  const updated = await db
    .update(profiles)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(profiles.id, profile.id))
    .returning();
  res.json(updated[0]);
});

export default router;
