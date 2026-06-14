---
name: Pepper discovery + storage contracts
description: Non-obvious contracts for the conversation-first discovery engine and Phase-1 document uploads.
---

# Discovery engine
- `POST /openai/discovery` is the conversation-first profile builder: it uses gpt-5.4 **tool-calling** (`update_profile`, `set_primary_goal`) to persist the singleton profile + primary goal straight from chat, then a second LLM call produces the natural reply. Money args are saved as whole dollars.
- Response shape: `{ reply, profile, goal, checklist, readyForReveal }`. `checklist` = booleans `{goal,income,expenses,savings,debt,credit,timeline}` and is a HIDDEN progress signal — never render it as a visible "step N of 7". `readyForReveal = goal && income && >=4 known`.
- `set_primary_goal` updates the lowest-priority existing goal (or inserts one) — single-primary-goal model, fine for discovery; revisit if multi-goal onboarding is added.

# Speak
- `POST /openai/speak {text, voice}` returns `{ audio }` = base64 **mp3** (VOICE_MAP female→shimmer, male→onyx). Client plays via `new Audio('data:audio/mp3;base64,'+audio)` — same one-shot pattern as the voice route (no worklet).

# Roadmap
- `POST /openai/generate-roadmap` (no body) asks gpt-5.4 for JSON, then DELETE-all + insert roadmapSteps (full replace). Returns the new steps.

# Document uploads (Phase 1)
- **Custom presigned flow, deliberately NOT Uppy.** Steps: `requestUploadUrl {name,size,contentType}` → `{uploadURL, objectPath}`; PUT raw file to `uploadURL` with `Content-Type`; then `createDocument` with `fileUrl: objectPath`. **Why:** a direct browser→signed-URL PUT keeps the client dependency-free and the contract reusable for Phase 2 AI extraction.
- `objectPath` looks like `/objects/uploads/<uuid>`. **Viewable/download URL = `/api/storage` + objectPath** (e.g. `/api/storage/objects/uploads/<uuid>`), served by the `GET /storage/objects/*path` route.
- documents table gained `fileUrl/mimeType/sizeBytes/uploadedAt` (all nullable). The create route sets `uploadedAt` server-side when `fileUrl` is present; `documentInputSchema` omits `uploadedAt`.
- **Why:** architected so Phase 2 can add AI extraction on the stored file without changing the upload contract.
