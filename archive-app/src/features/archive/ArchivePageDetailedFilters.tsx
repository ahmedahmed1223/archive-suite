import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import { formatNumber } from "../../utils/formatting.js";
import { STATE_META, WORKFLOW_STATES } from "./itemStatus.js";

/**
 * The detailed-mode filter panel that slides in below the hero when
 * the user picks "تفصيلي". Rendering it from a dedicated component
 * keeps ArchivePage.jsx under 300 lines without changing any of the
 * underlying handlers.
 */
export function ArchivePageDetailedFilters({
  filterType,
  filterSubtype,
  filterStatus = "all",
  subtypes,
  contentTypes,
  videoItems,
  typeCounts,
  sortField,
  sortDirection,
  setFilterType,
  setFilterSubtype,
  setFilterStatus,
  setSortField,
  setSortDirection
}: any) {
  return jsxs("section", {
    className: "va-filter-surface z-20 rounded-2xl va-surface-muted border p-3 text-right backdrop-blur-sm xl:sticky xl:top-3",
    children: [
      jsxs("div", {
        className: "grid gap-2 xl:grid-cols-[minmax(220px,1fr)_200px_170px_170px_180px]",
        children: [
          jsx("div", { className: "hidden xl:block" }),
          jsxs("select", {
            value: filterType,
            "aria-label": "تصفية حسب النوع",
            onChange: (event: any) => {
              setFilterType?.(event.target.value);
              setFilterSubtype?.("all");
            },
            className: "min-h-10 va-surface-deep rounded-xl border px-3 py-2 text-sm text-white",
            children: [
              jsx("option", { value: "all", children: "كل الأنواع" }),
              ...contentTypes.map((type: any) => jsx("option", { value: type.id, children: type.name || type.id }, type.id))
            ]
          }),
          jsxs("select", {
            value: filterSubtype,
            onChange: (event: any) => setFilterSubtype?.(event.target.value),
            disabled: !subtypes.length,
            "aria-label": "تصفية حسب الفرع",
            className: "min-h-10 va-surface-deep rounded-xl border px-3 py-2 text-sm text-white disabled:opacity-50",
            children: [
              jsx("option", { value: "all", children: "كل الفروع" }),
              ...subtypes.map((subtype: any) => jsx("option", { value: subtype.id, children: subtype.name || subtype.id }, subtype.id))
            ]
          }),
          jsxs("select", {
            value: filterStatus,
            "aria-label": "تصفية حسب الحالة",
            onChange: (event: any) => setFilterStatus?.(event.target.value),
            className: "min-h-10 va-surface-deep rounded-xl border px-3 py-2 text-sm text-white",
            children: [
              jsx("option", { value: "all", children: "كل الحالات" }),
              ...WORKFLOW_STATES.map((state: any) => jsx("option", { value: state, children: (STATE_META as any)[state]?.label || state }, state))
            ]
          }),
          jsxs("select", {
            value: `${sortField}:${sortDirection}`,
            "aria-label": "ترتيب النتائج",
            onChange: (event: any) => {
              const [field, direction] = event.target.value.split(":");
              setSortField(field);
              setSortDirection(direction);
            },
            className: "min-h-10 va-surface-deep rounded-xl border px-3 py-2 text-sm text-white",
            children: [
              jsx("option", { value: "updatedAt:desc", children: "الأحدث تحديثاً" }),
              jsx("option", { value: "createdAt:desc", children: "الأحدث إضافة" }),
              jsx("option", { value: "title:asc", children: "العنوان أ-ي" }),
              jsx("option", { value: "title:desc", children: "العنوان ي-أ" })
            ]
          })
        ]
      }),
      jsxs("div", {
        className: "mt-2 flex gap-2 overflow-x-auto pb-1",
        "aria-label": "فلاتر الأنواع السريعة",
        children: [
          jsxs("button", {
            type: "button",
            onClick: () => {
              setFilterType?.("all");
              setFilterSubtype?.("all");
            },
            className: `inline-flex min-h-9 shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${filterType === "all" ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "border-white/10 bg-gray-950/35 text-gray-400 hover:bg-white/5 hover:text-white"}`,
            children: [
              "كل المواد",
              jsx("span", { className: "rounded-full bg-white/10 px-2 py-0.5 text-xs", children: formatNumber(videoItems.filter((item: any) => !item.isDeleted).length) }, "count")
            ]
          }, "all"),
          ...contentTypes.filter((type: any) => type.status !== "archived").map((type: any) => jsxs("button", {
            type: "button",
            onClick: () => {
              setFilterType?.(type.id);
              setFilterSubtype?.("all");
            },
            className: `inline-flex min-h-9 shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${filterType === type.id ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "border-white/10 bg-gray-950/35 text-gray-400 hover:bg-white/5 hover:text-white"}`,
            style: filterType === type.id && type.color ? { boxShadow: `inset 0 0 0 1px ${type.color}44` } : undefined,
            children: [
              jsx("span", { className: "text-base", children: type.icon || "📁" }),
              jsx("span", { children: type.name || type.id }),
              jsx("span", { className: "rounded-full bg-white/10 px-2 py-0.5 text-xs", children: formatNumber(typeCounts.get(type.id) || 0) })
            ]
          }, type.id))
        ]
      }),
      jsx("p", { className: "mt-2 text-xs leading-5 text-gray-500", children: "الفلاتر التفصيلية تظهر هنا عند الحاجة. الوضع السريع يحافظ على مساحة أكبر للمواد." })
    ]
  });
}

export default ArchivePageDetailedFilters;
