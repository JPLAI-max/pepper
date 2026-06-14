# Pepper — AI Wealth Coach

Pepper ("Pep") is a conversational AI Wealth Coach for building wealth through real estate. Its philosophy is goals and roadmap first, financial products second. A Jarvis-style voice assistant is present on every page (typed chat, push-to-talk with spoken replies, "Hey Pep" wake word, and dictation into form fields), with selectable male/female voices and a warm, non-judgmental tone.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/pepper run dev` — run the Pepper web app (use the workflow; needs PORT/BASE_PATH)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec (run after EVERY openapi.yaml change)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed opportunities, roadmap, documents, and a sample goal
- Required env: `DATABASE_URL`; OpenAI access is via the Replit AI Integrations proxy

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5; DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`; API codegen: Orval (from OpenAPI spec)
- Frontend: React + Vite, wouter, @tanstack/react-query, shadcn/ui, framer-motion, @dnd-kit
- AI: OpenAI via `@workspace/integrations-openai-ai-server` (chat gpt-5.4, STT, TTS)

## Where things live

- DB schema (source of truth): `lib/db/src/schema/app.ts` (profiles, goals, roadmapSteps, documents, opportunities) + `conversations`/`messages`. Money is stored as INTEGER whole dollars.
- API contract (source of truth): `lib/api-spec/openapi.yaml` → generates hooks in `lib/api-client-react/src/generated/` and Zod in `@workspace/api-zod`.
- API routes: `artifacts/api-server/src/routes/`. AI + voice routes: `routes/openai/index.ts`. Scores + coach system prompt: `src/lib/insights.ts`.
- Pepper voice/chat client (do not let design subagents touch): `artifacts/pepper/src/pepper/` — `PepperProvider` + `usePepper()` hook.
- Pages: `artifacts/pepper/src/pages/` (Dashboard, Onboarding, Goals, Roadmap, Readiness, Documents, Opportunities). Global assistant UI: `src/components/pepper/PepperAssistant.tsx`. Layout: `src/components/layout/AppLayout.tsx`.

## Architecture decisions

- Single-user app by design: the profile is a singleton (getOrCreate), there are no user accounts/auth, and conversation/message routes intentionally have NO ownership checks. Do not "fix" this as an IDOR unless multi-user is actually introduced.
- Voice turn is a server-side chain: STT → gpt-5.4 (with personalized coach context) → TTS, streamed over SSE. The voice route returns the FULL mp3 as one base64 `audio` event, so the client plays it with `new Audio('data:audio/mp3;base64,...')` — no audio worklet needed.
- SSE contracts differ by route: text chat sends `data: {content}` chunks; the voice route sends typed events (`user_transcript`, `transcript`, `audio`, `done`, `error`). The client (`PepperProvider`) parses both.
- Wake word ("Hey Pep") uses the browser `webkitSpeechRecognition` API (allowed); only `SpeechSynthesis` TTS is avoided in favor of OpenAI TTS for consistent voices.

## Product

Financial snapshot/onboarding, educational readiness scores (homeownership/investment/credit/debt), a personalized roadmap, goals tracking, a drag-and-drop document filing vault, and curated lending/investment opportunities — all guided by the always-present Pepper assistant.

## User preferences

- Two selectable assistant voices (male AND female); friendly, non-judgmental tone.
- Aesthetic target: E-Trade + Apple + Jarvis — high-tech but extremely approachable for everyone. No emojis in the UI.

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after EVERY `openapi.yaml` change.
- Express body limit is raised to 50mb to accept base64 audio uploads.
- Verify artifacts with `pnpm --filter @workspace/<slug> run typecheck`, not `build` (build needs workflow-provided PORT/BASE_PATH).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
