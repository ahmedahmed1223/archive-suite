# Theme v2 — PR C (Version Picker) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship `ThemeVersionPicker` in Settings → المظهر so users can flip between v1 (classic) and v2 (modern) and see it apply live, with a 30-second preview affordance. This is the first PR where v2 becomes reachable through the UI.

**Architecture:** A new presentational component reads `settings.ui.themeVersion`, and on change: (1) persists to IndexedDB via the existing `updateSettings` path, (2) mirrors to `localStorage` via PR A's `storeThemeVersion` so the boot path agrees, (3) sets `<html data-theme-version="…">` live so the change is instant — no reload. The 30s preview applies v2 temporarily with a countdown and keep/revert buttons. Default stays `v1`.

**Tech Stack:** React 19, framer-motion (already a dep), the SettingsControls `SettingsCard` primitive.

**Prerequisite:** PR A + PR B merged. `src/theme/themeVersionStorage.js` and `src/styles/v2-identity.css` exist on main.

---

## File Structure

**Create (1 file):**
- `src/features/settings/ThemeVersionPicker.jsx` — the picker card (~140 lines)

**Modify (1 file):**
- `src/pages/SettingsPage.jsx` — import + mount the picker at the top of `renderInterface()`

**Untouched:** tokens, component classes (PR A/B), every other file.

---

## Pre-flight

- [ ] **Branch + baseline**

```bash
git checkout main && git pull
git checkout -b feat/theme-v2-pr-c-picker
npm run build 2>&1 | tail -2   # record baseline ~1,601.8 kB
```

---

## Task 1: ThemeVersionPicker component

**Files:**
- Create: `src/features/settings/ThemeVersionPicker.jsx`

- [ ] **Step 1: Write the component**

Create `src/features/settings/ThemeVersionPicker.jsx`:

