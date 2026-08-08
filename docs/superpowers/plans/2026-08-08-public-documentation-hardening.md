# Public Documentation Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** جعل توثيق مسار العام دقيقًا ومتوازنًا بين العربية والإنجليزية، وفصل المحتوى التشغيلي الحي عن سجلات العمل الداخلية والتاريخية.

**Architecture:** يصبح `docs/public-docs.manifest.json` سجل النشر الوحيد للوثائق العامة، ويصنّف كل صفحة بحسب الجمهور واللغة ودورة الحياة ومصدر الحقيقة. يوسّع فاحص التوثيق الحالي ليغطي جميع ملفات Markdown، ويمنع الانحراف بين اللغتين أو بين ادعاءات الإصدار ومصادرها التقنية.

**Tech Stack:** Markdown، JSON، Node.js 26.5.0، pnpm 11.9.0، OpenAPI 3.1، وعقد المنصات في `infra/platform/`.

## Global Constraints

- الاسم التسويقي في النص العام هو «مسار» / `Masar`؛ يبقى `archive-suite` اسمًا تقنيًا للمستودع فقط.
- تستخدم الوثائق العربية لغة عربية فصيحة طبيعية، ولا تعتمد ترتيب الجملة الإنجليزية أو تعريبًا حرفيًا للمصطلحات.
- تبقى الأوامر والمسارات والمتغيرات وأسماء الحزم كما هي لتكون قابلة للنسخ.
- لا يُنشر سجل مهام داخلي أو قائمة قدرات قيد العمل ضمن مسار التوثيق العام.
- نتيجة فحص Native يملكها مسار العمل الموازي؛ لا تغيّر هذه الخطة حالة Native قبل استلام نتيجته الموثقة.
- لا تعاد كتابة تاريخ Git. إذا احتوى التاريخ على سر أو معلومة حساسة، يعالج ذلك بإجراء أمني منفصل ومصرح به.

---

### Task 1: Establish an explicit public-documentation boundary

**Files:**
- Create: `docs/public-docs.manifest.json`
- Modify: `scripts/verify-public-documentation.mjs`
- Modify: `scripts/verify-public-documentation.test.mjs`
- Modify: `docs/README.md`
- Modify: `docs/README.ar.md`

**Interfaces:**
- Consumes: every tracked `*.md` and `*.mdx` path returned by `git ls-files`.
- Produces: `loadPublicManifest()` and a validation error for every unclassified Markdown file.

- [ ] **Step 1: Write a failing coverage test**

```js
test("reports tracked Markdown that is absent from the publication manifest", () => {
  const result = validateDocumentation({
    files: new Set(["README.md", "README.ar.md", "docs/unclassified.md"]),
    contents: new Map([
      ["README.md", "[العربية](README.ar.md)"],
      ["README.ar.md", "[English](README.md)"],
      ["docs/unclassified.md", "# Internal note"],
    ]),
    documents: [{ english: "README.md", arabic: "README.ar.md", lifecycle: "living" }],
  });
  assert.match(result.errors.join("\n"), /docs\/unclassified\.md.*unclassified/i);
});
```

- [ ] **Step 2: Run the test and confirm the new assertion fails**

Run: `node --test scripts/verify-public-documentation.test.mjs`

Expected: FAIL because the current verifier knows only `PUBLIC_DOCUMENT_PAIRS` and does not classify all Markdown files.

- [ ] **Step 3: Add the publication manifest**

Use this document shape:

```json
{
  "schemaVersion": "1.0",
  "documents": [
    {
      "id": "repository-home",
      "audience": ["user", "operator", "developer"],
      "lifecycle": "living",
      "english": "README.md",
      "arabic": "README.ar.md",
      "sourceOfTruth": ["package.json", "infra/platform/toolchain.v1.json"]
    }
  ],
  "excludedTrees": [
    { "path": "docs/evidence/", "lifecycle": "historical-evidence" },
    { "path": "docs/superpowers/", "lifecycle": "internal-planning" }
  ]
}
```

- [ ] **Step 4: Replace the hard-coded pair array with manifest loading**

Export `loadPublicManifest(root)` and validate that every tracked Markdown path is either a listed public document or covered by one explicit excluded tree. Reject overlapping classifications and missing sources of truth.

- [ ] **Step 5: Remove historical and internal work links from the public index**

Keep `docs/README*` limited to Start, Use, Operate, Develop, API, Support, and Release Notes. Do not direct public readers to `TASKS.md`, `docs/superpowers/`, acceptance workbooks, or internal agent plans.

- [ ] **Step 6: Verify Task 1**

Run: `node --test scripts/verify-public-documentation.test.mjs` and `pnpm verify:public-docs`

Expected: PASS, with every Markdown file classified exactly once.

### Task 2: Reconcile public claims with release and platform truth

