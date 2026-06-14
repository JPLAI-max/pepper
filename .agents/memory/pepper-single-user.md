---
name: Pepper single-user design
description: Why Pepper's API has no auth and no conversation ownership checks
---

Pepper is a deliberately single-user app.

The rule: the profile row is a singleton accessed via getOrCreate, there are no user accounts or auth, and the OpenAI conversation/message routes (`/openai/conversations/:id/...`) accept raw IDs with NO ownership/authz checks.

**Why:** The product is one person's personal wealth coach. Adding auth/ownership now would be scope the user never asked for. A code review (architect) flagged the missing ownership check as an IDOR — it is only a real issue if/when multi-user is introduced.

**How to apply:** Do not add auth or per-user filtering as a "bug fix." Only introduce ownership checks if the user explicitly adds multiple users/accounts.
