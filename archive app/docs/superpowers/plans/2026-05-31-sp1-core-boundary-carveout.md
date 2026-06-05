# Sub-project 1 — Core Boundary Carve-out — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the shared core's public surface and boot seam *in place* (no mass file moves), so the later physical extraction into `archive-core` (SP2) is mechanical.

**Architecture:** Add a Node-safe public barrel (`src/core/index.js`) that re-exports the storage-agnostic contract (the 5 ports + the unified provider registry), an explicit boot seam (`src/bootstrap/registerLocalProviders.js`) that binds the local adapters via `register*` (template the cloud app will mirror), and a boundary manifest documenting core-vs-shell. The barrel stays Node-importable (no JSX/CSS) so `verify` can assert it; the running boot path (`main.js`) is left untouched (wiring deferred to SP3). Purely additive → zero behavior change.

**Tech Stack:** ES modules, existing `scripts/verify-modules.mjs` harness (`node:assert/strict`), Vite (`build:spa` single-file + `build:cloud` multi-file).

---

## File Structure

- **Create** `src/core/index.js` — the package public barrel (ports + registry getters/registrars). Node-safe.
- **Create** `src/bootstrap/registerLocalProviders.js` — explicit local-adapter wiring seam.
- **Create** `docs/superpowers/core-boundary-manifest.md` — authoritative core-vs-shell map (drives SP2).
- **Modify** `scripts/verify-modules.mjs` — add 2 `run(...)` test blocks + imports.

Out of scope (later sub-projects): moving files under `packages/core/` (SP2), consuming `@archive/core` (SP3), `cloud-pocketbase` + SessionProvider + Docker (SP4). No change to `src/main.js` boot path.

---

### Task 1: Core public barrel

**Files:**
- Create: `src/core/index.js`
- Test: `scripts/verify-modules.mjs` (new `run("core public barrel", …)` block + import)

- [ ] **Step 1: Create the barrel**

Create `src/core/index.js`:

```js
// Public surface of the storage-agnostic core — the future @archive/core package.
// SP1 exports the architectural contract only: the provider registry + the five
// ports. UI, stores, and the app entry are added to this barrel when the package
// is physically extracted (SP2/SP3). Kept Node-safe (no JSX/CSS imports) so the
// verify harness can import it directly.

export {
  getStorageProvider,
  registerStorageProvider,
  getFileStore,
  registerFileStore,
  getAuthProvider,
  registerAuthProvider,
  getSyncProvider,
  registerSyncProvider,
  getAiProvider,
  registerAiProvider
} from "../storage/index.js";

export { STORAGE_PROVIDER_METHODS, isStorageProvider } from "../storage/ports/StorageProvider.js";
export { FILE_STORE_METHODS, isFileStore } from "../storage/ports/FileStore.js";
export { AUTH_PROVIDER_METHODS, isAuthProvider } from "../storage/ports/AuthProvider.js";
export { SYNC_PROVIDER_METHODS, isSyncProvider } from "../storage/ports/SyncProvider.js";
export { AI_PROVIDER_METHODS, isAiProvider } from "../storage/ports/AiProvider.js";
```

- [ ] **Step 2: Add the failing test**

In `scripts/verify-modules.mjs`, add this import beside the existing storage imports (after the `from "../src/storage/index.js"` import block):

```js
import * as core from "../src/core/index.js";
```

Then add this block immediately before the line `// Theme v2 storage tests — runs the standalone test suite from`:

```js
run("core public barrel", () => {
  for (const fn of [
    "getStorageProvider", "registerStorageProvider",
    "getFileStore", "registerFileStore",
    "getAuthProvider", "registerAuthProvider",
    "getSyncProvider", "registerSyncProvider",
    "getAiProvider", "registerAiProvider"
  ]) {
    assert.equal(typeof core[fn], "function", `core barrel missing ${fn}`);
  }
  assert.deepEqual(core.STORAGE_PROVIDER_METHODS, STORAGE_PROVIDER_METHODS);
  assert.equal(core.isStorageProvider, isStorageProvider);
  assert.equal(typeof core.isFileStore, "function");
  assert.equal(typeof core.isAuthProvider, "function");
  assert.equal(typeof core.isSyncProvider, "function");
  assert.equal(typeof core.isAiProvider, "function");
  // The barrel re-exports the SAME live registry (not a copy).
  assert.equal(core.getStorageProvider(), getStorageProvider());
});
```

