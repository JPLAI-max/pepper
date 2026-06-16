import type { Request } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db, conversations } from "@workspace/db";
import { getOrCreateProfile } from "./identity";
import { extractAndPersist } from "./extraction";
import { logger } from "./logger";

/** Promisified session.regenerate — rotates the session id to prevent fixation. */
export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) =>
    req.session.regenerate((err) => (err ? reject(err) : resolve())),
  );
}

export function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve())),
  );
}

/**
 * Preserve a guest's in-progress chat through auth: claim the anonymous
 * conversation for the freshly authenticated user (only if it is still
 * unowned), then backfill any financial data captured while anonymous.
 */
export async function linkAnonymousConversation(
  userId: number,
  anonConversationId: number | undefined,
): Promise<void> {
  if (!anonConversationId) return;
  const linked = await db
    .update(conversations)
    .set({ userId })
    .where(
      and(
        eq(conversations.id, anonConversationId),
        isNull(conversations.userId),
      ),
    )
    .returning();
  if (linked.length > 0) {
    void extractAndPersist(anonConversationId, userId).catch((err) =>
      logger.error(
        { err, anonConversationId, userId },
        "Backfill extraction failed",
      ),
    );
  }
}

/**
 * Establish a verified, cookie-only session for `userId`. Captures any
 * anonymous conversation id BEFORE rotating the session, regenerates the
 * session id (fixation defense, which also wipes any single-use WebAuthn
 * challenge), then ensures a profile exists and links the guest conversation.
 * The userId is the only identity source — it is never client-supplied.
 */
export async function establishSession(
  req: Request,
  userId: number,
): Promise<void> {
  const anonConversationId = req.session.conversationId;
  await regenerateSession(req);
  req.session.userId = userId;
  await saveSession(req);

  await getOrCreateProfile(userId);
  await linkAnonymousConversation(userId, anonConversationId);
}
