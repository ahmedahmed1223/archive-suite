# PR 0 — Tabs Always Horizontal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Settings and DataCenter tab rails render as a horizontal top bar at **every** screen width — they must NOT collapse into a vertical sidebar at lg+ (≥1024px) as they do today.

**Architecture:** Pure CSS-class surgery in 4 files. The current components already render a horizontal scrollable bar below lg and switch to a vertical sidebar at lg via `lg:*` utilities. We remove the `lg:*` sidebar switches so the horizontal bar persists at all widths, and collapse the two-column page grids (`[sidebar_240/260px | content]`) into a single stacked column (bar on top, content below). The framer-motion `layoutId="settings-tab-active"` pill animation is preserved untouched.

**Tech Stack:** Vite 7, React 19, Tailwind CSS, framer-motion.

**Reference spec:** `docs/superpowers/specs/2026-05-29-cloud-mediadb-merge-roadmap-design.md` (PR 0).

**Note on testing:** this is a pure-layout (CSS className) change with no unit-testable logic. Verification is `npm run verify` (no regressions) + `npm run build` (compiles, size stable) + a manual resize smoke test. No new unit tests are added — adding a test that asserts className strings would be brittle and test the framework, not behavior.

---

## File Structure

**Modify (4 files):**
- `src/features/settings/SettingsControls.jsx` — `SettingsTabs`: drop the `lg:` sidebar switches in the nav, group wrapper, tab button, and tab label.
- `src/pages/SettingsPage.jsx` — the appearance/tabs page grid: `lg:grid-cols-[260px_minmax(0,1fr)]` → single stacked column.
- `src/pages/DataCenterPage.jsx` — the tabs `<section>` grid + the `<aside>` sticky + the tablist container: drop the `lg:` sidebar switches.
- `src/features/data-center/DataCenterViews.jsx` — `TabButton`: drop the `lg:w-full …` full-width-row rules so it stays an intrinsic chip.

**Untouched:** everything else. No JS logic, no stores, no other pages.

---

## Pre-flight

- [ ] **Confirm clean tree on main, branch**

```bash
git checkout main && git pull
git status         # expect clean
git checkout -b fix/tabs-always-horizontal
npm run build 2>&1 | tail -2   # record baseline ~1,612 kB
```

---

## Task 1: Settings tabs — always horizontal

**Files:**
- Modify: `src/features/settings/SettingsControls.jsx` (`SettingsTabs`, ~lines 235-284)
- Modify: `src/pages/SettingsPage.jsx` (tabs page grid, ~line 556)

- [ ] **Step 1: Make the `nav` a permanent horizontal bar**

In `src/features/settings/SettingsControls.jsx`, the `SettingsTabs` `nav` currently is:

```js
  return jsxs("nav", {
    className: cx(
      "va-tab-surface rounded-2xl border p-2",
      // Sidebar mode at lg+
      "lg:sticky lg:top-4 lg:h-fit",
      // Horizontal scroller below lg
      "flex gap-1 overflow-x-auto lg:block lg:overflow-visible"
    ),
```

Replace that `className: cx(...)` block with:

```js
  return jsxs("nav", {
    className: cx(
      "va-tab-surface rounded-2xl border p-2",
      // Always a horizontal scrollable bar — at every width.
      "flex gap-1 overflow-x-auto"
    ),
```

- [ ] **Step 2: Keep role groups inline (drop the `lg:block` switch)**

Still in `SettingsTabs`, the group wrapper `div` currently is:

```js
    children: grouped.map((group, groupIndex) => jsxs("div", {
      className: cx(
        // Stay inline below lg so groups flow horizontally.
        "flex shrink-0 items-center gap-1 lg:block",
        // Vertical separator chip on horizontal layout; horizontal
        // rule on sidebar layout.
        groupIndex > 0 ? "border-r border-white/10 pe-1 lg:mt-2 lg:border-r-0 lg:border-t lg:pt-2" : "",
        groupIndex > 0 ? "ps-1 lg:px-0" : ""
      ),
```

Replace that `className: cx(...)` block with:

```js
    children: grouped.map((group, groupIndex) => jsxs("div", {
      className: cx(
        // Always inline so role groups flow left-to-right on the bar.
        "flex shrink-0 items-center gap-1",
        // Vertical separator between groups (RTL: a right border).
        groupIndex > 0 ? "border-r border-white/10 pe-1 ps-1" : ""
      ),
```

- [ ] **Step 3: Hide the group label permanently + keep tab buttons as chips**

Still in `SettingsTabs`:

