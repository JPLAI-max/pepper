import type { RequestHandler } from "express";

// Methods that can change server state. Safe methods (GET/HEAD/OPTIONS) are
// never CSRF vectors and are always allowed through.
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Build the set of host names (no scheme, no port-stripping beyond what the URL
 * parser does) that are allowed to originate state-changing requests. The app's
 * own host always counts as same-origin; the Replit dev domain and any
 * published domains are added so the preview iframe and production both work.
 */
function allowedHosts(reqHost: string | undefined): Set<string> {
  const hosts = new Set<string>();
  if (reqHost) hosts.add(reqHost.toLowerCase());
  const dev = process.env.REPLIT_DEV_DOMAIN;
  if (dev) hosts.add(dev.toLowerCase());
  for (const d of (process.env.REPLIT_DOMAINS ?? "").split(",")) {
    const t = d.trim().toLowerCase();
    if (t) hosts.add(t);
  }
  return hosts;
}

function hostOf(value: string): string | null {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Lightweight CSRF defense for cookie-authenticated, state-changing requests.
 *
 * The session cookie is SameSite=None (required so it survives the cross-site
 * preview iframe), which removes the browser's implicit cross-site protection.
 * To compensate, every mutating request that a browser makes carries an
 * `Origin` header; we require that origin (or, as a fallback, the `Referer`) to
 * match an allowlist of our own hosts. Non-browser callers (curl, server-to-
 * server, health checks) send neither header and are not CSRF vectors, so they
 * pass through untouched.
 */
export const csrfOriginGuard: RequestHandler = (req, res, next) => {
  if (!MUTATING.has(req.method)) {
    next();
    return;
  }

  const source = req.get("origin") ?? req.get("referer");
  // No browser-supplied origin context => not a browser-driven cross-site
  // request => not a CSRF vector. Allow (covers curl / SSR / internal calls).
  if (!source) {
    next();
    return;
  }

  const sourceHost = hostOf(source);
  const allowed = allowedHosts(req.get("host"));
  if (sourceHost && allowed.has(sourceHost)) {
    next();
    return;
  }

  req.log.warn(
    { method: req.method, url: req.url?.split("?")[0], sourceHost },
    "Blocked cross-origin state-changing request (CSRF guard)",
  );
  res.status(403).json({ error: "Cross-origin request blocked" });
};
