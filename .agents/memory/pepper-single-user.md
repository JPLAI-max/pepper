---
name: Pepper auth & ownership model
description: How identity, scoping, and ownership checks work in Pepper (superseded the old single-user no-auth design).
---

# Pepper auth & ownership model

Pepper now has **multi-user cookie-session auth** (email+password, bcrypt only, no Clerk/Replit Auth, no passkeys). The old "single-user singleton profile, no ownership checks" design is **gone** — do NOT reintroduce the IDOR exemption.

**Rules:**
- Identity comes ONLY from the server session (`req.session.userId`). Never trust a client-supplied id.
- `getOrCreateProfile(userId)` REQUIRES a userId. Profile + profile_history + conversations are scoped per user.
- Conversation read/write go through `resolveConversationAccess()`: owned conversation requires matching `session.userId`; anonymous conversation requires matching `session.conversationId`; otherwise 403.
- Session fixation guard: `req.session.regenerate()` is called before setting `userId` on both signup and login.

**Per-row ownership pattern (goals / roadmap_steps / documents):** each carries a `userId` column mirroring `profiles.userId` exactly (`integer notNull default(1)`, no real `.references()`). `userId` is server-owned: it's omitted from the zod/insert input schemas and set from `getSessionUserId(req)!` on every write — never accepted from the client. All routes use `requireAuth`; GET filters by `eq(t.userId, userId)`, POST inserts `{...data, userId}`, PATCH/DELETE scope with `and(eq(t.id,id), eq(t.userId,userId))` and 404 when not owned. roadmap has no DELETE by design.

**Secondary consumers must also scope:** any other reader of these tables must filter by userId too — currently `dashboard.ts` summary and `openai/index.ts buildContextMessages` (its guest branch short-circuits to `[]`). Forgetting one re-introduces the leak even when routes are clean.

**opportunities** stays a global shared catalog (not user-scoped) — correct by design.

**Why:** The product spec changed from a demo single-user app to a real multi-user foundation with a trust gate. Ownership checks are mandatory on every conversation access and on every goals/roadmap/documents access (verified by a two-user isolation test: other user sees 0 rows, cross-user PATCH/DELETE → 404).
**How to apply:** keep `userId` server-set for these tables forever; when adding any new query against them, scope by session userId or it leaks.
