import { eq } from "drizzle-orm";
import { db, profiles, type Profile } from "@workspace/db";

/**
 * Get-or-create the profile row owned by a user. All profile reads/writes go
 * through this so ownership is enforced server-side and never trusts a
 * client-supplied id — the caller must pass the userId resolved from the
 * verified session (see `getSessionUserId` / `requireAuth`).
 */
export async function getOrCreateProfile(userId: number): Promise<Profile> {
  const existing = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (existing[0]) return existing[0];
  const created = await db.insert(profiles).values({ userId }).returning();
  return created[0]!;
}
