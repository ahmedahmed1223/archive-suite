# Archive API Contract

[العربية](README.ar.md) · [Documentation](../README.md)

This directory holds the framework-neutral API contract for the supported
Laravel + Next.js architecture. Laravel owns API behavior and persistence;
Next.js consumes the versioned contract.

## Files

- `archive-contract.openapi.json` — baseline OpenAPI 3.1 contract for auth,
  archive records, search, files, folders, rights, and public share routes.

## Contract Rules

- Contract changes happen with the Laravel and Next.js implementation changes in the same commit.
- Next.js API clients should be generated or hand-written from this contract,
  not from ad hoc route assumptions.
- Laravel controllers must preserve these response envelopes:
  - success: `{ "ok": true, ... }`
  - failure: `{ "ok": false, "error": "..." }`
- Auth must use HttpOnly cookies for refresh/session state. Bearer access tokens
  may exist for API clients, but browser persistence must not use localStorage.
- New product routes are implemented only in the Laravel API.

## Route groups

1. `auth` — login, refresh, logout, current user.
2. `records` — generic record listing and bulk write compatibility.
3. `search` — faceted search contract for archive UI.
4. `files` — file browser and proxied file access.
5. `rights` — rights metadata and enforcement checks.
6. `share` — public viewer and share access flows.

## What's new

The contract now also covers: user experience settings and capability
administration; media review sessions, timeline comments, transcript
versions, cached derivatives, and version-pinned external review links;
project task templates and escalation policy; sensitive-operation policy and
dual-approval requests; and vocabulary templates. `archive-contract.openapi.json`
remains the single source of truth for request and response shapes — read it
directly rather than relying on this summary for field-level detail.