```jsx
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { Sparkles, Check, RotateCcw, Clock } from "lucide-react";

import { storeThemeVersion } from "../../theme/themeVersionStorage.js";

const PREVIEW_SECONDS = 30;

/** Sets the live <html data-theme-version> attribute. */
function applyThemeVersionAttribute(version) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme-version", version);
}

const OPTIONS = [
  {
    id: "v1",
    title: "كلاسيكي",
    detail: "نمط Office الهادئ والمحترف — ألوان مكتومة وحواف صغيرة."
  },
  {
    id: "v2",
    title: "حديث",
    detail: "نمط Linear/Vercel — تدرّجات لونية، ظلال، وحواف أكبر.",
    badge: "جديد"
  }
];

/**
 * Lets the user switch theme version with live preview.
 *
 * `value` is the persisted themeVersion ("v1" | "v2").
 * `onChange(version)` persists the choice (caller writes to settings).
 * This component also mirrors to localStorage + applies the live
 * <html> attribute so the change is instant without a reload.
 */
export function ThemeVersionPicker({ value = "v1", onChange }) {
  const [previewLeft, setPreviewLeft] = React.useState(0);
  const previewTimerRef = React.useRef(null);
  const previewing = previewLeft > 0;

  const clearPreviewTimer = React.useCallback(() => {
    if (previewTimerRef.current) {
      window.clearInterval(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => () => clearPreviewTimer(), [clearPreviewTimer]);

  const commit = React.useCallback((version) => {
    clearPreviewTimer();
    setPreviewLeft(0);
    applyThemeVersionAttribute(version);
    storeThemeVersion(version);
    onChange?.(version);
  }, [clearPreviewTimer, onChange]);

  const startPreview = React.useCallback(() => {
    applyThemeVersionAttribute("v2");
    setPreviewLeft(PREVIEW_SECONDS);
    clearPreviewTimer();
    previewTimerRef.current = window.setInterval(() => {
      setPreviewLeft((left) => {
        if (left <= 1) {
          clearPreviewTimer();
          applyThemeVersionAttribute(value); // revert to persisted
          return 0;
        }
        return left - 1;
      });
    }, 1000);
  }, [clearPreviewTimer, value]);

  const cancelPreview = React.useCallback(() => {
    clearPreviewTimer();
    setPreviewLeft(0);
    applyThemeVersionAttribute(value); // revert to persisted
  }, [clearPreviewTimer, value]);

  return jsxs("div", {
    className: "space-y-3",
    dir: "rtl",
    children: [
      jsx("div", {
        className: "grid gap-2 sm:grid-cols-2",
        role: "radiogroup",
        "aria-label": "إصدار الواجهة",
        children: OPTIONS.map((option) => {
          const active = value === option.id;
          return jsxs("button", {
            type: "button",
            role: "radio",
            "aria-checked": active,
            onClick: () => commit(option.id),
            className: `relative rounded-2xl border p-4 text-right transition-all ${
              active
                ? "border-emerald-400/45 bg-emerald-500/12 text-white shadow-lg shadow-emerald-500/10"
                : "border-white/10 bg-white/[0.035] text-gray-300 hover:border-emerald-500/25 hover:bg-white/[0.06]"
            }`,
            children: [
              option.badge && jsx("span", {
                className: "absolute left-3 top-3 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200",
                children: option.badge
              }),
              jsxs("div", {
                className: "flex items-center gap-2",
                children: [
                  active && jsx(Check, { className: "h-4 w-4 text-emerald-300" }),
                  jsx("p", { className: "font-semibold", children: option.title })
                ]
              }),
              jsx("p", { className: "mt-2 text-xs leading-6 text-gray-400", children: option.detail })
            ]
          }, option.id);
        })
      }),
      value === "v1" && !previewing && jsxs("button", {
        type: "button",
        onClick: startPreview,
        className: "inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-200 transition-colors hover:bg-white/5",
        children: [
          jsx(Sparkles, { className: "h-4 w-4 text-emerald-300" }),
          `معاينة الحديث لمدة ${PREVIEW_SECONDS} ثانية`
        ]
      }),
      previewing && jsxs("div", {
        className: "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3",
        role: "status",
        children: [
          jsxs("span", {
            className: "inline-flex items-center gap-2 text-sm text-emerald-100",
            children: [
              jsx(Clock, { className: "h-4 w-4" }),
              `معاينة النمط الحديث — يعود تلقائيًا خلال ${previewLeft} ثانية`
            ]
          }),
          jsxs("div", {
            className: "flex gap-2",
            children: [
              jsxs("button", {
                type: "button",
                onClick: () => commit("v2"),
                className: "inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30",
                children: [jsx(Check, { className: "h-3.5 w-3.5" }), "احتفظ بالحديث"]
              }),
              jsxs("button", {
                type: "button",
                onClick: cancelPreview,
                className: "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5",
                children: [jsx(RotateCcw, { className: "h-3.5 w-3.5" }), "ارجع للكلاسيكي"]
              })
            ]
          })
        ]
      })
    ]
  });
}

export default ThemeVersionPicker;
```

- [ ] **Step 2: Build to confirm it compiles**

Run: `npm run build 2>&1 | tail -3`
Expected: succeeds. Component isn't mounted yet so no visible change.

- [ ] **Step 3: Commit**

```bash
git add src/features/settings/ThemeVersionPicker.jsx dist/index.html
git commit -m "feat(theme-v2): ThemeVersionPicker component (PR C)

v1/v2 radio cards + 30s live preview with keep/revert. On commit
it mirrors to localStorage (storeThemeVersion), applies the live
<html data-theme-version> attribute, and calls onChange so the
caller persists to settings. Not mounted yet."
```

---

## Task 2: Mount in SettingsPage

**Files:**
- Modify: `src/pages/SettingsPage.jsx`

- [ ] **Step 1: Add the import**

In `src/pages/SettingsPage.jsx`, after the existing `SettingsControls.jsx` import block (around line 53), add:

```js
import { ThemeVersionPicker } from "../features/settings/ThemeVersionPicker.jsx";
```

