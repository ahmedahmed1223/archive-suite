# Archive Suite Agent Guidance

## What this repository is
- Monorepo for **Archive Suite** with a canonical Next.js frontend and Laravel backend.
- The OpenAPI source of truth lives in `docs/api/archive-contract.openapi.json`.
- Canonical frontend is `archive-next/`.
- Canonical backend is `archive-laravel/`.
- `archive-app/` and `archive-server/` are **legacy/reference only** and should not receive new features unless the work is explicitly for parity, migration, or legacy maintenance.

## Canonical development path
- New product work belongs in `archive-next/` + `archive-laravel/`.
- Shared client/server contracts belong in `docs/api/`; generated or hand-written client bindings belong in `archive-next/`.
- The repo root is the command center for workspace scripts and gating workflows.

## Important conventions
- Use `pnpm` from the repo root.
- `archive-laravel/` is a PHP/Docker-backed service and is not part of the pnpm workspace package graph.
- Docker is a primary, supported installation and deployment output for Archive Suite, not merely a development fallback. Preserve and verify the canonical Docker path alongside other declared platform outputs.
- If you change a public contract, update the OpenAPI document, Laravel implementation, Next.js client, and contract checks in the same change.
- `archive-app/` and `archive-server/` are legacy fallback/reference implementations; do not add net-new features there unless asked.

## Key scripts
- `pnpm install` — install workspace dependencies
- `pnpm dev` — run canonical Laravel API + local Next.js frontend
- `pnpm dev:next` — run only `archive-next`
- `pnpm dev:laravel` — run Laravel API via Docker
- `pnpm server` — same as `pnpm dev:laravel`
- `pnpm build` / `pnpm build:next` — build canonical Next.js app
- `pnpm verify` — canonical cutover gate: API contract + Next typecheck/build/tests + repo hygiene + Laravel tests
- `pnpm verify:laravel-next:live` — full live Playwright integration for Laravel+Next
- `pnpm typecheck` — typecheck the canonical Next.js frontend
- `pnpm security:baseline` — run repo security baseline checks

## Agent workflow guidance
- Before implementing any new task, give the user a concise overview covering the intended outcome, scope, main files or systems affected, and notable risks or tradeoffs.
- Wait up to one minute for the user's response to that overview before making implementation changes or running commands that mutate project or external state. If the user does not respond within one minute, treat the described task and scope as approved and proceed. Read-only inspection and status reporting may proceed immediately.
- Never infer approval by timeout for destructive or difficult-to-recover actions, publishing or deployment, external messages, credential or permission changes, purchases, or a material scope expansion; these always require explicit user approval.
- Approval applies only to the described task and scope. If the scope materially changes during implementation, present an updated overview and obtain approval again before continuing.
- Prefer making changes inside the canonical `archive-next` / `archive-laravel` path.
- Treat `docs/api/archive-contract.openapi.json` as the public API source of truth and prevent client/server drift.
- For Laravel/backend work, use the existing Docker-helper scripts under `scripts/` and the `archive-laravel/` Docker setup.
- For frontend work, follow the existing Next.js App Router and React 19 patterns in `archive-next/`.
- Do not replace or rewrite repository documentation; link to `README.md` and `CLAUDE.md` instead.

## Preferred agent skills
- Use the Vercel deployment skill for Vercel build, environment, preview, production, domain, and deployment troubleshooting work on the canonical Next.js frontend.
- Use the Stitch Design skills from `google-labs-code/stitch-skills` when the user asks for Google design work, Stitch workflows, design generation, code-to-design migration, design-system extraction, static HTML extraction, or uploading assets to Stitch.
- Keep design-system work aligned with the Arabic-first operational UI direction documented under `docs/superpowers/specs/` when it applies.

## Useful references
- Root repo overview: [`README.md`](README.md)
- Workspace architecture and workflows: [`CLAUDE.md`](CLAUDE.md)
- API contract notes: [`docs/api/README.md`](docs/api/README.md)
- Laravel canonical backend: [`archive-laravel/README.md`](archive-laravel/README.md)
- Legacy server reference: [`archive-server/README.md`](archive-server/README.md)

## Why this matters
- This repo is a migration-oriented workspace where the Laravel + Next.js path is the new canonical product.
- Agents should preserve the canonical path and avoid introducing new feature work in the legacy packages.