(a) The group label `<p>` is currently `className: "hidden lg:block px-3 pb-1 text-[10px] ..."`. It was only shown in sidebar mode. Change `"hidden lg:block ..."` to just `"hidden"` so it never renders on the bar:

```js
        jsx("p", {
          className: "hidden",
          children: group.label
        }),
```

(b) The tab `button` className currently is:

```js
            className: cx(
              "relative inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors",
              // Full-width row in sidebar mode, intrinsic chip in bar mode
              "lg:mb-1 lg:flex lg:w-full lg:gap-3 lg:px-3 lg:py-2.5 lg:text-right",
              selected ? "text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
            ),
```

Replace it with (drop the `lg:*` full-width-row line):

```js
            className: cx(
              "relative inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors",
              selected ? "text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
            ),
```

(c) The tab label `<span>` is currently `className: "relative lg:flex-1"`. Change to just `"relative"`:

```js
              jsx("span", { className: "relative", children: tab.label })
```

The `motion.span` with `layoutId: "settings-tab-active"` directly above it stays EXACTLY as-is — do not touch it.

- [ ] **Step 4: Collapse the SettingsPage two-column grid to a single stack**

In `src/pages/SettingsPage.jsx`, the tabs+content wrapper is:

```js
      jsxs("div", {
        className: "grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]",
        children: [
          jsx(SettingsTabs, { activeTab, onTabChange: setActiveTab }),
          jsx("div", { className: "min-w-0", children: tabContent[activeTab]?.() || renderGeneral() })
        ]
      })
```

Replace the `className` with a single stacked column (bar on top, content below):

```js
      jsxs("div", {
        className: "space-y-5",
        children: [
          jsx(SettingsTabs, { activeTab, onTabChange: setActiveTab }),
          jsx("div", { className: "min-w-0", children: tabContent[activeTab]?.() || renderGeneral() })
        ]
      })
```

- [ ] **Step 5: Build + verify**

```bash
npm run verify 2>&1 | tail -3
npm run build 2>&1 | tail -2
```
Expected: all verify checks pass; build succeeds; size within ~0.5 kB of baseline (className edits only).

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/SettingsControls.jsx src/pages/SettingsPage.jsx dist/index.html
git commit -m "fix(tabs): Settings tabs always horizontal (no lg sidebar)

