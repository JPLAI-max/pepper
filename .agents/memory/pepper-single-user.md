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

**Known follow-up (intentional, not a bug):** goals / roadmap / documents / opportunities are NOT user-scoped yet — they're a single shared set. Only profile + history + conversations were in scope per the spec.

**Why:** The product spec changed from a demo single-user app to a real multi-user foundation with a trust gate. Ownership checks are now mandatory on every conversation access.
