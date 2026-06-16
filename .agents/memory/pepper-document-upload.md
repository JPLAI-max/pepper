---
name: Pepper in-conversation document upload + parsing
description: Rules for the chat document-upload flow — ownership binding at ingest, never-annualize for docs, and the confirm-only write path.
---

# Pepper document upload + parsing (chat)

Flow: client requests presigned upload URL → PUTs file → POST /documents/ingest →
server files an owner-scoped row + parses via OpenAI vision → editable confirmation
card → POST /documents/confirm-extraction writes the profile.

## Never-annualize for documents (vs. conversation)
`mapToProfileFields(e, opts?)` takes `{ deriveMonthlyFromAnnual?: boolean }`.
Conversation extraction leaves it ON (a user who says "I make $120k/yr" expects a
monthly figure). The document ingest path passes `false`.
**Why:** the task forbids inventing/annualizing — a document may only surface
figures literally printed on it. Aggregates (expenses/debt/cash) are still sums of
stated line items (that's arithmetic, not invention). A W-2 with only annual wages
therefore surfaces NO monthlyIncome proposal — that's correct, not a bug.
**How to apply:** any new doc-derived value must come from a printed field; never
re-enable annual→monthly on the doc path.

## Ingest ownership guard (object-takeover defense)
A presigned upload sets NO ACL — so at ingest a null ACL policy is the EXPECTED
case. Before `trySetObjectEntityAclPolicy`, read `getObjectAclPolicy(objectFile)`
and if it has an owner that isn't the current user, return 403 — never rebind a
foreign object's ACL and never delete it on the invalid-type branch.
**Why:** ingest accepts an arbitrary objectPath; without this, a guessed/leaked
already-owned object path could be re-owned or deleted by another user.
**How to apply:** keep the owner pre-check ahead of the type/size revalidation
(which can delete) and ahead of the ACL set.

## Confirm-only write + shared persistence
Ingest NEVER writes profile fields — it only files the documents row and returns
proposed fields. Only /documents/confirm-extraction writes, via
`persistProfileFields` (the same auth-scoped path the silent conversation
extractor uses: diff → update profile → profile_history → recompute scores +
roadmap). Confirm accepts only the 6 whitelisted numeric profile fields.

## File handling
Allowed types: application/pdf, image/png, image/jpeg; size ≤ 15MB. Re-validate the
ACTUAL stored object's contentType+size (client values are advisory); delete the
object + 400 if it fails. Vision call: images → image_url data URL; PDF → a `file`
content part (file_data base64). Upload affordance (paperclip + drag-drop) is
auth-only — guests have none.
