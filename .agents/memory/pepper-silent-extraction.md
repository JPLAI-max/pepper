---
name: Pepper silent extraction
description: How the after-turn structured extraction pass works and its aggregate-overwrite risk
---

# Silent structured extraction

After every user chat/voice turn the server fires a separate, out-of-band OpenAI
call (`response_format: json_object`) that returns JSON-only financial data. Its
output is NEVER sent to the chat UI — it is persisted to the singleton profile and
a `profile_history` row is appended for each value that actually changed.

**Rules baked in (don't regress):**
- Fire-and-forget AFTER `res.end()` in both the text and voice routes; it owns its
  errors and must never throw into the request or alter the streamed reply.
- Log only changed fields to history (previous→new). `readyForReveal` is sticky
  once true. Internal fields (`userId`, `nextAction`, `readyForReveal`) are omitted
  from the client-writable `ProfileUpdate` schema — clients must not write them.
- Data layer is multi-user-shaped even though the app is single-user: every
  profile/history row carries `userId`, resolved via `getCurrentUserId()` (singleton).

**Aggregate-overwrite risk (known tradeoff):**
The profile stores only aggregate columns (`monthlyExpenses`, `totalDebt`,
`cashSavings`), summed from the model's per-category output each turn. If the model
re-emits only a subset of categories, a total can be silently lowered.
**Why not a monotonic guard:** legitimate decreases (debt paydown) must be allowed,
so we can't just block decreases.
**Mitigation chosen:** the extraction prompt instructs the model to carry forward
EVERY value stated anywhere in the conversation and only change one on an explicit
user update — no schema change. If this proves insufficient, the deterministic fix
is per-category columns with derived totals (a schema redesign, out of scope then).
