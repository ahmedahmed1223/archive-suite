# TypeScript Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Archive Suite to TypeScript incrementally while keeping Vite, the planned Next.js frontend, Playwright, and Node-based verification working throughout.

**Architecture:** Establish package-level `tsconfig` files and a repo-wide `typecheck` gate first. Convert leaf modules before runtime entry points, keep `.js` import compatibility where Node currently imports source directly, and only tighten `checkJs` after converted surfaces are stable.

**Tech Stack:** TypeScript 5, React 19, Vite 8, future Next.js frontend, Laravel API migration plan, Vitest, Playwright, Node 22 ESM, pnpm workspaces.

---

### Task 1: TypeScript Foundation

**Files:**
- Create: `tsconfig.base.json`
- Create: `tsconfig.json`
- Create: `archive-app/tsconfig.json`
- Create: `archive-core/tsconfig.json`
- Create: `archive-server/tsconfig.json`
- Modify: `package.json`
- Modify: `archive-app/package.json`
- Modify: `archive-core/package.json`
- Modify: `archive-server/package.json`
- Create: `archive-app/src/types/runtime.ts`
- Create: `archive-core/src/types/ports.ts`
- Create: `archive-server/src/types/runtime.ts`

- [x] **Step 1: Add TypeScript as a workspace dev dependency**

Run:

```powershell
pnpm add -Dw typescript
```

Expected: `package.json` gains `devDependencies.typescript`, and `pnpm-lock.yaml` records the exact package version.

- [x] **Step 2: Add the base config**

Create `tsconfig.base.json` with strict defaults, `allowJs: true`, `checkJs: false`, `moduleResolution: "Bundler"`, `noEmit: true`, and React JSX support. This keeps JavaScript source accepted while only new/converted TypeScript is enforced.

- [x] **Step 3: Add package configs**

Create one `tsconfig.json` in each package. Include TypeScript files only (`src/**/*.ts`, `src/**/*.tsx`, and existing Playwright `.ts` files for the app). Do not include every `.js` file yet; that would turn a migration foundation into a repo-wide cleanup task.

- [x] **Step 4: Add typecheck scripts**

Add:

```json
"typecheck": "tsc -p tsconfig.json --noEmit"
```

to each package and a root script that runs app, core, and server typechecks in order.

- [x] **Step 5: Add seed type files**

Add small `.ts` type-only files under each package so `tsc -p` has real package-local TypeScript inputs and future conversions have a stable place for shared types.

- [x] **Step 6: Verify the foundation**

Run:

```powershell
pnpm run typecheck
```

Expected: all three package typechecks exit 0.

### Task 2: Convert Leaf Utilities First

**Files:**
- Convert candidates after Task 1: `archive-app/src/utils/hijriDate.js`, `archive-app/src/features/media/transcriptToSrt.js`, `archive-app/src/features/media/subtitleParser.js`
- Keep JavaScript facade files when a Node-only script imports the old `.js` path.

- [x] **Step 1: Pick one leaf module with pure tests**

Choose a module with no JSX, no browser side effects, and existing Vitest coverage.

- [x] **Step 2: Convert implementation to `.ts`**

Rename the implementation file to `.ts` only when its importers are Vite/Vitest-safe. If Node imports the exact `.js` file, keep a `.js` facade that re-exports compiled-compatible code until the package runtime path changes.

- [x] **Step 3: Convert or preserve tests**

Prefer converting the paired test to `.test.ts`. Keep assertions unchanged so behavior remains stable.

- [x] **Step 4: Run focused tests**

Run the exact Vitest file for the converted module.

- [x] **Step 5: Run package typecheck**

Run the owning package `typecheck` command.

### Task 3: Protect Future Next.js Work

**Files:**
- Create later: `archive-next/`
- Modify later: shared API client/types under `archive-app/src/` or a new shared package
- Keep: `archive-app/src/main.js` until a Next.js shell is established.

- [x] **Step 1: Keep TypeScript module resolution compatible with Vite and Next.js**

Use `moduleResolution: "Bundler"` for the app. This matches Vite now and stays compatible with a future Next.js frontend package.

- [x] **Step 2: Do not convert the React root before the Next.js shell**

Keep `src/main.js`, `startVideoArchive.js`, and `RuntimeShellApp.js` as JavaScript until the Next.js shell has route parity and Playwright smoke tests pass.

- [x] **Step 3: Keep framework-specific typings isolated**

When Next.js is scaffolded, keep `next-env.d.ts` and Next-specific config inside the new Next package. Do not add Next-only types to the current Vite package.

### Task 4: Tighten Gradually

**Files:**
- Modify later: package `tsconfig.json` files
- Modify later: selected `src/**/*.js` modules as they become `.ts`/`.tsx`

- [x] **Step 1: Track converted surface area**

Update the TypeScript task in `TASKS.md` after each migration wave with counts for `.ts/.tsx` files and remaining JavaScript hot spots.

- [ ] **Step 2: Enable stricter checks package by package**

After a package has enough converted code, enable stricter local settings in that package only. Do not flip `checkJs` globally until the repository is ready.

- [x] **Step 3: Gate releases**

After `typecheck` is stable across several waves, add `pnpm run typecheck` to `release:verify`.
