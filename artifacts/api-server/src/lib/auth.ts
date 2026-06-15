import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** The authenticated user id from the verified session, or null when anonymous. */
export function getSessionUserId(req: Request): number | null {
  const uid = req.session?.userId;
  return typeof uid === "number" ? uid : null;
}

/**
 * Gate a route on a verified session. Never trusts a client-supplied id — the
 * id comes only from the server-side session. Responds 401 when anonymous.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (getSessionUserId(req) == null) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}
