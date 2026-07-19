# Canonical Next.js Agent Guidance

This file extends the repository-root `AGENTS.md` for work under `archive-next/`.

## Scope and architecture

- This is the canonical React 19 and Next.js App Router frontend.
- Consume the public API through the bindings and helpers in `lib/`; do not invent client-only versions of public contracts.
- When a public request or response changes, update `docs/api/archive-contract.openapi.json`, Laravel, the client binding, and contract checks together.
- Preserve the Arabic-first RTL operational experience and the design direction under `docs/superpowers/specs/`.

## Implementation rules

- Prefer Server Components unless browser state, effects, or event handlers require a Client Component.
- Reuse existing layout, form, feedback, accessibility, and API patterns before adding another abstraction.
- Keep role and permission behavior aligned with the Laravel authorization contract; hiding an action is not authorization.
- Add accessible names, keyboard behavior, loading, empty, error, and success states for interactive features.
- Do not hand-edit `next-env.d.ts`; Next.js generates it.

## Minimum verification

- Logic or component change: focused Vitest test, then `pnpm test:next` when the slice is stable.
- Type or route change: `pnpm typecheck`.
- Visual or interactive flow: focused Playwright coverage; use the live Laravel+Next gate when real API behavior matters.
- Production-impacting change: `pnpm build:next` before completion.

Use `docs/agents/verification-matrix.md` to select the complete gate for the change.
