# Phase 0 — SPA/Cloud Separation Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the storage-adapter seam (ports + local adapters) and split the build into `spa` (single-file) and `cloud` targets — with zero behavior change to the existing offline SPA.

**Architecture:** Introduce explicit `StorageProvider` and `FileStore` *ports* (documented JS contracts). The current IndexedDB code is wrapped as the `local-indexeddb` data adapter; a tiny registry returns the active provider (default = local). A `VITE_TARGET` env var makes `vite.config.js` apply `vite-plugin-singlefile` only for `spa`, while `cloud` produces a normal multi-file build. No consumer is forced onto the port yet (Phase 2 migrates consumers) — Phase 0 only lands the seam + build split safely.

**Tech Stack:** React 19, Vite 7, `@vitejs/plugin-react`, `@tailwindcss/vite`, `vite-plugin-singlefile`, IndexedDB, custom `scripts/verify-modules.mjs` assertion harness (no test runner yet — that arrives in Phase 1).

---

### Task 1: StorageProvider + FileStore ports (documented contracts + shape validators)

**Files:**
- Create: `src/storage/ports/StorageProvider.js`
- Create: `src/storage/ports/FileStore.js`
- Modify: `scripts/verify-modules.mjs` (add a "storage ports" test block near the other `run(...)` blocks)

- [ ] **Step 1: Write the failing test** — append to `scripts/verify-modules.mjs` (after the last `run(...)` block, before any final summary):

```js
import { STORAGE_PROVIDER_METHODS, isStorageProvider } from "../src/storage/ports/StorageProvider.js";
import { FILE_STORE_METHODS, isFileStore } from "../src/storage/ports/FileStore.js";

run("storage ports", () => {
  assert.deepEqual(STORAGE_PROVIDER_METHODS, ["open", "get", "getAll", "put", "add", "delete", "clear", "putBatch", "deleteBatch"]);
  assert.equal(isStorageProvider({}), false);
  const stub = Object.fromEntries(STORAGE_PROVIDER_METHODS.map((m) => [m, () => {}]));
  assert.equal(isStorageProvider(stub), true);
  assert.deepEqual(FILE_STORE_METHODS, ["putBlob", "getUrl", "remove", "list"]);
  assert.equal(isFileStore(Object.fromEntries(FILE_STORE_METHODS.map((m) => [m, () => {}]))), true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run verify`
Expected: FAIL — `Cannot find module '../src/storage/ports/StorageProvider.js'`.

- [ ] **Step 3: Create `src/storage/ports/StorageProvider.js`**

```js
/**
 * StorageProvider port — the storage-agnostic contract the app's data layer
 * depends on. The local IndexedDB implementation and (later) the cloud
 * PocketBase implementation both satisfy this shape, so feature code never
 * names a concrete backend.
 *
 * Methods (all async, mirror the existing src/services/storage surface):
 *  open()                       -> Promise<void>     ensure backend ready
 *  get(store, key)              -> Promise<record|undefined>
 *  getAll(store)                -> Promise<record[]>
 *  put(store, record)           -> Promise<record>   upsert
 *  add(store, record)           -> Promise<record>   insert
 *  delete(store, key)           -> Promise<void>
 *  clear(store)                 -> Promise<void>
 *  putBatch(store, records[])   -> Promise<void>
 *  deleteBatch(store, keys[])   -> Promise<void>
 */
export const STORAGE_PROVIDER_METHODS = [
  "open", "get", "getAll", "put", "add", "delete", "clear", "putBatch", "deleteBatch"
];

export function isStorageProvider(candidate) {
  return Boolean(candidate) && STORAGE_PROVIDER_METHODS.every((method) => typeof candidate[method] === "function");
}
```

- [ ] **Step 4: Create `src/storage/ports/FileStore.js`**

```js
/**
 * FileStore port — blob storage for thumbnails / small files now, extensible
 * to large files + remote backends (Dropbox/FTP/S3) later. Independent of the
 * data StorageProvider.
 *
 *  putBlob(key, blob, meta?) -> Promise<{ key, url }>
 *  getUrl(key)               -> Promise<string|null>   displayable URL
 *  remove(key)               -> Promise<void>
 *  list(prefix?)             -> Promise<string[]>
 */
export const FILE_STORE_METHODS = ["putBlob", "getUrl", "remove", "list"];

export function isFileStore(candidate) {
  return Boolean(candidate) && FILE_STORE_METHODS.every((method) => typeof candidate[method] === "function");
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run verify`
Expected: PASS — "ok - storage ports".

- [ ] **Step 6: Commit**

```bash
git add src/storage/ports/StorageProvider.js src/storage/ports/FileStore.js scripts/verify-modules.mjs
git commit -m "feat(storage): add StorageProvider + FileStore ports (Phase 0)"
```

---

### Task 2: local-indexeddb adapter + provider registry (default = local)

