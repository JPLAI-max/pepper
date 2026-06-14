---
name: Pepper redesign constraints
description: What must be preserved when restyling/redesigning the Pepper frontend
---

When delegating Pepper frontend redesigns to DESIGN subagents, two areas are fragile and must be preserved (restyle only, never rewrite the logic):

1. `artifacts/pepper/src/pepper/` — the finished voice/chat engine (PepperProvider + usePepper). Subagents may CONSUME `usePepper()` but must NOT modify anything in this folder.
2. `artifacts/pepper/src/pages/Documents.tsx` — the @dnd-kit drag-and-drop (DndContext + closestCorners + useDroppable columns + useSortable items) that persists `status`/`orderIndex` via `updateDoc.mutateAsync` on drag end. It has broken before when rewritten; tell subagents to restyle visuals only and keep the exact handlers/mutations.

**Why:** Both encode behavior that took iteration to get right and is easy for a styling pass to silently break.

**How to apply:** For a cohesive multi-page redesign, run a two-phase "reference-then-match" delegation: phase 1 builds the design system (index.css tokens) + shell + orb + 1-2 reference pages; phase 2 restyles the rest, passing phase-1 output files (Dashboard.tsx, index.css, AppLayout.tsx) as relevantFiles so the look stays consistent. Always re-run `pnpm --filter @workspace/pepper run typecheck` and screenshot each page after.
