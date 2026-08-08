# Public Bilingual Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish accurate, discoverable Arabic and English documentation for the current Masar product without rewriting historical evidence.

**Architecture:** Maintain one living documentation map in `docs/README*` and pair each public operational or developer guide with a sibling document in the other language. Use the repository configuration, OpenAPI contract, and application source as facts; a lightweight Node verifier enforces the documentation map, language pairs, switch links, and local Markdown links.

**Tech Stack:** Markdown, Node.js 26, pnpm, OpenAPI 3.1, Next.js 16, Laravel 13, Docker Compose.

## Global Constraints

- Keep the canonical product path `archive-next/` + `archive-laravel/` and Docker deployment as the documented default.
- Arabic is natural Modern Standard Arabic, written for product users; translate technical identifiers only when they have an established Arabic product term.
- English and Arabic prose are editorial equivalents, not sentence-by-sentence machine translations.
- Do not alter historical evidence, implementation plans, audit reports, or archived changelog entries; a top-level status note may identify an archive without changing its entries.
- Public API claims must match `docs/api/archive-contract.openapi.json`.

---

### Task 1: Add a maintainable documentation inventory and verifier

**Files:**
- Create: `scripts/verify-public-documentation.mjs`
- Create: `scripts/verify-public-documentation.test.mjs`
- Modify: `package.json`
- Create: `docs/README.md`
- Create: `docs/README.ar.md`

**Interfaces:**
- Consumes: Markdown paths listed in `PUBLIC_DOCUMENTS` inside the verifier.
- Produces: `pnpm verify:public-docs`, exiting non-zero for missing language pairs, missing language-switch links, or missing local Markdown targets.

- [ ] **Step 1: Write failing tests for valid and invalid documentation maps**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDocumentation } from './verify-public-documentation.mjs';

