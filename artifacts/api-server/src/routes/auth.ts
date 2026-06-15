import { Router, type IRouter, type Request } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db, users, conversations } from "@workspace/db";
import { SignupBody, LoginBody } from "@workspace/api-zod";
import { hashPassword, verifyPassword, getSessionUserId } from "../lib/auth";
import { getOrCreateProfile } from "../lib/identity";
import { extractAndPersist } from "../lib/extraction";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const COOKIE_NAME = "pepper.sid";

/** Promisified session.regenerate — rotates the session id to prevent fixation. */
function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) =>
    req.session.regenerate((err) => (err ? reject(err) : resolve())),
  );
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve())),
  );
}

/**
 * Preserve a guest's in-progress chat through auth: claim the anonymous
 * conversation for the freshly authenticated user (only if it is still
 * unowned), then backfill any financial data captured while anonymous.
 */
async function linkAnonymousConversation(
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

router.post("/auth/signup", async (req, res) => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Enter a valid email and a password of at least 8 characters." });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing[0]) {
    res.status(409).json({ error: "That email is already registered." });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);

  let user;
  try {
    const created = await db
      .insert(users)
      .values({ email, passwordHash })
      .returning();
    user = created[0]!;
  } catch (err) {
    // Unique-constraint race: two signups for the same email.
    req.log.warn({ err, email }, "Signup insert failed");
    res.status(409).json({ error: "That email is already registered." });
    return;
  }

  const anonConversationId = req.session.conversationId;
  await regenerateSession(req);
  req.session.userId = user.id;
  await saveSession(req);

  await getOrCreateProfile(user.id);
  await linkAnonymousConversation(user.id, anonConversationId);

  res.status(201).json({ user: { id: user.id, email: user.email } });
});

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter your email and password." });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();

  const found = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const user = found[0];
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "Incorrect email or password." });
    return;
  }

  const anonConversationId = req.session.conversationId;
  await regenerateSession(req);
  req.session.userId = user.id;
  await saveSession(req);

  await getOrCreateProfile(user.id);
  await linkAnonymousConversation(user.id, anonConversationId);

  res.json({ user: { id: user.id, email: user.email } });
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      req.log.error({ err }, "Logout failed");
      res.status(500).json({ error: "Could not log out." });
      return;
    }
    res.clearCookie(COOKIE_NAME);
    res.status(204).end();
  });
});

router.get("/auth/me", async (req, res) => {
  const uid = getSessionUserId(req);
  if (uid == null) {
    res.json({ user: null });
    return;
  }
  const found = await db
    .select()
    .from(users)
    .where(eq(users.id, uid))
    .limit(1);
  const user = found[0];
  res.json({ user: user ? { id: user.id, email: user.email } : null });
});

export default router;
