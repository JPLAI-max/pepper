import type { Request } from "express";

export interface WebAuthnContext {
  /** Relying-party ID = the effective domain the browser sees (no scheme/port). */
  rpID: string;
  /** Human-readable relying-party name shown in the OS passkey prompt. */
  rpName: string;
  /** Full origin (scheme + host) the ceremony must have occurred on. */
  origin: string;
}

const RP_NAME = "Pepper";

// Replit-owned domains we trust to host the app. The browser-sent Origin is
// validated against these suffixes so the RP ID is derived from a real Replit
// origin, never an attacker-chosen value.
const ALLOWED_SUFFIXES = [".replit.dev", ".replit.app", ".repl.co", ".replit.com"];

function isAllowedOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    if (host === "localhost" || host === "127.0.0.1") return true;
    return ALLOWED_SUFFIXES.some((s) => host.endsWith(s));
  } catch {
    return false;
  }
}

/** Origins assembled from the platform-provided domain env vars. */
function envOrigins(): string[] {
  const out: string[] = [];
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    for (const d of domains.split(",")) {
      const t = d.trim();
      if (t) out.push(`https://${t}`);
    }
  }
  const dev = process.env.REPLIT_DEV_DOMAIN;
  if (dev) out.push(`https://${dev.trim()}`);
  return out;
}

/**
 * Derive the WebAuthn relying-party context from the request. The RP ID must
 * equal the effective domain the browser is on, so we read the browser-sent
 * Origin header (a forbidden header browsers won't let page script forge) and
 * accept it only when it is a known Replit domain. Falls back to the
 * platform-provided domain env vars, then to the forwarded host for local dev.
 * Never trusts a client-supplied body value for identity.
 */
export function getWebAuthnContext(req: Request): WebAuthnContext {
  const reqOrigin = req.get("origin");
  let origin =
    reqOrigin && isAllowedOrigin(reqOrigin) ? reqOrigin : undefined;

  if (!origin) origin = envOrigins()[0];

  if (!origin) {
    const forwardedHost = req.get("x-forwarded-host") ?? req.get("host") ?? "localhost";
    const host = forwardedHost.split(",")[0]!.trim();
    const proto = (req.get("x-forwarded-proto") ?? "http").split(",")[0]!.trim();
    origin = `${proto}://${host}`;
  }

  const rpID = new URL(origin).hostname;
  return { rpID, rpName: RP_NAME, origin };
}
