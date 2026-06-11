import { jsx, jsxs } from "react/jsx-runtime";
import { Search, X } from "lucide-react";

const ACTION_OPTIONS = [
  { value: "", label: "كل الإجراءات" },
  { value: "create", label: "إنشاء" },
  { value: "update", label: "تعديل" },
  { value: "delete", label: "حذف" },
  { value: "restore", label: "استعادة" },
  { value: "move", label: "نقل" },
  { value: "bulk_update", label: "تعديل جماعي" },
  { value: "bulk_delete", label: "حذف جماعي" }
];

const TARGET_OPTIONS = [
  { value: "", label: "كل الأنواع" },
  { value: "item", label: "عنصر" },
  { value: "collection", label: "مجموعة" },
  { value: "type", label: "نوع" },
  { value: "folder", label: "مجلد" },
  { value: "settings", label: "إعدادات" }
];

/**
 * Filter bar for the activity timeline: free-text + action + target type.
 * value = { query, action, targetType }, onChange(partial).
 */
export function ActivityFilterBar({ value = {}, onChange }) {
  const hasFilters = Boolean(value.query || value.action || value.targetType);
  const update = (patch) => onChange?.(patch);
  return jsxs("section", {
    className: "va-filter-surface rounded-2xl va-surface-muted border p-4",
    dir: "rtl",
    children: [
      jsxs("div", {
        className: "grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]",
        children: [
          jsxs("label", {
            className: "relative block",
            children: [
              jsx(Search, { className: "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" }),
              jsx("input", {
                value: value.query || "",
                onChange: (event) => update({ query: event.target.value }),
                placeholder: "ابحث باسم العنصر أو المستخدم أو الوصف...",
                className: "min-h-11 w-full va-surface-deep rounded-xl border py-2 pl-3 pr-10 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-emerald-500/40"
              })
            ]
          }),
          jsx("select", {
            value: value.action || "",
            onChange: (event) => update({ action: event.target.value }),
            "aria-label": "تصفية حسب الإجراء",
            className: "min-h-11 va-surface-deep rounded-xl border px-3 text-sm text-white outline-none",
            children: ACTION_OPTIONS.map((option) => jsx("option", { value: option.value, children: option.label }, option.value || "all"))
          }),
          jsx("select", {
            value: value.targetType || "",
            onChange: (event) => update({ targetType: event.target.value }),
            "aria-label": "تصفية حسب نوع الهدف",
            className: "min-h-11 va-surface-deep rounded-xl border px-3 text-sm text-white outline-none",
            children: TARGET_OPTIONS.map((option) => jsx("option", { value: option.value, children: option.label }, option.value || "all"))
          }),
          hasFilters && jsxs("button", {
            type: "button",
            onClick: () => update({ query: "", action: "", targetType: "" }),
            className: "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-gray-300 hover:bg-white/10",
            children: [jsx(X, { className: "h-3.5 w-3.5" }), "مسح الفلاتر"]
          })
        ]
      })
    ]
  });
}

export default ActivityFilterBar;
