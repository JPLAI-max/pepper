---
name: Pepper trust gate & anon conversation continuity
description: How anonymous chat converts to an account mid-conversation without losing history, and the connect-pg-simple session table gotcha.
---

# Pepper trust gate & anon conversation continuity

**Trust gate:** Conversation starts ANONYMOUSLY — anyone can chat with no login. Persisting financial data requires auth. When an anonymous user shares financial specifics, the server emits an auth-required signal (text SSE `{authRequired:true}`; voice SSE `{type:"auth_required"}`). The client surfaces account setup but the chat still proceeds (nudge, not block).

**Continuity through signup/login:** An anonymous conversation's id is stored in `session.conversationId`. On signup/login, after `session.regenerate()`, `linkAnonymousConversation()` atomically claims it with `WHERE id = ? AND user_id IS NULL` and backfills extraction. This preserves in-progress history under the new account. The AuthModal in "gate" mode must NOT reset the Pepper chat (continuity depends on it); "manual" mode redirects to /dashboard.

**connect-pg-simple session table gotcha:** `createTableIfMissing:true` fails under the dev/prod bundler because it reads a bundled `table.sql` via `__dirname` that isn't resolvable. Fix: set `createTableIfMissing:false` and define the `session` table in the Drizzle schema (`lib/db/src/schema/session.ts`) so `drizzle-kit push` provisions it in EVERY environment (dev + the post-merge `pnpm --filter db push`). Shape must match connect-pg-simple exactly: `sid varchar PK`, `sess json`, `expire timestamp(6)` (no tz), index `IDX_session_expire`.

**Why:** Without the Drizzle-defined session table, production has no session store and login silently fails to persist; the bundler-path issue makes the library's auto-create unreliable.
