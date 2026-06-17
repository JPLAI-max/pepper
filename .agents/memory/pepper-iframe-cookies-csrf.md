---
name: Pepper iframe session cookie + CSRF
description: Why the session cookie must be SameSite=None;Secure (cross-site preview iframe) and the CSRF guard that compensates
---

The Pepper app is always viewed inside a **cross-site iframe** (Replit preview
proxy + embedded canvas). The top-level site is replit.com while the app/API are
served from the replit.dev (or published) domain.

**Rule:** the express-session cookie MUST be `sameSite: "none", secure: true`.
With `sameSite: "lax"` the browser will not send the cookie on requests inside
the cross-site iframe, so a session created by one request is invisible to the
next.

**Why:** symptom was chat failing with "Sorry, something went wrong reaching me";
server log showed `POST /openai/conversations` 201 immediately followed by
`POST /openai/conversations/:id/messages` 403. `resolveConversationAccess()`
relies on session continuity (guest: `session.conversationId`; owner:
`session.userId`); the Lax cookie was dropped between the two requests, so access
resolved to null → 403.

**How to apply:** `None` requires `Secure`. That is safe here because both the
dev preview and production serve over HTTPS through the proxy and
`app.set("trust proxy", 1)` is set, so `req.secure` is true and the cookie is
issued. Do NOT gate `secure` on `NODE_ENV` (e.g. `secure: isProd`) — the dev
preview is also HTTPS-in-an-iframe and needs the secure cookie too. There is no
plain-HTTP access path on Replit. Verify with curl against
`https://$REPLIT_DEV_DOMAIN` (NOT `localhost:80`, which is plain HTTP and will
suppress a Secure cookie, giving a false 403).

**CSRF tradeoff:** `SameSite=None` removes the browser's implicit cross-site
protection, so a same-origin Origin/Referer check is required on mutating `/api`
requests. See `lib/csrf.ts` (`csrfOriginGuard`): only POST/PUT/PATCH/DELETE are
checked; the Origin (or Referer) host must be in the allowlist (request's own
host + `REPLIT_DEV_DOMAIN` + `REPLIT_DOMAINS`); requests with neither header
(curl/SSR/internal) pass, because browser CSRF always carries an Origin.
