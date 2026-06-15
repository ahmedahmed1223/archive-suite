import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";
import { BarChart3, ExternalLink, Hash, Layers, Copy, HeartPulse } from "lucide-react";

import { PageHero } from "../components/ui/V1Primitives.jsx";
import { EmptyState } from "../components/common/EmptyState.jsx";
import { useAppStore } from "../stores/index.js";
import { formatDateTime, formatNumber } from "../utils/formatting.js";
import { buildArchiveAnalytics } from "../features/analytics/analyticsSelectors.js";

function StatCard({ icon, label, value, hint }) {
  return jsxs("div", {
    className: "rounded-2xl border border-white/10 bg-gray-900/40 p-4",
    children: [
      jsxs("div", { className: "flex items-center gap-2 text-gray-400", children: [icon, jsx("span", { className: "text-xs font-semibold", children: label })] }),
      jsx("p", { className: "mt-2 text-2xl font-bold text-white", children: value }),
      hint ? jsx("p", { className: "mt-1 text-xs text-gray-500", children: hint }) : null
    ]
  });
}

function GrowthChart({ growth }) {
  return jsx("section", {
    className: "rounded-2xl border border-white/10 bg-gray-900/40 p-4",
    children: jsx("div", {
      className: "flex items-end gap-1.5 overflow-x-auto pb-2",
      style: { minHeight: "10rem" },
      role: "list",
      "aria-label": "النمو الشهري للأرشيف",
      children: growth.series.map((bucket) => {
        const heightPct = growth.maxCount ? Math.max(4, Math.round((bucket.count / growth.maxCount) * 100)) : 0;
        return jsxs("div", {
          role: "listitem",
          title: `${bucket.label} — ${bucket.count}`,
          className: "flex min-w-[2.25rem] shrink-0 flex-col items-center gap-1",
          children: [
            jsx("span", { className: "text-[10px] font-semibold text-gray-400", children: formatNumber(bucket.count) }),
            jsx("span", {
              className: "flex w-7 flex-col-reverse overflow-hidden rounded-md",
              style: { height: `${heightPct}%`, minHeight: "0.5rem" },
              children: jsx("span", { className: "va-accent-bg block", style: { flexGrow: 1 } })
            }),
            jsx("span", { className: "max-w-[3.5rem] truncate text-[9px] text-gray-600", children: bucket.label })
          ]
        }, bucket.key);
      })
    })
  });
}

function ListPanel({ title, icon, children }) {
  return jsxs("section", {
    className: "rounded-2xl border border-white/10 va-surface-muted p-4",
    children: [
      jsxs("h2", { className: "mb-3 flex items-center gap-2 text-base font-bold text-white", children: [icon, title] }),
      children
    ]
  });
}

