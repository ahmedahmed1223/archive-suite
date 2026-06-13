# archive-suite

pnpm monorepo: `archive-app` (React SPA), `archive-core` (shared lib), `archive-server` (Node backend).

## Commands

```bash
# Dev
pnpm dev                    # frontend dev server
pnpm server                 # backend server

# Build
pnpm build:spa              # SPA build
pnpm build:cloud            # cloud build
pnpm build:aistudio         # AI Studio build

# Test & verify
pnpm verify                 # run all package verify scripts
pnpm verify:app             # frontend only
pnpm verify:server          # server only
pnpm verify:core            # core only
pnpm --filter @archive/app run test          # unit tests (vitest)
pnpm --filter @archive/app run e2e           # Playwright E2E
pnpm security:baseline      # security baseline check

# Release gate
pnpm release:verify         # full verify + build + security check
```

## Stack

- **Frontend:** React 19, Vite 8, Tailwind v4, framer-motion, i18next
- **Backend:** Node.js/ESM, Prisma (Postgres + PocketBase adapters), Docker/K8s
- **Testing:** Vitest, Playwright, Testing Library, axe-core (a11y)
- **Package manager:** pnpm 11 (workspace)

## Notes

- Three build modes: `spa` (offline), `cloud` (PocketBase), `aistudio` (AI Studio embedded)
- Server supports multiple storage backends: S3, Azure, Dropbox, Google Drive
- AI SDK integrates Anthropic, OpenAI, Google, Groq, Mistral, OpenRouter