**Files:**
- Create: `src/storage/adapters/local-indexeddb/index.js`
- Create: `src/storage/index.js`
- Modify: `scripts/verify-modules.mjs` (extend the "storage ports" block)

- [ ] **Step 1: Write the failing test** — extend the `run("storage ports", ...)` block with:

```js
import { localStorageProvider } from "../src/storage/adapters/local-indexeddb/index.js";
import { getStorageProvider, registerStorageProvider } from "../src/storage/index.js";

run("local storage adapter + registry", () => {
  assert.equal(isStorageProvider(localStorageProvider), true);
  assert.equal(getStorageProvider(), localStorageProvider); // default is local
  const fake = Object.fromEntries(STORAGE_PROVIDER_METHODS.map((m) => [m, () => {}]));
  registerStorageProvider(fake);
  assert.equal(getStorageProvider(), fake);
  registerStorageProvider(localStorageProvider); // restore default
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run verify`
Expected: FAIL — cannot find `src/storage/adapters/local-indexeddb/index.js`.

- [ ] **Step 3: Create `src/storage/adapters/local-indexeddb/index.js`** — wraps the existing storage module (zero behavior change; functions are re-bound to the port names):

```js
import {
  openStorageDb,
  dbGet,
  dbGetAll,
  dbPut,
  dbAdd,
  dbDelete,
  dbClear,
  dbPutBatch,
  dbDeleteBatch
} from "../../../services/storage/index.js";

/**
 * The offline SPA data adapter: the existing IndexedDB implementation exposed
 * through the StorageProvider port shape. No behavior change — these are the
 * same functions the app already uses.
 */
export const localStorageProvider = {
  open: openStorageDb,
  get: dbGet,
  getAll: dbGetAll,
  put: dbPut,
  add: dbAdd,
  delete: dbDelete,
  clear: dbClear,
  putBatch: dbPutBatch,
  deleteBatch: dbDeleteBatch
};
```

- [ ] **Step 4: Create `src/storage/index.js`** — the registry that selects the active provider (default local):

```js
import { localStorageProvider } from "./adapters/local-indexeddb/index.js";
import { isStorageProvider } from "./ports/StorageProvider.js";

let activeProvider = localStorageProvider;

/** Returns the active StorageProvider (defaults to the local IndexedDB adapter). */
export function getStorageProvider() {
  return activeProvider;
}

/** Swap the active provider (cloud target / tests). Throws if shape is invalid. */
export function registerStorageProvider(provider) {
  if (!isStorageProvider(provider)) {
    throw new Error("Provided object does not satisfy the StorageProvider port.");
  }
  activeProvider = provider;
  return activeProvider;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run verify`
Expected: PASS — "ok - local storage adapter + registry".

- [ ] **Step 6: Build the SPA to confirm no regression**

Run: `npm run build`
Expected: build succeeds; `dist/index.html` produced (single file). The new modules are tree-shaken out unless imported — no behavior change.

- [ ] **Step 7: Commit**

```bash
git add src/storage/adapters/local-indexeddb/index.js src/storage/index.js scripts/verify-modules.mjs
git commit -m "feat(storage): local-indexeddb adapter + provider registry (Phase 0)"
```

---

### Task 3: FileStore local adapter (thumbnails / small files via data URLs)

**Files:**
- Create: `src/storage/adapters/files-local/index.js`
- Modify: `scripts/verify-modules.mjs` (extend the storage block)

Note: the SPA stores thumbnails as URL/string today. The local FileStore keeps blobs in the existing IndexedDB under a dedicated key namespace and returns object URLs, so the FileStore contract is real and exercised locally before cloud adapters arrive.

- [ ] **Step 1: Write the failing test** — extend the storage block:

```js
import { localFileStore } from "../src/storage/adapters/files-local/index.js";
run("local file store adapter", () => {
  assert.equal(isFileStore(localFileStore), true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run verify`
Expected: FAIL — cannot find `files-local/index.js`.

- [ ] **Step 3: Create `src/storage/adapters/files-local/index.js`**

```js
import { getStorageProvider } from "../../index.js";
import { STORES } from "../../../services/storage/schema.js";

// Thumbnails/small blobs live in the existing SETTINGS store under a prefix,
// keyed by `file:<key>`. Returns object URLs for display. (Large-file support
// and remote adapters arrive in later phases.)
const PREFIX = "file:";

export const localFileStore = {
  async putBlob(key, blob) {
    const provider = getStorageProvider();
    await provider.put(STORES.SETTINGS, { key: PREFIX + key, blob, updatedAt: new Date().toISOString() });
    return { key, url: typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(blob) : "" };
  },
  async getUrl(key) {
    const provider = getStorageProvider();
    const row = await provider.get(STORES.SETTINGS, PREFIX + key);
    if (!row || !row.blob) return null;
    return typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(row.blob) : null;
  },
  async remove(key) {
    const provider = getStorageProvider();
    await provider.delete(STORES.SETTINGS, PREFIX + key);
  },
  async list() {
    const provider = getStorageProvider();
    const rows = await provider.getAll(STORES.SETTINGS);
    return rows.filter((row) => String(row.key || "").startsWith(PREFIX)).map((row) => row.key.slice(PREFIX.length));
  }
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run verify`
Expected: PASS — "ok - local file store adapter".