export function AnalyticsPage() {
  const {
    videoItems = [],
    folders = [],
    virtualCollections = [],
    contentTypes = [],
    setCurrentPage,
    setSelectedItemId
  } = useAppStore();

  const analytics = React.useMemo(
    () => buildArchiveAnalytics(videoItems, folders, virtualCollections),
    [videoItems, folders, virtualCollections]
  );

  const typeName = React.useCallback(
    (type) => contentTypes.find((entry) => entry.id === type)?.name || type,
    [contentTypes]
  );

  const openItem = (item) => {
    setSelectedItemId?.(item.id);
    setCurrentPage?.("detail");
  };

  const { growth, tags, uncategorized, duplicates, types, health } = analytics;
  const isEmpty = health.total === 0;

  return jsxs(motion.div, {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.2 },
    className: "va-page-shell space-y-6 p-4 sm:p-6",
    dir: "rtl",
    children: [
      jsx(PageHero, {
        icon: jsx(BarChart3, { className: "h-6 w-6 va-accent-text" }),
        title: "تحليلات الأرشيف",
        description: "لوحة شخصية تكشف نمو الأرشيف وصحته وأنماط استخدامه — النمو الشهري، أكثر الوسوم، العناصر غير المصنفة، والمكررات المحتملة."
      }),
      isEmpty ? jsx("div", {
        className: "va-card rounded-2xl border border-dashed border-white/10 bg-gray-900/35",
        children: jsx(EmptyState, {
          icon: jsx(BarChart3, { className: "h-16 w-16" }),
          title: "لا بيانات للتحليل بعد",
          description: "أضف عناصر إلى الأرشيف وستظهر هنا رؤى عن نموه وصحته وأنماط استخدامه."
        })
      }) : jsxs(React.Fragment, {
        children: [
          jsxs("section", {
            className: "grid grid-cols-2 gap-3 sm:grid-cols-4",
            children: [
              jsx(StatCard, { icon: jsx(Layers, { className: "h-4 w-4" }), label: "إجمالي العناصر", value: formatNumber(health.total) }),
              jsx(StatCard, { icon: jsx(HeartPulse, { className: "h-4 w-4" }), label: "موسومة", value: `${formatNumber(health.taggedPct)}٪`, hint: `${formatNumber(health.tagged)} عنصر` }),
              jsx(StatCard, { icon: jsx(Layers, { className: "h-4 w-4" }), label: "ضمن مجموعة", value: `${formatNumber(health.inCollectionPct)}٪`, hint: `${formatNumber(health.inCollection)} عنصر` }),
              jsx(StatCard, { icon: jsx(Hash, { className: "h-4 w-4" }), label: "غير مصنفة", value: formatNumber(health.uncategorized), hint: `${formatNumber(health.uncategorizedPct)}٪ من الأرشيف` })
            ]
          }),
          jsxs("div", {
            className: "space-y-2",
            children: [
              jsxs("h2", { className: "flex items-center gap-2 text-base font-bold text-white", children: [jsx(BarChart3, { className: "h-4 w-4 va-accent-text" }), `النمو الشهري (${formatNumber(growth.total)})`] }),
              jsx(GrowthChart, { growth })
            ]
          }),
          types.length > 0 ? jsx("section", {
            className: "flex flex-wrap gap-2",
            children: types.map(({ type, count }) => jsxs("span", {
              className: "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-300",
              children: [`${typeName(type)} (${formatNumber(count)})`]
            }, type))
          }) : null,
          jsxs("div", {
            className: "grid gap-4 lg:grid-cols-2",
            children: [
              jsx(ListPanel, {
                title: `أكثر الوسوم (${formatNumber(tags.length)})`,
                icon: jsx(Hash, { className: "h-4 w-4 va-accent-text" }),
                children: tags.length === 0 ? jsx("p", { className: "text-sm text-gray-500", children: "لا وسوم بعد." }) : jsx("ul", {
                  className: "space-y-1.5",
                  children: tags.map(({ tag, count }) => jsxs("li", {
                    className: "flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-gray-950/30 px-3 py-1.5 text-sm",
                    children: [
                      jsx("span", { className: "truncate text-gray-200", dir: "auto", children: tag }),
                      jsx("span", { className: "shrink-0 text-xs font-semibold text-gray-400", children: formatNumber(count) })
                    ]
                  }, tag))
                })
              }),
              jsx(ListPanel, {
                title: `عناصر غير مصنفة (${formatNumber(uncategorized.count)})`,
                icon: jsx(Layers, { className: "h-4 w-4 va-accent-text" }),
                children: uncategorized.count === 0 ? jsx("p", { className: "text-sm text-gray-500", children: "كل العناصر مصنفة 🎉" }) : jsx("div", {
                  className: "space-y-2",
                  children: uncategorized.items.slice(0, 50).map((item) => jsxs("button", {
                    type: "button",
                    onClick: () => openItem(item),
                    className: "flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-gray-950/30 p-2.5 text-right hover:border-white/20",
                    children: [
                      jsxs("div", { className: "min-w-0", children: [
                        jsx("p", { className: "truncate text-sm font-semibold text-white", dir: "auto", children: item.title || "بدون عنوان" }),
                        jsx("p", { className: "text-xs text-gray-600", children: item.createdAt ? formatDateTime(item.createdAt) : "" })
                      ] }),
                      jsx(ExternalLink, { className: "h-4 w-4 shrink-0 text-gray-500" })
                    ]
                  }, item.id))
                })
              })
            ]
          }),
          jsx(ListPanel, {
            title: `مجموعات مكررة محتملة (${formatNumber(duplicates.length)})`,
            icon: jsx(Copy, { className: "h-4 w-4 va-accent-text" }),
            children: duplicates.length === 0 ? jsx("p", { className: "text-sm text-gray-500", children: "لا مكررات واضحة بحسب العنوان." }) : jsx("div", {
              className: "space-y-3",
              children: duplicates.slice(0, 20).map((group) => jsxs("div", {
                className: "rounded-xl border border-white/10 bg-gray-950/30 p-3",
                children: [
                  jsxs("p", { className: "mb-2 text-xs font-semibold text-amber-400", children: [`${formatNumber(group.items.length)} عناصر متشابهة`] }),
                  jsx("div", { className: "space-y-1.5", children: group.items.map((item) => jsxs("button", {
                    type: "button",
                    onClick: () => openItem(item),
                    className: "flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-gray-900/40 px-2.5 py-1.5 text-right hover:border-white/20",
                    children: [
                      jsx("span", { className: "truncate text-sm text-gray-200", dir: "auto", children: item.title || "بدون عنوان" }),
                      jsx(ExternalLink, { className: "h-4 w-4 shrink-0 text-gray-500" })
                    ]
                  }, item.id)) })
                ]
              }, group.key))
            })
          })
        ]
      })
    ]
  });
}

AnalyticsPage.pageId = "analytics";
AnalyticsPage.migrationStatus = "native";

export default AnalyticsPage;
