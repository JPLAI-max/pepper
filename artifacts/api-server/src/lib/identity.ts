import { eq } from "drizzle-orm";
import { db, users, profiles, type Profile } from "@workspace/db";

/**
 * Single source of truth for "who is the current user".
 *
 * Single-user for now: it get-or-creates the one singleton user (serial id 1)
 * and returns its id. When real accounts are added later, this resolver is the
 * only place that changes — it will read the authenticated session instead —
 * and no table needs re-plumbing, since profile + history rows already carry
 * userId.
 */
export async function getCurrentUserId(): Promise<number> {
  const existing = await db.select().from(users).limit(1);
  if (existing[0]) return existing[0].id;
  const created = await db.insert(users).values({}).returning();
  return created[0]!.id;
}

/**
 * Get-or-create the profile row owned by a user. All profile reads/writes go
 * through this so ownership is enforced server-side and never trusts a
 * client-supplied id.
 */
export async function getOrCreateProfile(userId?: number): Promise<Profile> {
  const uid = userId ?? (await getCurrentUserId());
  const existing = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, uid))
    .limit(1);
  if (existing[0]) return existing[0];
  const created = await db.insert(profiles).values({ userId: uid }).returning();
  return created[0]!;
}
