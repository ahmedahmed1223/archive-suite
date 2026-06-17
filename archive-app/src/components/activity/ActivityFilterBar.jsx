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

// DaisyUI `select`/`input` base + bespoke surface/accent layered on top so the
// look (deep surface, emerald focus) is preserved while standardizing the control.
const selectClass = "select select-bordered w-full";
const dateClass = "input input-bordered";

/**
 * Filter bar for the activity timeline.
 * value = { query, action, targetType, dateFrom, dateTo }, onChange(partial).
 */
export function ActivityFilterBar({ value = {}, onChange }) {
  const hasFilters = Boolean(
    value.query || value.action || value.targetType || value.dateFrom || value.dateTo
  );
  const update = (patch) => onChange?.(patch);
  const clearAll = () =>
    update({ query: "", action: "", targetType: "", dateFrom: "", dateTo: "" });

  return jsxs("section", {
    className: "va-filter-surface rounded-2xl va-surface-muted border p-4",
    dir: "rtl",
    children: [
      jsxs("div", {
        className:
          "grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto]",
        children: [
          // Free-text search
          jsxs("label", {
            className: "relative block sm:col-span-2 lg:col-span-1",
            children: [
              jsx(Search, {
                className:
                  "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
              }),
              jsx("input", {
                type: "search",
                value: value.query || "",
                onChange: (event) => update({ query: event.target.value }),
                placeholder: "ابحث باسم العنصر أو المستخدم أو الوصف...",
                className: "input input-bordered w-full"
              })
            ]
          }),
          // Action filter
          jsx("select", {
            value: value.action || "",
            onChange: (event) => update({ action: event.target.value }),
            "aria-label": "تصفية حسب الإجراء",
            className: selectClass,
            children: ACTION_OPTIONS.map((option) =>
              jsx("option", { value: option.value, children: option.label }, option.value || "all")
            )
          }),
          // Target type filter
          jsx("select", {
            value: value.targetType || "",
            onChange: (event) => update({ targetType: event.target.value }),
            "aria-label": "تصفية حسب نوع الهدف",
            className: selectClass,
            children: TARGET_OPTIONS.map((option) =>
              jsx("option", { value: option.value, children: option.label }, option.value || "all")
            )
          }),
          // Date from
          jsx("input", {
            type: "date",
            value: value.dateFrom || "",
            onChange: (event) => update({ dateFrom: event.target.value }),
            "aria-label": "من تاريخ",
            title: "من تاريخ",
            className: dateClass
          }),
          // Date to
          jsx("input", {
            type: "date",
            value: value.dateTo || "",
            onChange: (event) => update({ dateTo: event.target.value }),
            "aria-label": "إلى تاريخ",
            title: "إلى تاريخ",
            className: dateClass
          }),
          // Clear all — shown only when any filter is active
          hasFilters &&
            jsxs("button", {
              type: "button",
              onClick: clearAll,
              className:
                "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-gray-300 hover:bg-white/10",
              children: [jsx(X, { className: "h-3.5 w-3.5" }), "مسح الفلاتر"]
            })
        ]
      })
    ]
  });
}

export default ActivityFilterBar;
