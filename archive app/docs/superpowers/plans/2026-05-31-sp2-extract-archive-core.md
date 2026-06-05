# Sub-project 2 — Extract `archive-core` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Steps use `- [ ]`.

**Goal:** Make the core truly backend-agnostic (dependency injection), then stand up the published `archive-core` package consumed via git tag.

**Architecture:** First sever the only core→shell coupling — the provider registry currently imports concrete local adapters to seed defaults. Invert to pure DI: the registry names no backend; each app's bootstrap registers adapters (`registerLocalProviders` already exists from SP1). Then populate the new `archive-core` repo with the core subset, give it a Vite library build + a core-only test run, and tag `v1.0.0`. `archive-app` stays whole until SP3.

**Tech Stack:** ES modules, `scripts/verify-modules.mjs`, Vite (lib mode for the package), git-tag dependency.

---

## Phase SP2-A — Invert registry to dependency injection (in `archive-app`, safe PR)

### Task 1: Registry is pure DI (no adapter imports)

**Files:**
- Modify: `src/storage/index.js`
- Modify: `src/bootstrap/registerLocalProviders.js`
- Test: `scripts/verify-modules.mjs`

- [ ] **Step 1: Rewrite the registry without adapter imports**

Replace the entire body of `src/storage/index.js` with:

```js
import { isStorageProvider } from "./ports/StorageProvider.js";
import { isFileStore } from "./ports/FileStore.js";
import { isAuthProvider } from "./ports/AuthProvider.js";
import { isSyncProvider } from "./ports/SyncProvider.js";
import { isAiProvider } from "./ports/AiProvider.js";

// Unified provider registry — pure dependency injection. The core names no
// concrete backend; each app's bootstrap registers its adapters at startup
// (registerLocalProviders for the SPA, registerCloudProviders for the server).
// Getters throw until configured so a missing bootstrap fails loudly.

let activeStorageProvider = null;
let activeFileStore = null;
let activeAuthProvider = null;
let activeSyncProvider = null;
let activeAiProvider = null;

function makeRegistry(label, validate, getActive, setActive) {
  return {
    get() {
      const active = getActive();
      if (!active) {
        throw new Error(`${label} not configured. Call the app bootstrap (e.g. registerLocalProviders) before use.`);
      }
      return active;
    },
    register(provider) {
      if (!validate(provider)) {
        throw new Error(`Provided object does not satisfy the ${label} port.`);
      }
      setActive(provider);
      return provider;
    }
  };
}

const storage = makeRegistry("StorageProvider", isStorageProvider, () => activeStorageProvider, (p) => { activeStorageProvider = p; });
const files = makeRegistry("FileStore", isFileStore, () => activeFileStore, (p) => { activeFileStore = p; });
const auth = makeRegistry("AuthProvider", isAuthProvider, () => activeAuthProvider, (p) => { activeAuthProvider = p; });
const sync = makeRegistry("SyncProvider", isSyncProvider, () => activeSyncProvider, (p) => { activeSyncProvider = p; });
const ai = makeRegistry("AiProvider", isAiProvider, () => activeAiProvider, (p) => { activeAiProvider = p; });

export const getStorageProvider = storage.get;
export const registerStorageProvider = storage.register;
export const getFileStore = files.get;
export const registerFileStore = files.register;
export const getAuthProvider = auth.get;
export const registerAuthProvider = auth.register;
export const getSyncProvider = sync.get;
export const registerSyncProvider = sync.register;
export const getAiProvider = ai.get;
export const registerAiProvider = ai.register;
```

- [ ] **Step 2: registerLocalProviders also binds the AI stub**

Edit `src/bootstrap/registerLocalProviders.js`: add the AI stub import and registration so `getAiProvider()` works after bootstrap.

Add imports:
```js
import { registerAiProvider } from "../storage/index.js";
import { localAiStubProvider } from "../storage/adapters/ai-local-stub/index.js";
```
Inside `registerLocalProviders()`, add `registerAiProvider(localAiStubProvider);` and add `ai: localAiStubProvider` to the returned object.

- [ ] **Step 3: Update verify — register before use**

