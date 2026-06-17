import { and, isNull, lt } from "drizzle-orm";
import { db, conversations } from "@workspace/db";
import { logger } from "./logger";

const DEFAULT_RETENTION_HOURS = 48;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // hourly sweep

/**
 * How long an UNCLAIMED anonymous conversation (userId IS NULL) is kept before
 * it is purged. Configurable via GUEST_RETENTION_HOURS; defaults to 48h. A
 * non-positive or unparseable value falls back to the default.
 */
export function getGuestRetentionHours(): number {
  const raw = process.env["GUEST_RETENTION_HOURS"];
  if (raw == null || raw.trim() === "") return DEFAULT_RETENTION_HOURS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_RETENTION_HOURS;
  return parsed;
}

/**
 * Deletes unclaimed anonymous conversations (userId IS NULL) older than the
 * retention window. Claimed conversations (userId set) are never touched. The
 * messages FK is ON DELETE CASCADE, so a conversation delete removes its
 * messages too — nothing lingers. Returns the number of conversations purged.
 */
export async function purgeStaleGuestConversations(): Promise<number> {
  const retentionHours = getGuestRetentionHours();
  const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000);

  const deleted = await db
    .delete(conversations)
    .where(and(isNull(conversations.userId), lt(conversations.createdAt, cutoff)))
    .returning({ id: conversations.id });

  if (deleted.length > 0) {
    logger.info(
      { count: deleted.length, retentionHours },
      "Purged stale guest conversations",
    );
  }
  return deleted.length;
}

/**
 * Starts the periodic guest-conversation cleanup. Runs once on startup and then
 * on an hourly interval. Each run owns its errors and never throws into the
 * caller. The interval is unref'd so it never keeps the process alive on its
 * own. Returns the timer handle (useful for tests/teardown).
 */
export function startGuestCleanup(): NodeJS.Timeout {
  const run = () => {
    purgeStaleGuestConversations().catch((err) => {
      logger.error({ err }, "Guest conversation cleanup failed");
    });
  };

  logger.info(
    { retentionHours: getGuestRetentionHours() },
    "Guest conversation cleanup started",
  );
  run();
  const timer = setInterval(run, CLEANUP_INTERVAL_MS);
  timer.unref?.();
  return timer;
}
