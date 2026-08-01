# Search, Navigation, and Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an explicit remembered-login choice, a clearer advanced search workbench, and collapsible functional navigation groups.

**Architecture:** Laravel persists one `remember_me` attribute on API sessions and uses it whenever refresh rotates the cookie. The Next login form sends the documented `rememberMe` property. Search and navigation retain their existing data sources while CSS and semantic controls reshape their presentation.

**Tech Stack:** Laravel 12/PHP, Next.js 16/React 19, TypeScript, CSS custom properties, OpenAPI, Vitest.

## Global Constraints

- No dependency additions; use native `<details>` for disclosures.
- Update `docs/api/archive-contract.openapi.json` and generated bindings with every public contract change.
- Preserve 375px mobile usability, keyboard access, and natural Arabic copy.

---

### Task 1: Persistent-session choice

**Files:**
- Modify: `archive-laravel/app/Http/Controllers/Api/V1/AuthController.php`, `archive-laravel/app/Models/ApiSession.php`, `docs/api/archive-contract.openapi.json`, `archive-next/lib/archive-api.ts`, `archive-next/lib/auth-session.tsx`, `archive-next/app/login/page.tsx`, `archive-next/app/login/login.css`
- Create: `archive-laravel/database/migrations/2026_08_01_000001_add_remember_me_to_api_sessions_table.php`
- Test: `archive-laravel/tests/Feature/AuthApiTest.php`, `archive-next/lib/archive-api.test.ts`

- [x] Write and run failing tests for session-only and remembered cookies.
- [x] Add the boolean migration and retain it in the model and rotated session.
- [x] Send `rememberMe` from the accessible login checkbox and update the contract/generated types.
- [x] Run Laravel auth tests, Next unit tests, and typecheck.

### Task 2: Advanced search workbench

**Files:**
- Modify: `archive-next/app/search/page.tsx`, `archive-next/app/styles/06-widgets.css`
- Test: `archive-next/app/search/page.test.tsx`

- [x] Write a rendering test for a labelled recent-search strip and advanced-filter disclosure.
- [x] Split search controls into primary query/action, native advanced disclosure, and labelled saved/recent areas without changing search requests.
- [x] Add mobile-first grid styles with an expanded desktop result/preview layout.
- [x] Run the search test, typecheck, and browser interactions.

### Task 3: Grouped collapsible navigation

**Files:**
- Modify: `archive-next/components/AppHeader.tsx`, `archive-next/components/AppHeader.test.tsx`, `archive-next/app/styles/01-base.css`

- [x] Write a failing navigation test for grouped disclosures and reset control.
- [x] Replace the single “more” disclosure with functional disclosure groups, opening the current group by default.
- [x] Add desktop/sidebar and compact/drawer styles without altering role-aware route data.
- [x] Run targeted tests, complete checks, and headed acceptance sweep.
