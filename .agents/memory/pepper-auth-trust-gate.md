---
name: Pepper trust gate & anon conversation continuity
description: How anonymous chat converts to an account mid-conversation without losing history, and the connect-pg-simple session table gotcha.
---

# Pepper trust gate & anon conversation continuity

**Trust gate:** Conversation starts ANONYMOUSLY — anyone can chat with no login. Persisting financial data requires auth. When an anonymous user shares financial specifics, the server emits an auth-required signal (text SSE `{authRequired:true}`; voice SSE `{type:"auth_required"}`). The client surfaces account setup but the chat still proceeds (nudge, not block). The gate is rendered INLINE in the PepperAssistant message thread (`TrustGate`, `authRequired && !isAuthenticated`), NOT as the old auto-opening AuthModal (that auto-open effect was removed; AuthModal now only opens manually).

**Passkeys (WebAuthn) sit ON TOP of email+password:** `users.passwordHash` is NULLABLE (passkey-only accounts) and `verifyPassword` returns false on a null hash so the password path can't be bypassed. Credentials live in a `credentials` table bound to userId. Flow uses `@simplewebauthn/server` (api-server) + `@simplewebauthn/browser` (pepper). rpID/origin are derived per-request from the Origin/Host header (`lib/webauthn.ts`, allowlist replit domains + localhost) — never hardcode. Registration creates NO orphan user: account+credential are created together in a `db.transaction` only at verify time. **Single-use challenge is enforced by deleting `currentChallenge` (+ pending fields) from the session and saving BEFORE running verify** — clearing only after success leaves a replayable challenge on failure. Discoverable (usernameless) login: empty allowCredentials, look up credential by id → user. WebAuthn may be blocked inside the Replit preview iframe (SecurityError) — the password fallback covers it.

**Continuity through signup/login:** An anonymous conversation's id is stored in `session.conversationId`. On signup/login, after `session.regenerate()`, `linkAnonymousConversation()` atomically claims it with `WHERE id = ? AND user_id IS NULL` and backfills extraction. This preserves in-progress history under the new account. The AuthModal in "gate" mode must NOT reset the Pepper chat (continuity depends on it); "manual" mode redirects to /dashboard.

**connect-pg-simple session table gotcha:** `createTableIfMissing:true` fails under the dev/prod bundler because it reads a bundled `table.sql` via `__dirname` that isn't resolvable. Fix: set `createTableIfMissing:false` and define the `session` table in the Drizzle schema (`lib/db/src/schema/session.ts`) so `drizzle-kit push` provisions it in EVERY environment (dev + the post-merge `pnpm --filter db push`). Shape must match connect-pg-simple exactly: `sid varchar PK`, `sess json`, `expire timestamp(6)` (no tz), index `IDX_session_expire`.

**Why:** Without the Drizzle-defined session table, production has no session store and login silently fails to persist; the bundler-path issue makes the library's auto-create unreliable.