- [ ] **Step 3: Run verify**

Run: `npm run verify`
Expected: PASS — output includes `ok - core public barrel`. (If `src/core/index.js` were missing the assertions would throw at import time.)

- [ ] **Step 4: Commit**

```bash
git add src/core/index.js scripts/verify-modules.mjs
git commit -m "feat(sp1): core public barrel (ports + provider registry)"
```

---

### Task 2: Boot seam — registerLocalProviders

**Files:**
- Create: `src/bootstrap/registerLocalProviders.js`
- Test: `scripts/verify-modules.mjs` (new `run("register local providers seam", …)` block + import)

- [ ] **Step 1: Create the seam**

Create `src/bootstrap/registerLocalProviders.js`:

```js
import {
  registerStorageProvider,
  registerFileStore,
  registerAuthProvider,
  registerSyncProvider
} from "../storage/index.js";
import { localStorageProvider } from "../storage/adapters/local-indexeddb/index.js";
import { localFileStore } from "../storage/adapters/files-local/index.js";
import { localAuthProvider } from "../storage/adapters/local-auth/index.js";
import { localSyncProvider } from "../storage/adapters/local-sync/index.js";

// The offline SPA boot seam: explicitly bind the local adapters through the
// registry. They are already the registry defaults, so this is idempotent today
// — it exists so the SPA app OWNS its wiring symmetrically with the cloud app's
// future registerCloudProviders(). AiProvider is intentionally left at its
// default stub (no local AI yet).
export function registerLocalProviders() {
  registerStorageProvider(localStorageProvider);
  registerFileStore(localFileStore);
  registerAuthProvider(localAuthProvider);
  registerSyncProvider(localSyncProvider);
  return {
    storage: localStorageProvider,
    files: localFileStore,
    auth: localAuthProvider,
    sync: localSyncProvider
  };
}
```

- [ ] **Step 2: Add the failing test**

In `scripts/verify-modules.mjs`, add this import beside the other storage adapter imports:

```js
import { registerLocalProviders } from "../src/bootstrap/registerLocalProviders.js";
```

Then add this block immediately before the `// Theme v2 storage tests` comment line (after the "core public barrel" block):

```js
run("register local providers seam", () => {
  const result = registerLocalProviders();
  assert.equal(getStorageProvider(), localStorageProvider);
  assert.equal(getFileStore(), localFileStore);
  assert.equal(getAuthProvider(), localAuthProvider);
  assert.equal(getSyncProvider(), localSyncProvider);
  assert.equal(result.storage, localStorageProvider);
  assert.equal(result.files, localFileStore);
  assert.equal(result.auth, localAuthProvider);
  assert.equal(result.sync, localSyncProvider);
});
```

(`getStorageProvider`, `getFileStore`, `getAuthProvider`, `getSyncProvider`, `localStorageProvider`, `localFileStore`, `localAuthProvider`, `localSyncProvider` are already imported into the harness from earlier blocks.)

- [ ] **Step 3: Run verify**

Run: `npm run verify`
Expected: PASS — output includes `ok - register local providers seam`.

- [ ] **Step 4: Commit**

```bash
git add src/bootstrap/registerLocalProviders.js scripts/verify-modules.mjs
git commit -m "feat(sp1): explicit local-provider boot seam"
```

---

### Task 3: Core boundary manifest

**Files:**
- Create: `docs/superpowers/core-boundary-manifest.md`

- [ ] **Step 1: Write the manifest**

Create `docs/superpowers/core-boundary-manifest.md`:

```markdown
# بيان حدود النواة (Core Boundary Manifest)

المرجع المعتمد لما سيُنقل إلى حزمة `archive-core` (SP2) مقابل ما يبقى داخل كل تطبيق.
القاعدة: ما لا يسمّي خلفيةً ملموسة → نواة؛ ما يلمس خلفية/تشغيلًا → قشرة تطبيق.

## نواة (→ archive-core)
- `src/core/` — المدخل العام (barrel).
- `src/storage/ports/` — كل المنافذ (Storage/File/Auth/Sync/Ai، ولاحقًا Session).
- `src/storage/index.js` — سجلّ المزوّدات الموحّد.
- `src/stores/`, `src/features/`, `src/pages/`, `src/components/`, `src/app/`,
  `src/services/` (عدا طبقة IndexedDB)، `src/theme/`, `src/utils/`, `src/styles/`.
- `scripts/verify-modules*.mjs` — اختبارات النواة.

## قشرة SPA (→ archive-spa)
- `src/storage/adapters/local-indexeddb/`, `files-local/`, `local-auth/`, `local-sync/`,
  `ai-local-stub/`.
- `src/services/storage/` — تنفيذ IndexedDB الفعلي (DB_NAME/الترقيات/المخطّط).
- `src/bootstrap/registerLocalProviders.js`، `src/main.js` (المدخل)، إعداد بناء الملف‑الواحد.

## قشرة السيرفر (→ archive-server)
- `src/storage/adapters/cloud-pocketbase/` (يُنشأ في SP4)، `registerCloudProviders`،
  مدخل cloud، `pocketbase/` (مخطّط + docker)، إعداد البناء متعدّد الملفات.

## ملاحظات نقل
- المدخل العام `src/core/index.js` يُوسَّع وقت الاستخراج ليشمل مدخل التطبيق والواجهة
  (JSX) بعد ضبط بناء المكتبة؛ في SP1 يبقى Node-safe (منافذ + سجلّ فقط).
- `src/services/storage/` (IndexedDB) قشرةُ SPA وليست نواة — النواة تعتمد المنفذ لا التنفيذ.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/core-boundary-manifest.md
git commit -m "docs(sp1): core boundary manifest"
```

---

### Task 4: Verify gates + builds + PR

**Files:** none (validation only)

- [ ] **Step 1: Full verify**

Run: `npm run verify`
Expected: PASS — includes `ok - core public barrel` and `ok - register local providers seam`; no failures.

- [ ] **Step 2: SPA single-file build**

Run: `npm run build:spa`
Expected: success; output `dist/index.html` as a single inlined file. (New `src/core` + `src/bootstrap` modules are not yet imported by the boot path, so the bundle is unchanged.)

- [ ] **Step 3: Cloud multi-file build**

Run: `npm run build:cloud`
Expected: success; multi-file output under `dist-cloud/`.

- [ ] **Step 4: Open + merge PR**

```bash
git push -u origin feat/sp1-core-boundary-carveout
gh pr create --head feat/sp1-core-boundary-carveout --base main \
  --title "feat(sp1): نحت حدود النواة (مدخل عام + seam إقلاع + بيان حدود)" \
  --body "ينفّذ المشروع الفرعي 1 من تصميم الفصل إلى 3 مستودعات: مدخل النواة العام، seam تسجيل المحوّلات المحلية، وبيان الحدود. إضافي بالكامل — verify + البناءان أخضران، بلا تغيير سلوك."
gh pr merge --squash --delete-branch
```

---

## Self-Review

**1. Spec coverage:** SP1 in the spec requires (a) public core entry `src/core/index.js` ✅ Task 1, (b) boot seam `src/bootstrap/registerLocalProviders.js` ✅ Task 2, (c) boundary manifest ✅ Task 3, (d) verify + both builds green, no behavior change ✅ Task 4. No gaps.

**2. Placeholder scan:** No TBD/TODO; every code step has complete code; commands have expected output.

**3. Type/name consistency:** Barrel re-export names match `src/storage/index.js` exports verified in the repo (`getStorageProvider`/`registerStorageProvider`/`getFileStore`/`registerFileStore`/`getAuthProvider`/`registerAuthProvider`/`getSyncProvider`/`registerSyncProvider`/`getAiProvider`/`registerAiProvider`). Port method-array + validator names match the port files (`STORAGE_PROVIDER_METHODS`/`isStorageProvider`, etc.). `registerLocalProviders` used identically in Task 2 implementation and test.
