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

**Partitioned (CHIPS) is also required.** `SameSite=None;Secure` alone is not
enough under Chrome third-party-cookie blocking: the cookie must ALSO be
`partitioned: true` or it is dropped in the cross-site iframe (same 201-then-403
symptom). express-session passes `partitioned` straight to the `cookie`
serializer and its types accept it — no cast needed. Keep `partitioned` as an
iframe-compatibility fix, NOT as a CSRF primitive.

**CSRF tradeoff:** `SameSite=None` removes the browser's implicit cross-site
protection, so a same-origin Origin/Referer check is required on mutating `/api`
requests. See `lib/csrf.ts` (`csrfOriginGuard`): only POST/PUT/PATCH/DELETE are
checked; the Origin (or Referer) host must be in the allowlist (request's own
host + `REPLIT_DEV_DOMAIN` + `REPLIT_DOMAINS`); requests with neither header
(curl/SSR/internal) pass, because browser CSRF always carries an Origin.
**Do NOT broaden this to a `*.replit.dev/.app` suffix match** — that admits
unrelated Replit tenants and is a real CSRF weakening. The canvas/preview iframe
already serves from `REPLIT_DEV_DOMAIN`, so the exact allowlist covers it; if the
guard ever blocks a legit origin, add that EXACT logged `sourceHost`, not a
wildcard. (Verified: real browser traffic never tripped the guard; the iframe
403s were the cookie-drop above, fixed by `partitioned`.)

**Not every 201-then-403 is a cookie drop.** A SECOND, client-side cause of the
same "Sorry, something went wrong" + messages 403 is a **stale stored
conversation id**: `PepperProvider.ensureConversation` reuses
`localStorage["pepper.conversationId"]` without checking the current session owns
it. A returning guest whose session rotated/expired (or whose guest conversation
was auto-purged) holds an orphaned id, so `resolveConversationAccess` legitimately
403s forever and the user is permanently stuck (cookie is fine; the id just isn't
theirs). Fix lives in the client, not the cookie: `resetConversation()` clears the
ref + localStorage; the message-load effect drops the id on 403/404; and BOTH
`sendText` and `sendVoiceBlob` catch a `streamSSE` error matching `/status 403/`,
reset, create a fresh conversation, and retry the turn ONCE (the 403 fails before
any SSE body, so no double output; single nested retry, no loop). When debugging a
messages 403, decide which cause: cookie-drop (fix server cookie attrs) vs.
stale-id (client recreates) — check whether a brand-new guest in a clean browser
also fails (cookie) or only a returning one (stale id).

**Coach model id:** the OpenAI chat model is env-driven `COACH_MODEL` (default
`gpt-4o`) in `openai/index.ts` + `navigation.ts`. Never hardcode a non-existent
id (a bogus `gpt-5.4` broke every coach turn). The Replit AI-integrations proxy
accepts `gpt-4o`.
