import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, profiles } from "@workspace/db";
import { UpdateProfileBody } from "@workspace/api-zod";
import { getOrCreateProfile } from "../lib/identity";
import { getSessionUserId, requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/profile", requireAuth, async (req, res) => {
  const userId = getSessionUserId(req)!;
  const profile = await getOrCreateProfile(userId);
  res.json(profile);
});

router.patch("/profile", requireAuth, async (req, res) => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid profile data" });
    return;
  }
  const userId = getSessionUserId(req)!;
  const profile = await getOrCreateProfile(userId);
  const updated = await db
    .update(profiles)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(profiles.id, profile.id))
    .returning();
  res.json(updated[0]);
});

export default router;
