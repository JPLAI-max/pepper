---
name: Pepper coach prompt vs JSON extraction contract
description: Why the coach "brain" spec is encoded as a natural-language system prompt, not the spec's structured-JSON output contract.
---

The Pepper Coach behavior spec (identity, philosophy, guardrails, Mode A onboarding flow, Mode B "Hey Pep" overlay, tone) is encoded as the system prompt built in `buildCoachContext` (shared by both the text-chat and voice routes).

The spec also defines a per-turn DATA EXTRACTION CONTRACT: return structured JSON `{reply, extracted{...}, ready_for_reveal, next_action}` on every turn.

**Decision:** do NOT instruct the model to emit that JSON in the system prompt.

**Why:** the chat route streams the assistant reply straight to the UI as SSE text chunks (`data:{content}`), and the voice route streams `transcript` deltas + TTS. If the prompt forced JSON output, raw JSON would surface in the chat bubble / be spoken aloud.

**How to apply:** if the extraction/`ready_for_reveal`/reveal pipeline is needed, build it out-of-band — a separate backend extraction pass or tool call that returns structured JSON, while the user-facing reply keeps streaming natural language unchanged. Don't switch the existing streaming chat to a single JSON response.