test('reports a missing paired language file', () => {
  const result = validateDocumentation({ files: new Set(['README.md']) });
  assert.match(result.errors.join('\n'), /README\.ar\.md/);
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test scripts/verify-public-documentation.test.mjs`

Expected: FAIL because the verifier does not yet export `validateDocumentation`.

- [ ] **Step 3: Implement deterministic documentation validation**

Implement a path-pair manifest, `English | العربية` link check, and relative-link target check. The command must read only repository files and print each actionable error once.

- [ ] **Step 4: Add the pnpm entry point and two navigation pages**

Add `verify:public-docs` to `package.json`; write English and Arabic indexes separated into Start, Use, Operate, Develop, and Historical Records. Link only living documents from primary journeys.

- [ ] **Step 5: Verify Task 1**

Run: `node --test scripts/verify-public-documentation.test.mjs` and `pnpm verify:public-docs`

Expected: PASS after the initial language-pair manifest is populated.

### Task 2: Rebuild public entry points and installation guidance

**Files:**
- Modify: `README.md`, `INSTALL.md`, `DEPLOYMENT.md`
- Create: `README.ar.md`, `INSTALL.en.md`, `DEPLOYMENT.en.md`
- Modify: `docs/control-center.md`
- Create: `docs/control-center.ar.md`

**Interfaces:**
- Consumes: root package scripts, `infra/platform/toolchain.v1.json`, `infra/docker-compose.yml`, and Control Center commands.
- Produces: language-switched first-run and deployment pages that point to `docs/README*` for detailed guidance.

- [ ] **Step 1: Record factual commands and platform prerequisites from the source files**

Read `package.json`, `infra/platform/toolchain.v1.json`, `infra/.env.example`, and the Control Center help before writing commands. Use exact command spelling.

- [ ] **Step 2: Write English entry pages as concise, task-oriented guides**

Keep `README.md` suitable for GitHub discovery, make `INSTALL.en.md` the local developer path, and make `DEPLOYMENT.en.md` the Docker operator path. State capability limits rather than promising unverified integrations.

- [ ] **Step 3: Write independent Arabic companion pages**

Use Arabic headings and natural operational instructions such as “ابدأ هنا”، “إعدادات”، “نسخة احتياطية”، and “استعادة”. Preserve commands and configuration variables exactly.

- [ ] **Step 4: Verify navigation and editorial parity**

Run: `pnpm verify:public-docs`

Expected: PASS; each page has a valid language switch and both entry points reach the documentation index.

### Task 3: Cover product use and supported operations

**Files:**
- Modify: `docs/features-guide.md`, `docs/platform-parity.md`, `docs/local-observability.md`, `docs/semantic-search.md`, `docs/odbc-laravel-bridge.md`
- Create: `docs/features-guide.en.md`, `docs/platform-parity.ar.md`, `docs/local-observability.ar.md`, `docs/semantic-search.ar.md`, `docs/odbc-laravel-bridge.en.md`
- Modify: `archive-next/content/guide/viewer-search.md`, `archive-next/content/guide/editor-upload.md`, `archive-next/content/guide/admin-operations.md`, `archive-next/content/guide/whats-new.md`

**Interfaces:**
- Consumes: Next.js route and guide metadata, OpenAPI paths, Docker commands, and release evidence.
- Produces: current feature and operator descriptions that distinguish available, conditional, and unsupported capabilities.

- [ ] **Step 1: Map public claims to routes and API paths**

Use `archive-next/lib/guide-content.ts` and the OpenAPI paths to check each guide topic. Do not claim that a feature is enabled when the release notes describe it as conditional.

- [ ] **Step 2: Expand the Arabic product guides naturally**

Explain search, records, upload, files, rights, sharing, collaboration, administration, backup, monitoring, semantic search fallback, and ODBC as user tasks. Keep the in-app chapters concise and role-aware.

- [ ] **Step 3: Author English counterpart documents for public readers**

Create English guides with the same decision points and warnings, adapted to English technical writing. Do not force English into the Arabic-first in-app interface.

- [ ] **Step 4: Verify operations facts and links**

Run: `pnpm verify:public-docs`

Expected: PASS with no broken intra-repository links.

### Task 4: Align developer, backend, API, and deployment-reference documentation

**Files:**
- Modify: `CLAUDE.md`, `archive-laravel/README.md`, `archive-laravel/ARCHIVE_MIGRATION.md`, `docs/api/README.md`, `docs/versioning.md`, `docs/arabic-ui-glossary.md`
- Create: `CLAUDE.ar.md`, `archive-laravel/README.ar.md`, `archive-laravel/ARCHIVE_MIGRATION.ar.md`, `docs/api/README.ar.md`, `docs/versioning.ar.md`, `docs/arabic-ui-glossary.en.md`
- Modify: `infra/deploy/hostinger-vps.md`, `infra/k8s/README.md`, `infra/offline/README.ar.md`
- Create: `infra/deploy/hostinger-vps.en.md`, `infra/k8s/README.ar.md`, `infra/offline/README.md`

**Interfaces:**
- Consumes: OpenAPI document, package scripts, Docker Compose, environment example, and Laravel implementation.
- Produces: technically accurate developer and deployment references, with Laravel boilerplate replaced by product-specific material.

- [ ] **Step 1: Replace framework-template content with product context**

Rewrite the Laravel README around service ownership, development, test commands, and links to the shared API contract. Retain upstream Laravel links only where they help maintainers.

- [ ] **Step 2: Update migration and API documents from the contract**

Describe the canonical API and generation/verification process; treat old Node paths as historical reference, not a supported deployment fallback. Do not enumerate stale “first route groups” when the OpenAPI document is the complete route source.

- [ ] **Step 3: Produce companion language documents and deployment references**

Use language switches in all paired documents. Mark Kubernetes as a data-services reference rather than a supported application deployment path, and retain the offline installation warnings.

- [ ] **Step 4: Verify developer docs**

Run: `pnpm verify:public-docs`

Expected: PASS and no references to removed legacy package paths as current product instructions.

### Task 5: Audit release and historical boundaries, then run final checks

**Files:**
- Modify: `docs/ops/rc-launch-and-support.md`, `docs/release-notes/v1.0.0.md`
- Create: `docs/ops/rc-launch-and-support.en.md`, `docs/release-notes/v1.0.0.ar.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: the v1.0.0 release note and support/versioning policies.
- Produces: an explicit boundary between living release/support information and immutable historical records.

- [ ] **Step 1: Reconcile release wording**

If v1.0.0 is GA, update the support page title and opening scope accordingly; retain RC-only language only in archived release records. Translate the current GA release note with an Arabic editorial counterpart.

- [ ] **Step 2: Label the completed-change archive**

Add a short bilingual status note at the top of `CHANGELOG.md` stating that it is a historical completed-work archive and directing readers to the documentation index and current release notes.

- [ ] **Step 3: Run quality gates**

Run: `node --test scripts/verify-public-documentation.test.mjs`, `pnpm verify:public-docs`, `git diff --check`, and `pnpm typecheck`.

Expected: all checks pass; documentation-only changes leave application behavior and API contracts unchanged.

- [ ] **Step 4: Commit**

```bash
git add package.json scripts/verify-public-documentation.mjs scripts/verify-public-documentation.test.mjs README.md README.ar.md INSTALL.md INSTALL.en.md DEPLOYMENT.md DEPLOYMENT.en.md CLAUDE.md CLAUDE.ar.md docs archive-laravel infra
git commit -m "docs: publish bilingual documentation"
```