- [ ] **Step 5: Commit**

```bash
git add src/storage/adapters/files-local/index.js scripts/verify-modules.mjs
git commit -m "feat(storage): local FileStore adapter (Phase 0)"
```

---

### Task 4: Build target split — `VITE_TARGET=spa|cloud`

**Files:**
- Modify: `vite.config.js`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Rewrite `vite.config.js`** to apply single-file only for the `spa` target:

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// VITE_TARGET selects the distribution:
//   spa   (default) -> offline single-file build (vite-plugin-singlefile)
//   cloud           -> standard multi-file build (hosted; cloud adapters)
const target = process.env.VITE_TARGET === "cloud" ? "cloud" : "spa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(target === "spa" ? [viteSingleFile({ removeViteModuleLoader: true })] : [])
  ],
  define: {
    __VITE_TARGET__: JSON.stringify(target)
  },
  build: {
    chunkSizeWarningLimit: 3000,
    outDir: target === "cloud" ? "dist-cloud" : "dist"
  },
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" }
});
```

- [ ] **Step 2: Add scripts to `package.json`** — replace the `"build"` line and add target builds. New `scripts` block:

```json
  "scripts": {
    "dev": "vite --host 127.0.0.1 --configLoader runner",
    "build": "npm run build:spa",
    "build:spa": "VITE_TARGET=spa vite build --configLoader runner",
    "build:cloud": "VITE_TARGET=cloud vite build --configLoader runner",
    "verify": "node scripts/verify-modules.mjs",
    "refactor:status": "node scripts/refactor-status.mjs",
    "check": "npm run verify && npm run build:spa",
    "preview": "vite preview --host 127.0.0.1 --configLoader runner"
  },
```

Note for Windows/cross-platform: if the bare `VITE_TARGET=... vite` form fails on the runner's shell, prefix with `cross-env` (add `cross-env` to devDependencies and use `cross-env VITE_TARGET=cloud vite build`). Decide at execution time based on the shell; the project's CI/runner is the source of truth.

- [ ] **Step 3: Verify the SPA build is unchanged (single file)**

Run: `npm run build:spa`
Expected: succeeds; `dist/index.html` is a single inlined file (same as before).

- [ ] **Step 4: Verify the cloud build produces multi-file output**

Run: `npm run build:cloud`
Expected: succeeds; `dist-cloud/` contains `index.html` + separate `assets/*.js` / `*.css` (NOT inlined). This proves the split works even though both targets currently wire the same local adapters (cloud adapters land in Phase 2).

- [ ] **Step 5: Run verify**

Run: `npm run verify`
Expected: PASS (all blocks, including the new storage tests).

- [ ] **Step 6: Add `dist-cloud/` to `.gitignore`** (cloud build output is not committed like the SPA single file):

Append to `.gitignore`:
```
dist-cloud/
```

- [ ] **Step 7: Commit**

```bash
git add vite.config.js package.json .gitignore
git commit -m "build: split spa (single-file) and cloud build targets via VITE_TARGET (Phase 0)"
```

---

## Self-Review

**Spec coverage (Phase 0 portion of `2026-05-30-spa-cloud-separation-production.md`):**
- "Extract `StorageProvider` + `FileStore` ports" → Task 1 ✓
- "refactor current code into `local-*` adapters (no behavior change)" → Task 2 (local-indexeddb) + Task 3 (files-local) ✓ (wrappers, zero behavior change)
- "split the build via `VITE_TARGET`" → Task 4 ✓
- "keep `npm run verify` + single-file SPA build green" → Task 2 Step 6, Task 4 Steps 3 & 5 ✓
- `AuthProvider`/`SyncProvider` ports are intentionally deferred to Phase 2 (they only have a cloud implementation; defining them now would be empty contracts — YAGNI for Phase 0). Documented here so it is a deliberate scope choice, not a gap.

**Placeholder scan:** No TBD/TODO; every code step has complete code. The only conditional note (cross-env) is an explicit execution-time decision with the exact fallback command given.

**Type/name consistency:** `STORAGE_PROVIDER_METHODS`, `isStorageProvider`, `localStorageProvider`, `getStorageProvider`, `registerStorageProvider`, `FILE_STORE_METHODS`, `isFileStore`, `localFileStore` are used consistently across Tasks 1–3. `STORES.SETTINGS` matches the existing schema export used by Task 3.

**Scope:** Phase 0 is foundation-only and non-breaking — consumers are NOT migrated to the port here (that is Phase 2, alongside the cloud adapter), keeping blast radius minimal.
