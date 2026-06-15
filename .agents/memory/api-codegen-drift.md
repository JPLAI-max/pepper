---
name: api-zod / api-client codegen drift
description: Generated API client/zod are derived from openapi.yaml; never hand-edit, and watch for spec drift
---

# Generated API code is spec-derived

`@workspace/api-zod` and `lib/api-client-react/src/generated/` are produced by
`pnpm --filter @workspace/api-spec run codegen` from `lib/api-spec/openapi.yaml`.
Codegen CLEANS the output folder and regenerates — so the generated files are pure
build artifacts that must always match the spec.

**The trap:** if committed generated files contain types/schemas that are NOT in
`openapi.yaml` (e.g. hand-edited, or left over from a spec that later changed), the
repo compiles only against those stale artifacts. The next required codegen — even
for an unrelated change — wipes them and breaks every dependent file.

**Rule:** never hand-edit generated files. To add types a route needs, add the
operation + component schemas to `openapi.yaml`, then run codegen. Orval names the
request/response zod from the operationId: operationId `requestUploadUrl` →
`RequestUploadUrlBody` / `RequestUploadUrlResponse` (NOT the component schema name).

**Why this matters here:** the unwired `storage.ts` route imported upload types that
existed only in the committed generated output, never in the spec. A profile-schema
codegen surfaced the drift; the fix was to add the `/storage/uploads/request-url`
contract to `openapi.yaml` so the types regenerate properly.