**Files:**
- Modify: `scripts/verify-public-documentation.mjs`
- Modify: `scripts/verify-public-documentation.test.mjs`
- Modify: `README.md`
- Modify: `README.ar.md`
- Modify: `docs/platform-parity.md`
- Modify: `docs/platform-parity.ar.md`
- Modify: `docs/native-installation.md`
- Modify: `docs/native-installation.ar.md`
- Read only: `infra/platform/release.v1.json`, `infra/setup/installation-manifest.json`, `infra/platform/compatibility.v1.json`

**Interfaces:**
- Consumes: package version, release-manifest version, platform status, and the Native verification result delivered by the parallel workstream.
- Produces: `validateReleaseClaims({ packageVersion, releaseVersion, platformContract, docs })`.

- [ ] **Step 1: Write release-drift tests**

```js
test("rejects a GA documentation claim backed by an RC release manifest", () => {
  const result = validateReleaseClaims({
    packageVersion: "1.0.0",
    releaseVersion: "1.0.0-rc.1",
    documentedVersion: "1.0.0",
  });
  assert.match(result.errors.join("\n"), /release manifest.*1\.0\.0-rc\.1/i);
});
```

- [ ] **Step 2: Add deterministic release and platform checks**

The verifier must reject a public version claim when `package.json`, `infra/platform/release.v1.json`, and `infra/setup/installation-manifest.json` disagree. It must also reject a platform labelled supported in docs when its platform contract is not supported.

- [ ] **Step 3: Synchronise Native wording after the parallel verification result arrives**

If the evidence confirms the full supported lifecycle, document install, start, stop, status, logs, update, rollback, backup, restore, and uninstall with the verified commands. If the evidence reports a narrower lifecycle, publish only that verified scope and omit internal follow-up work from public prose.

- [ ] **Step 4: Replace build instructions presented as installation instructions**

Separate “build a Native package” from “install a released Native package.” The user guide must begin with the release artifact and checksum workflow; contributor-only bundle commands move to the developer section.

- [ ] **Step 5: Verify Task 2**

Run: `pnpm verify:public-docs`, `pnpm verify:infra`, and the exact Native verification command supplied by the parallel workstream.

Expected: all three pass against the same commit and version.

### Task 3: Standardise naming, filenames, and information architecture

**Files:**
- Rename: `INSTALL.en.md` to `INSTALL.md`
- Rename: current Arabic `INSTALL.md` to `INSTALL.ar.md`
- Rename: `DEPLOYMENT.en.md` to `DEPLOYMENT.md`
- Rename: current Arabic `DEPLOYMENT.md` to `DEPLOYMENT.ar.md`
- Rename: `docs/ops/rc-launch-and-support.en.md` to `docs/ops/support.md`
- Rename: `docs/ops/rc-launch-and-support.md` to `docs/ops/support.ar.md`
- Rename: `scripts/verify-cutover-defaults.mjs` to `scripts/verify-canonical-defaults.mjs`
- Modify: `package.json`, `.github/workflows/ci.yml`, `scripts/verify-release-readiness.mjs`
- Modify: all entries in `docs/public-docs.manifest.json`
- Modify: all relative links that reference renamed files

**Interfaces:**
- Consumes: the language convention “English default, Arabic `.ar.md`”.
- Produces: one predictable filename rule across every living public guide.

- [ ] **Step 1: Write rename/link fixtures in the verifier test**

Assert that a living English page without the default `.md` name, or an Arabic page without `.ar.md`, fails unless the manifest declares a justified exception.

- [ ] **Step 2: Perform the renames with Git-aware moves**

Run the collision-safe sequence below so history remains readable, then update reciprocal language and index links in the same change:

```bash
git mv INSTALL.md INSTALL.ar.md
git mv INSTALL.en.md INSTALL.md
git mv DEPLOYMENT.md DEPLOYMENT.ar.md
git mv DEPLOYMENT.en.md DEPLOYMENT.md
git mv docs/ops/rc-launch-and-support.md docs/ops/support.ar.md
git mv docs/ops/rc-launch-and-support.en.md docs/ops/support.md
git mv scripts/verify-cutover-defaults.mjs scripts/verify-canonical-defaults.mjs
```

- [ ] **Step 3: Remove stage terminology from living filenames and headings**

Use `support.md` / `support.ar.md` for current support. Keep prerelease notes only as historical release artifacts and remove them from the public navigation.

Rename the internal verification command from `verify:cutover` to
`verify:canonical-defaults`, update all three call sites, and preserve the same
checks under the new name.

- [ ] **Step 4: Standardise the product name**

Use `Masar` / «مسار» in prose and titles. Use `archive-suite`, `Archive Suite`, or `ArchiveSuite` only where it is an exact repository, package, service, image, or path identifier.

- [ ] **Step 5: Verify Task 3**

Run: `pnpm verify:public-docs` and `git diff --check`

Expected: no broken relative links and no living public filename containing `rc`, `cutover`, or a prior-stage label.

### Task 4: Replace nominal translations with editorial parity

