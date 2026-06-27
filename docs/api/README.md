# Archive API Contract

This directory holds framework-neutral API contracts for the Laravel API and
Next.js migration. The current Node server remains the reference implementation
until Laravel reaches route parity.

## Files

- `archive-contract.openapi.json` — baseline OpenAPI 3.1 contract for auth,
  archive records, search, files, folders, rights, and public share routes.

## Migration Rules

- Contract changes happen before Laravel or Next.js implementation changes.
- Next.js API clients should be generated or hand-written from this contract,
  not from ad hoc route assumptions.
- Laravel controllers must preserve these response envelopes:
  - success: `{ "ok": true, ... }`
  - failure: `{ "ok": false, "error": "..." }`
- Auth must use HttpOnly cookies for refresh/session state. Bearer access tokens
  may exist for API clients, but browser persistence must not use localStorage.
- Route parity can be implemented gradually; mark missing Laravel routes as
  `501` only during parallel migration, never after a route is switched live.

## First Route Groups

1. `auth` — login, refresh, logout, current user.
2. `records` — generic record listing and bulk write compatibility.
3. `search` — faceted search contract for archive UI.
4. `files` — file browser and proxied file access.
5. `rights` — rights metadata and enforcement checks.
6. `share` — public viewer and share access flows.
