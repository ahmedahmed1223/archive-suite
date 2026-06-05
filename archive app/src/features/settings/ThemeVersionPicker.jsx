import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { Sparkles, Check, RotateCcw, Clock } from "lucide-react";

import {
  DEFAULT_THEME_VERSION,
  storeThemeVersion
} from "../../theme/themeVersionStorage.js";

const PREVIEW_SECONDS = 30;

/** Sets the live <html data-theme-version> attribute. */
function applyThemeVersionAttribute(version) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme-version", version);
}

const OPTIONS = [
  {
    id: "v4",
    title: "زجاجي أخضر",          /* gloss: "Glass Green" */
    detail: "هوية حديثة — أسطح زجاجية للحواف، أخضر زمردي، وتباين عالٍ.", /* gloss: "Modern identity — glass chrome, emerald green, high contrast." */
    badge: "افتراضي"              /* gloss: "Default" */
  },
  {
    id: "v3",
    title: "مركز التحكم",
    detail: "هوية تشغيلية — graphite داكن، تقارير مختصرة، وبحث داخل شاشة مركزية."
  },
  {
    id: "v1",
    title: "كلاسيكي",
    detail: "نمط Office الهادئ والمحترف — ألوان مكتومة وحواف صغيرة."
  },
  {
    id: "v2",
    title: "حديث",
    detail: "نمط Linear/Vercel — تدرّجات لونية، ظلال، وحواف أكبر."
  }
];

const DEFAULT_OPTION = OPTIONS.find((option) => option.id === DEFAULT_THEME_VERSION) || OPTIONS[0];

/**
 * Lets the user switch theme version with live preview.
 *
 * `value` is the persisted themeVersion ("v1" | "v2" | "v3" | "v4").
 * `onChange(version)` persists the choice (caller writes to settings).
 * This component also mirrors to localStorage + applies the live
 * <html> attribute so the change is instant without a reload.
 */
export function ThemeVersionPicker({ value = DEFAULT_THEME_VERSION, onChange, commitOnSelect = true }) {
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
    if (commitOnSelect) {
      applyThemeVersionAttribute(version);
      storeThemeVersion(version);
    }
    onChange?.(version);
  }, [clearPreviewTimer, commitOnSelect, onChange]);

  const startPreview = React.useCallback(() => {
    applyThemeVersionAttribute(DEFAULT_THEME_VERSION);
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
        className: "grid gap-2 lg:grid-cols-3",
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
      value !== DEFAULT_THEME_VERSION && !previewing && jsxs("button", {
        type: "button",
        onClick: startPreview,
        className: "inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-200 transition-colors hover:bg-white/5",
        children: [
          jsx(Sparkles, { className: "h-4 w-4 text-emerald-300" }),
          `معاينة ${DEFAULT_OPTION.title} لمدة ${PREVIEW_SECONDS} ثانية`
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
              `معاينة ${DEFAULT_OPTION.title} — يعود تلقائيًا خلال ${previewLeft} ثانية`
            ]
          }),
          jsxs("div", {
            className: "flex gap-2",
            children: [
              jsxs("button", {
                type: "button",
                onClick: () => commit(DEFAULT_THEME_VERSION),
                className: "inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30",
                children: [jsx(Check, { className: "h-3.5 w-3.5" }), `احتفظ بـ ${DEFAULT_OPTION.title}`]
              }),
              jsxs("button", {
                type: "button",
                onClick: cancelPreview,
                className: "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5",
                children: [jsx(RotateCcw, { className: "h-3.5 w-3.5" }), "إلغاء المعاينة"]
              })
            ]
          })
        ]
      })
    ]
  });
}

export default ThemeVersionPicker;
