import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { RequestHandler } from "express";
import { pool } from "@workspace/db";

// Augment the session with our own fields. `userId` is set only after a
// verified login/signup; `conversationId` binds an anonymous conversation to
// this browser's session so a guest's in-progress chat is preserved through
// sign-up and cannot be read by anyone else.
declare module "express-session" {
  interface SessionData {
    userId?: number;
    conversationId?: number;
    // WebAuthn: the server-generated, single-use challenge for the in-flight
    // registration or authentication ceremony. Stored server-side (never
    // client-trusted) and cleared as soon as it is verified.
    currentChallenge?: string;
    // Pending passkey registration (no account is created until the
    // attestation is verified, so an abandoned ceremony leaves no orphan user).
    pendingEmail?: string;
    pendingUserHandle?: string;
  }
}

const PgStore = connectPgSimple(session);

/**
 * Cookie-only, server-side session middleware. The session id lives in an
 * httpOnly cookie; all state (incl. the authenticated userId) is stored
 * server-side in Postgres. No tokens are ever exposed to client JS.
 */
export function createSessionMiddleware(): RequestHandler {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET must be set to enable sessions.");
  }
  const isProd = process.env.NODE_ENV === "production";

  return session({
    name: "pepper.sid",
    secret,
    resave: false,
    // Don't persist empty guest sessions until something is actually stored
    // (e.g. an anonymous conversation id or a userId).
    saveUninitialized: false,
    rolling: true,
    // The `session` table is provisioned out-of-band (see migrations / setup),
    // not via createTableIfMissing — that option reads a bundled table.sql that
    // isn't resolvable under the dev bundler's __dirname.
    store: new PgStore({ pool, createTableIfMissing: false }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  });
}