SettingsTabs renders a horizontal scrollable bar at every width;
removed the lg: switches that turned it into a vertical sidebar.
SettingsPage grid collapsed to a single stacked column (bar on
top, content below). framer-motion active-pill layoutId preserved."
```

---

## Task 2: DataCenter tabs — always horizontal

**Files:**
- Modify: `src/pages/DataCenterPage.jsx` (tabs section, ~lines 978-992)
- Modify: `src/features/data-center/DataCenterViews.jsx` (`TabButton`)

- [ ] **Step 1: Collapse the DataCenter section grid + drop the sticky aside + horizontalize the tablist**

In `src/pages/DataCenterPage.jsx`, the tabs section currently is:

```js
      jsxs("section", {
        className: "grid gap-4 lg:grid-cols-[240px_1fr]",
        children: [
          jsxs("aside", {
            className: "va-tab-surface h-fit rounded-2xl border border-white/10 bg-gray-950/55 p-3 backdrop-blur-sm lg:sticky lg:top-4",
            children: [
              jsx("div", {
                // Horizontal scroller below lg, vertical sidebar list at lg+.
                className: "flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible",
                role: "tablist",
                "aria-label": "أقسام مركز البيانات",
                children: DATA_CENTER_TABS.map((tab) => jsx(TabButton, {
```

Make three edits in this block:

(a) Section grid → single column:
```js
      jsxs("section", {
        className: "space-y-4",
```

(b) `aside` → drop the `lg:sticky lg:top-4`:
```js
          jsxs("aside", {
            className: "va-tab-surface h-fit rounded-2xl border border-white/10 bg-gray-950/55 p-3 backdrop-blur-sm",
```

(c) tablist `div` → always horizontal:
```js
              jsx("div", {
                // Always a horizontal scrollable bar.
                className: "flex gap-2 overflow-x-auto",
                role: "tablist",
                "aria-label": "أقسام مركز البيانات",
```

- [ ] **Step 2: Keep the helper note hidden (it was sidebar-only) — verify it's already `hidden lg:block`**

Just below the tablist in the same `aside`, there is a helper `<div>`. Confirm its className contains `hidden lg:block` (it renders the "كل عملية حساسة …" note only in sidebar mode). Change `"mt-4 hidden lg:block rounded-xl …"` to `"mt-4 hidden rounded-xl …"` so the note stays hidden on the bar (it would look odd stretched under a horizontal tab strip).

Find:
```js
              jsx("div", {
                className: "mt-4 hidden lg:block rounded-xl border border-white/5 bg-gray-900/40 p-3 text-xs leading-relaxed text-gray-500",
                children: "كل عملية حساسة تمر بفحص مبدئي ونسخة احتياطية عند الاستيراد أو الاستعادة."
              })
```
Replace the className with:
```js
              jsx("div", {
                className: "mt-4 hidden rounded-xl border border-white/5 bg-gray-900/40 p-3 text-xs leading-relaxed text-gray-500",
                children: "كل عملية حساسة تمر بفحص مبدئي ونسخة احتياطية عند الاستيراد أو الاستعادة."
              })
```

- [ ] **Step 3: Make `TabButton` an intrinsic chip at all widths**

In `src/features/data-center/DataCenterViews.jsx`, `TabButton`'s className is currently:

```js
    className: `va-tool-button inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-sm transition-colors lg:w-full lg:gap-3 lg:px-3 lg:py-3 lg:text-right ${
      active
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
        : "border-white/5 bg-gray-900/40 text-gray-400 hover:border-white/10 hover:bg-white/5 hover:text-white"
    }`,
```

Replace with (drop the `lg:w-full lg:gap-3 lg:px-3 lg:py-3 lg:text-right`):

```js
    className: `va-tool-button inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-sm transition-colors ${
      active
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
        : "border-white/5 bg-gray-900/40 text-gray-400 hover:border-white/10 hover:bg-white/5 hover:text-white"
    }`,
```

- [ ] **Step 4: Build + verify**

```bash
npm run verify 2>&1 | tail -3
npm run build 2>&1 | tail -2
```
Expected: pass; build succeeds; size stable.

- [ ] **Step 5: Commit**

```bash
git add src/pages/DataCenterPage.jsx src/features/data-center/DataCenterViews.jsx dist/index.html
git commit -m "fix(tabs): DataCenter tabs always horizontal (no lg sidebar)

Section grid collapsed to single column; aside sticky + tablist
lg:flex-col removed so the tab strip stays a horizontal scrollable
bar at every width. TabButton stays an intrinsic chip (dropped the
lg full-width-row rules). Sidebar-only helper note kept hidden."
```

---

## Final verification

- [ ] **Full gate + manual smoke**

```bash
npm run verify 2>&1 | tail -5 && npm run build 2>&1 | tail -2
```
Expected: all pass; build ~1,612 kB (no material change).

Manual (open `dist/index.html` or `npm run preview`):
1. Settings → resize the window from ~375px up to ~1600px. The tab strip must remain a **horizontal bar across the top** at every width — never a vertical sidebar on the right.
2. Below the strip: the settings content fills the full width.
3. Switch tabs → the active-pill still slides smoothly (framer-motion `layoutId` intact).
4. DataCenter → same: tabs are a horizontal strip at all widths; content below full-width.
5. Narrow widths: the strip scrolls horizontally (swipe / shift-scroll) when tabs overflow.
6. Toggle theme v2 ↔ v1 → both look correct (this is structural, version-agnostic).

- [ ] **Push + PR + merge**

```bash
git push -u origin fix/tabs-always-horizontal
gh pr create --title "fix(tabs): Settings + DataCenter tabs always horizontal (PR 0)" --body "Tabs render as a horizontal top bar at every width — no vertical sidebar at lg+. Pure className surgery in 4 files; framer-motion active-pill preserved; page grids collapsed to single column. Verify + build green. First item of the CLOUD-MediaDB merge roadmap."
gh pr merge --squash --delete-branch
git checkout main && git reset --hard origin/main
```

---

## Self-Review

**1. Spec coverage** — PR 0 in the spec asks: Settings + DataCenter tabs horizontal at all widths, drop sidebar branch, collapse page grids, preserve layoutId. All covered: Task 1 (Settings nav/group/button/label + page grid), Task 2 (DataCenter section/aside/tablist/TabButton + helper note). layoutId line explicitly left untouched. ✓

**2. Placeholder scan** — every step shows the exact before/after className string. No TBD/TODO. ✓

**3. Consistency** — the same horizontalization pattern (`flex … overflow-x-auto`, drop `lg:*` sidebar switches, intrinsic chips) is applied identically to both surfaces. The `cx(...)` helper is already imported in SettingsControls; DataCenter uses template strings — both handled in their native style. ✓

**4. Risk** — pure CSS; v1 and v2 both inherit the change (structural, not token-based); no logic touched; fully reversible.