- [ ] **Step 2: Mount the picker as the first card in renderInterface**

Find `const renderInterface = () => jsxs("div", {` (line ~213). Its `children` array starts with the "الهوية البصرية" SettingsCard. Insert a new SettingsCard BEFORE it as the first child:

```js
      jsx(SettingsCard, {
        title: "إصدار الواجهة",
        description: "بدّل بين النمط الكلاسيكي والنمط الحديث. التغيير فوري ويُحفظ تلقائيًا.",
        icon: jsx(Sparkles, { className: "h-5 w-5 text-emerald-400" }),
        children: jsx(ThemeVersionPicker, {
          value: settings.ui?.themeVersion || "v1",
          onChange: (version) => patchUi({ themeVersion: version }, version === "v2" ? "تم تفعيل النمط الحديث" : "تم تفعيل النمط الكلاسيكي")
        })
      }),
```

So the children array becomes `[<theme version card>, <الهوية البصرية card>, ...]`.

- [ ] **Step 3: Verify + build**

Run: `npm run verify 2>&1 | tail -5 && npm run build 2>&1 | tail -3`
Expected: all pass; build succeeds, ~+1 KB.

- [ ] **Step 4: Manual smoke test**

Open `dist/index.html` (or `npm run preview`). Go to Settings → المظهر. The first card should be "إصدار الواجهة" with two radio cards (كلاسيكي selected). Click "حديث" → page colors shift live (darker canvas, brighter indigo accent, larger radii). Click "كلاسيكي" → reverts. Reload → the choice persisted (boot reads localStorage + settings agree). Click "معاينة الحديث لمدة 30 ثانية" while on v1 → v2 applies + countdown; wait or click "ارجع" → reverts.

- [ ] **Step 5: Commit**

```bash
git add src/pages/SettingsPage.jsx dist/index.html
git commit -m "feat(theme-v2): mount ThemeVersionPicker in Settings appearance tab (PR C)

Adds the إصدار الواجهة card as the first item in renderInterface.
Wires value to settings.ui.themeVersion and persists changes via
patchUi. Users can now flip to v2 and see it apply live."
```

---

## Final verification

- [ ] **Full gate**

Run: `npm run verify 2>&1 | tail -8 && npm run build 2>&1 | tail -3`
Expected: all pass; build < 1,604 kB.

- [ ] **Confirm default unchanged**

Fresh install (clear localStorage + IndexedDB) → app boots v1 (classic). The picker shows كلاسيكي selected. No surprise.

- [ ] **Push + PR + merge**

```bash
git push -u origin feat/theme-v2-pr-c-picker
gh pr create --title "feat(theme-v2): version picker with live 30s preview (PR C)" --body "First user-facing v2 toggle. Settings → المظهر → إصدار الواجهة. Flips live, persists to localStorage + settings, default v1. Verify + build green."
gh pr merge --squash --delete-branch
git checkout main && git pull
```

---

## Self-Review Checklist

1. **Spec coverage** — picker UI ✓, 30s preview ✓, live apply ✓, localStorage+settings sync ✓, default v1 ✓.
2. **Sync correctness** — `commit()` writes BOTH localStorage (`storeThemeVersion`) AND settings (`onChange`→`patchUi`). On reload, `applyInitialThemeVersion` reads localStorage; settings is the IndexedDB backup. They agree because commit writes both.
3. **Preview safety** — the interval is cleared on unmount (effect cleanup), on commit, and on cancel. No leaked timers. Reverting uses the persisted `value`, not a hardcoded "v1".
4. **No scope creep** — no component opts into `.va-2-*` classes here; that's PR D. This PR only flips the token cascade via the attribute, which PR A already wired.

---

## What's next
- **PR D** — components opt into `.va-2-*` classes (the visible polish payoff)
- **PR E** — motion presets + light-mode refinement
- **Fonts PR** — self-host Inter + IBM Plex Sans Arabic
- **PR F** — flip default to v2 + opt-in banner