**Files:**
- Modify: every language pair in `docs/public-docs.manifest.json`
- Modify: `docs/arabic-ui-glossary.md`
- Modify: `docs/arabic-ui-glossary.en.md`
- Create: `docs/public-writing-style.md`
- Create: `docs/public-writing-style.ar.md`

**Interfaces:**
- Consumes: the public manifest and Arabic terminology glossary.
- Produces: paired guides with matching topics, warnings, commands, and decision points.

- [ ] **Step 1: Add section-parity validation**

Parse level-two headings and require each manifest entry to declare stable section IDs. The test must reject a pair where one language omits an operational section such as backup or restore.

- [ ] **Step 2: Rewrite the largest parity gaps first**

Work in this order: performance (115 Arabic lines versus 8 English), Laravel migration (99 versus 11), Hostinger deployment (75 versus 8), Kubernetes (36 versus 7), contributor guide (64 versus 14), then the remaining pairs whose length ratio exceeds 2:1.

- [ ] **Step 3: Improve Arabic terminology**

Replace «التثبيت الأصلي» with «التثبيت المباشر دون حاويات (Native)» on first use, then «التشغيل المباشر». Replace `secret manager` with «مخزن أسرار»، `tokens` with «رموز وصول»، and mixed untranslated prose with established Arabic while preserving exact identifiers.

- [ ] **Step 4: Author each language independently from a shared outline**

For every page, define the reader goal, prerequisites, task sequence, failure guidance, and next link. Review Arabic aloud for natural word order and review English for concise technical prose; do not translate sentence by sentence.

- [ ] **Step 5: Verify Task 4**

Run: `pnpm verify:public-docs` and the repository spelling/Markdown command added in Task 5.

Expected: all public pairs contain the same required section IDs and pass terminology checks.

### Task 5: Make documentation quality a release gate

**Files:**
- Modify: `scripts/verify-public-documentation.mjs`
- Modify: `scripts/verify-public-documentation.test.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the public manifest and all public Markdown files.
- Produces: a CI-enforced `pnpm verify:public-docs` gate with actionable diagnostics.

- [ ] **Step 1: Add failing tests for anchors, duplicate headings, and forbidden public terms**

Cover broken anchors, duplicated stable section IDs, public links into excluded internal trees, and stage terms in living documents. Allow exact technical identifiers through a manifest-level allowlist.

- [ ] **Step 2: Implement repository-wide checks**

Validate relative paths and anchors, reciprocal language links, stable section IDs, source-of-truth existence, duplicate titles, and prohibited links from public pages into internal trees.

- [ ] **Step 3: Add the documentation gate to the canonical verifier**

Change the root script to:

```json
"verify:laravel-next": "pnpm run verify:reproducibility && pnpm run verify:canonical-defaults && pnpm run verify:api-contracts && pnpm run verify:api-generated && pnpm run verify:service-thresholds && pnpm run verify:public-docs && pnpm run typecheck && pnpm run test:next && pnpm run build:next && pnpm run verify:repo-hygiene && pnpm run verify:laravel"
```

Add the same command to CI before packaging or publishing documentation.

- [ ] **Step 4: Run the final documentation gates**

Run: `node --test scripts/verify-public-documentation.test.mjs`, `pnpm verify:public-docs`, `pnpm verify:infra`, `pnpm typecheck`, and `git diff --check`.

Expected: every command exits 0 with no unclassified public document or broken link.

### Task 6: Remove internal work tracking from the public documentation surface

**Files:**
- Remove from the public branch after private archival: `TASKS.md`, `docs/agent-batches/`, and superseded internal plans selected by the repository owner
- Modify: `CHANGELOG.md`
- Modify: `docs/public-docs.manifest.json`

**Interfaces:**
- Consumes: an owner-approved private archival destination outside the public repository.
- Produces: a public tree containing release history and user-facing documentation, not active internal work queues.

- [ ] **Step 1: Produce a path-level archival inventory**

Run `rg -l -i "TASKS\.md|planned|conditional|GPU|Go/No-Go|open item" docs TASKS.md CHANGELOG.md` and classify every result as public release history, internal plan, evidence, or active public guidance.

- [ ] **Step 2: Archive internal-only material privately before removal**

Export the exact commit IDs and path list to the approved private system. Do not copy credentials, personal data, or archive content.

- [ ] **Step 3: Remove internal-only paths from the current public branch**

Delete only the owner-approved paths from Step 1. Keep public release notes and a concise user-facing changelog. Replace the 700+ KB completed-task ledger with version-level release links.

- [ ] **Step 4: Verify the public surface**

Run: `pnpm verify:public-docs`, `rg -n -i --glob 'README*.md' --glob 'features-guide*.md' --glob 'support*.md' "TASKS\.md|GPU|Go/No-Go" .`, and `git diff --check`.

Expected: no active public guide exposes internal task tracking, while historical release notes remain reachable only through their explicit archive classification.
