# Archive Suite — Full Implementation Design
**Date:** 2026-06-07  
**Scope:** All 62 tasks from TASKS.md (P0→P3)  
**Strategy:** 4 waves · 8 parallel tracks

---

## Context

All tasks originate from reconciled audit reports. TASKS.md is the authoritative task list. This design defines the implementation order, dependencies, and per-track approach.

---

## Implementation Waves

### Wave 1 — P0 Critical (6 tasks, blocks production)

| # | Task | Track | Effort |
|---|---|---|---|
| 1 | CSP header in Caddyfile + nginx configs | Security/Config | S |
| 2 | Docker USER node (non-root) | DevOps | S |
| 3 | Pagination (cursor+limit) for getAll/snapshot | Backend | L |
| 4 | Atomic transactions for snapshot()/replaceAll() | Backend | L |
| 5 | Replace 456 hard-coded emerald colors with semantic tokens | Frontend | XL |
| 6 | Tiered destructive-action confirmation dialogs | UI/UX | M |

### Wave 2 — P1 High Priority (22 tasks)

**Security sub-track (4):**
- JWT secret separation (JWT_AUTH_SECRET / JWT_SHARE_SECRET / OAUTH_STATE_SECRET)
- JWT revocation/blacklist (in-memory + TTL)
- Audit logging for destructive RPC operations
- Share link revocation table

**Backend sub-track (6):**
- Prisma connection pool config
- DB indexes (title/documentType/createdAt/isDeleted BTREE + GIN on JSONB)
- createdAt/updatedAt columns + migration
- Full-text server-side search with Arabic normalization
- Log redaction via Pino (linked to structured logging)
- Graceful shutdown (SIGTERM)

**Frontend sub-track (3):**
- React Error Boundaries (app + section level)
- Code splitting via React.lazy per page in pageRegistry.js
- App.jsx refactor (Provider/Router/Notifications/Sync)

**UI/UX sub-track (6):**
- V4 accent contrast fix (#064e3b → #10b981)
- Unified DialogManager (z-stack, focus trap, scroll lock, Escape)
- Interactive breadcrumb navigation
- Progress UI for long operations (backup/export/upload)
- Core a11y fixes (skip link, focus trap, aria-label, heading hierarchy, alt, aria-live)

**Testing sub-track (2):**
- Vitest unit test baseline (app + core + server)
- RPC handler integration tests

**Features sub-track (3):**
- Multi-document type support (PDF/images with pdf.js + OCR)
- Password reset + email (nodemailer/SMTP)
- 2FA/TOTP with recovery codes

### Wave 3 — P2 Medium (27 tasks)

Grouped by track:
- **Security:** AI prompt injection sanitization, X-Forwarded-For validation, xlsx CVE check
- **Backend:** createMany + chunking, record size limit, atomic config write, getByUid(), API versioning (/v1/), Pino structured logging, graceful shutdown, AI input sanitization
- **Frontend:** CSS @layer refactor (remove !important), PWA manifest + service worker, spacing scale tokens, loading state management
- **UI/UX:** Keyboard navigation for lists, categorized error messages, visible focus indicators + pagination
- **Testing:** jest-axe per component, extended E2E coverage
- **DevOps:** Sentry, Redis caching, Docker multi-stage + .dockerignore, scheduled backup with UI
- **Features:** Auto-tagging on upload, semantic search (pgvector), real-time collaboration, image processing pipeline (Sharp)

### Wave 4 — P3 Future (7 tasks)

- Bundle analysis (esbuild-visualizer)
- Load testing (k6) + Lighthouse CI
- Prometheus + Grafana + Helm chart
- i18n (i18next replacing hardcoded Arabic)
- Typed schema evolution (users/archive_items/content_types tables)
- Virtualization for mobile lists + cosmetic polish
- crypto-js → Web Crypto API replacement

---

## Dependencies Graph (critical path)

```
DB indexes ──────────────────────────────────────────→ Full-text search
createdAt/updatedAt migration ──────────────────────→ Audit logging
Pagination backend ──────────────────────────────────→ Pagination UI (visible)
Pino structured logging ─────────────────────────────→ Log redaction
Error Boundaries ────────────────────────────────────→ Sentry integration
Emerald token refactor ──────────────────────────────→ Spacing scale tokens
JWT secret separation ───────────────────────────────→ JWT revocation
Prisma connection pool ──────────────────────────────→ Atomic transactions
```

---

## Architecture Decisions

1. **Emerald replacement:** Define `--va-accent-soft`, `--va-accent-on-soft`, `--va-accent-border` in each theme's identity CSS, then systematically replace Tailwind `emerald-*` classes with these tokens using CSS variables + Tailwind's `[]` syntax.

2. **Pagination protocol:** Extend RPC body to `{ method, args, cursor?, limit? }`. Backend returns `{ data, nextCursor, hasMore }`. Frontend infinite-scroll consumes this.

3. **Atomic transactions:** Wrap Postgres `snapshot()` and `replaceAll()` in `prisma.$transaction([...], { isolationLevel: "RepeatableRead" })`. PocketBase remains dev-only, not production.

4. **Confirmation tiers:** 
   - Level 1 (standard delete): `ConfirmDialog` with "Are you sure?"
   - Level 2 (destructive): Type-to-confirm with item name
   - Level 3 (critical/bulk): Countdown (5s) + type "حذف نهائي"

5. **JWT secrets:** Each secret has an env var with fallback chain for backward compat. `productionGuard.js` extended to require all three.

6. **Full-text search:** PostgreSQL `to_tsvector('arabic', ...)` + `to_tsquery` with Arabic normalization function. New dedicated `/api/v1/search` endpoint separate from RPC.

7. **CSP:** Start in Report-Only mode (`Content-Security-Policy-Report-Only`), then flip to enforcing after verifying no violations.

---

## Testing Approach

- Each backend change: verification script in `archive-server/scripts/verify-*.mjs`
- Frontend changes: Playwright a11y spec + new Vitest unit tests
- Security changes: `verify-security-baseline.mjs` updated
- Run `pnpm run verify` after each wave to catch regressions

---

## Files Modified Per Wave

**Wave 1 (critical):** Caddyfile, nginx configs, Dockerfiles, Postgres adapter, PocketBase adapter, server.js (RPC protocol), archive-core (StorageProvider interface), identity CSS files (v1-v4), ConfirmDialog.js + callers

**Wave 2:** server.js, auth/*, config/productionGuard.js, prisma/schema.prisma + migrations, src/ai/sdkProvider.js, App.jsx, pageRegistry.js, all component files with a11y issues, v4-identity.css, new DialogManager, new breadcrumb component

**Wave 3:** All remaining CSS, vite.config.js, new PWA files, package.json (new deps: pino, sentry, redis, sharp), new test files

**Wave 4:** New i18n setup, new schema migrations, Helm chart, k6 scripts
