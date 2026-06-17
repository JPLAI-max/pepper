---
name: Pepper guest-transcript auto-purge
description: Scheduled cleanup that deletes unclaimed anonymous conversations so the "discarded if you don't continue" retention notice is literally true.
---

# Guest-transcript auto-purge

`artifacts/api-server/src/lib/guestCleanup.ts` periodically deletes UNCLAIMED
anonymous conversations (`conversations.userId IS NULL`) older than a window
(`GUEST_RETENTION_HOURS`, default 48). Started from `index.ts` inside the
`app.listen` callback: runs once on boot, then hourly via an unref'd
`setInterval`; each run owns its errors (never throws into the server).

**Rules baked in (don't regress):**
- Scope is `isNull(userId) AND createdAt < cutoff` ONLY. Claimed conversations
  (userId set when a guest signs up / logs in) must NEVER be touched — that is
  what makes the in-product "discarded if you don't continue" notice true.
- Messages are removed via the schema FK `messages.conversationId -> conversations.id`
  `onDelete: "cascade"` — do NOT add a manual message delete; the cascade handles
  it. If that FK ever loses cascade, messages would orphan.
- `GUEST_RETENTION_HOURS` falls back to 48 on missing/non-positive/unparseable.