In `scripts/verify-modules.mjs`, immediately after the import block and before the first `run(...)`, add:
```js
// The registry is now pure DI — bind the local adapters once before exercising it.
registerLocalProviders();
```
Then in the existing tests update the assertions that previously relied on an implicit default:
- In `run("local storage adapter + registry", …)`: keep `assert.equal(getStorageProvider(), localStorageProvider)` (now true post-bootstrap).
- In `run("local ai stub adapter + registry", …)`: keep `assert.equal(getAiProvider(), localAiStubProvider)` (now true post-bootstrap).
Add a new check to `run("register local providers seam", …)`:
```js
  assert.equal(getAiProvider(), localAiStubProvider);
  assert.equal(result.ai, localAiStubProvider);
```
And add a test that an unconfigured port throws:
```js
run("registry requires configuration", () => {
  // A fresh validate failure still rejects bad providers.
  assert.throws(() => registerStorageProvider({}), /StorageProvider port/);
});
```

- [ ] **Step 4: Run verify**

Run: `npm run verify`
Expected: PASS — all existing storage/auth/sync/ai/core/seam blocks `ok`, plus `ok - registry requires configuration`.

- [ ] **Step 5: Both builds**

Run: `npm run build:spa` then `npm run build:cloud`
Expected: both succeed. (No app code calls the registry yet, so the boot path is unaffected.)

- [ ] **Step 6: Commit + PR + merge**

```bash
git add src/storage/index.js src/bootstrap/registerLocalProviders.js scripts/verify-modules.mjs
git commit -m "refactor(sp2): registry is pure dependency injection (core names no backend)"
git push -u origin feat/sp2a-registry-di
gh pr create --base main --head feat/sp2a-registry-di --title "refactor(sp2-a): سجلّ المزوّدات حقن صرف (نواة بلا خلفية)" --body "..."
gh pr merge --squash --delete-branch
```

---

## Phase SP2-B — Populate the `archive-core` package (in the new repo)

> Repo already created: `github.com/ahmedahmed1223/archive-core` (public, empty).
> Done in a fresh clone — zero risk to `archive-app`. `archive-app` keeps its copy until SP3.

### Task 2: Scaffold the package
- Clone `archive-core`; add `package.json` (`"name": "@archive/core"`, `"type": "module"`, `peerDependencies`: react/react-dom, `exports` pointing at `src/core/index.js` for now), `.gitignore`, `README.md`, and copy `vite`/tailwind/eslint config skeletons.

### Task 3: Copy the core subset
- Copy per the manifest (`docs/superpowers/core-boundary-manifest.md`): `src/core`, `src/storage/ports`, `src/storage/index.js`, `src/stores`, `src/features`, `src/pages`, `src/components`, `src/app`, `src/theme`, `src/utils`, `src/styles`, and `src/services/*` **except** `src/services/storage` (IndexedDB shell). Do **not** copy `src/storage/adapters/*`, `src/bootstrap`, `src/main.js`.

### Task 4: Core-only verify
- Copy `scripts/verify-modules*.mjs`; strip blocks that import shell adapters/`services/storage`/the store-smoke globals; keep ports + registry (with injected fakes) + pure feature/view-model/util tests. Get `npm run verify` green in the package.

### Task 5: Library build + tag
- Add `vite.config.js` (lib mode, externalize react/react-dom), confirm `npm run build` emits ESM. Commit, then `git tag v1.0.0 && git push --tags`.

---

## Self-Review
- **Coverage:** SP2 spec = invert coupling (SP2-A Task 1) + physical core in a package (SP2-B Tasks 2–4) + tag (Task 5). The new-repo population is outlined at task granularity; each task is independently verifiable (`verify`/`build` gates). SP2-B tasks are deliberately coarser because they execute in a separate working tree and will be refined when entered.
- **Risk:** SP2-A is in-place but the registry is unused by the running app, so it cannot change behavior; verify + both builds gate it. SP2-B is isolated to the new repo.
- **Naming:** registry getter/registrar names unchanged (`getStorageProvider`…); `registerLocalProviders` signature extended (adds `ai`).
