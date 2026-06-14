---
name: Pepper voice/SSE contract
description: How Pepper's chat vs voice streaming events are shaped and consumed
---

Pepper's assistant streams over Server-Sent Events, but the two routes use DIFFERENT event shapes.

- Text chat (`POST /openai/conversations/:id/messages`): emits `data: {content}` chunks, then `data: {done:true}`. On error: `data: {error}`.
- Voice (`POST /openai/conversations/:id/voice-messages`): emits typed events — `{type:"user_transcript",data}`, `{type:"transcript",data}` (assistant text chunks), `{type:"audio",data}` (the FULL mp3 as a single base64 string), `{type:"error",data}`, then `{done:true}`.

**Why:** The voice route returns the whole TTS mp3 in one `audio` event, so the client plays it with `new Audio('data:audio/mp3;base64,...')` — there is NO streaming audio worklet and none is needed. The server-side voice turn is STT → gpt-5.4 (with personalized coach context from insights.ts) → TTS.

**How to apply:** When touching `artifacts/pepper/src/pepper/PepperProvider.tsx` or the openai routes, keep both parsers in sync with these shapes. Only persist an assistant DB row when the model produced non-empty text. `streamSSE` must check `res.ok` before reading the body so non-2xx errors surface instead of leaving empty assistant bubbles.
