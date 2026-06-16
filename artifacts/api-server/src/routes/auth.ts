import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, users } from "@workspace/db";
import { SignupBody, LoginBody } from "@workspace/api-zod";
import { hashPassword, verifyPassword, getSessionUserId } from "../lib/auth";
import { establishSession } from "../lib/authSession";

const router: IRouter = Router();

const COOKIE_NAME = "pepper.sid";

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

  await establishSession(req, user.id);

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

  await establishSession(req, user.id);

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
