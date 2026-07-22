# V1-747 Task 2 — OpenAPI and typed Next client

## Contract

Added the owner-scoped `/bulk-macros` CRUD, preview, run, and run-history operations to the canonical OpenAPI contract. The schemas are derived from the Laravel controller/service responses: ordered one-to-ten steps, explicit one-to-one-thousand targets, signed preview expiry, per-target/per-step outcomes, persisted run counts, and the exact `not_found`, `invalid_preview`, `expired_preview`, and `stale_preview` codes.

The verifier now asserts every path, editor authorization response, route status, request bound, enum, and confirmation error code.

## Client

Regenerated `archive-next/lib/generated/archive-api.ts` and exposed generated aliases plus typed CRUD, preview, run, and history methods in the handwritten client. Focused tests prove each method uses the required escaped `/bulk-macros` route and HTTP verb.

## Verification

```text
pnpm verify:api-contracts       PASS
pnpm verify:api-generated       PASS
pnpm --filter @archive/next exec vitest run lib/archive-api.test.ts
                              PASS (1 file, 4 tests)
pnpm typecheck                  PASS
```
