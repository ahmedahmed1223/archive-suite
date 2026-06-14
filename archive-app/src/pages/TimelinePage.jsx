import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";
import { CalendarRange, ExternalLink } from "lucide-react";

import { PageHero } from "../components/ui/V1Primitives.jsx";
import { EmptyState } from "../components/common/EmptyState.jsx";
import { useAppStore } from "../stores/index.js";
import { formatDateTime, formatNumber } from "../utils/formatting.js";
import {
  TIMELINE_GRANULARITIES,
  buildTimeline,
  timelineTypeTotals
} from "../features/timeline/timelineSelectors.js";

const GRANULARITY_LABELS = { day: "يوم", week: "أسبوع", month: "شهر", year: "سنة" };
const TYPE_PALETTE = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#ef4444", "#6b7280"];

function colorForType(index) {
  return TYPE_PALETTE[index % TYPE_PALETTE.length] || "#10b981";
}

export function TimelinePage() {
  const { videoItems = [], contentTypes = [], setCurrentPage, setSelectedItemId } = useAppStore();
  const [granularity, setGranularity] = React.useState("month");
  const [activeKey, setActiveKey] = React.useState(null);

  const timeline = React.useMemo(
    () => buildTimeline(videoItems, { granularity }),
    [videoItems, granularity]
  );
  const typeTotals = React.useMemo(() => timelineTypeTotals(timeline), [timeline]);
  const typeColor = React.useMemo(() => {
    const map = new Map();
    Object.keys(typeTotals).forEach((type, index) => map.set(type, colorForType(index)));
    return map;
  }, [typeTotals]);
  const typeName = React.useCallback(
    (type) => contentTypes.find((entry) => entry.id === type)?.name || type,
    [contentTypes]
  );

  const activeBucket = timeline.buckets.find((bucket) => bucket.key === activeKey) || null;
  const openItem = (item) => {
    setSelectedItemId?.(item.id);
    setCurrentPage?.("detail");
  };

  return jsxs(motion.div, {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.2 },
    className: "va-page-shell space-y-6 p-4 sm:p-6",
    dir: "rtl",
    children: [
      jsx(PageHero, {
        icon: jsx(CalendarRange, { className: "h-6 w-6 va-accent-text" }),
        title: "الخط الزمني",
        description: "توزيع عناصر الأرشيف عبر الزمن — بدّل الدقة، واطّلع على ما أُضيف في كل فترة."
      }),
      jsxs("section", { className: "flex flex-wrap items-center justify-between gap-3", children: [
        jsx("div", { className: "flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1", children: TIMELINE_GRANULARITIES.map((value) => jsx("button", {
          type: "button",
          onClick: () => { setGranularity(value); setActiveKey(null); },
          className: `rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${granularity === value ? "va-accent-bg-soft va-accent-text-on-soft border va-accent-border" : "text-gray-400 hover:text-white"}`,
          children: GRANULARITY_LABELS[value]
        }, value)) }),
        jsxs("span", { className: "text-sm text-gray-500", children: [`${formatNumber(timeline.total)} عنصر · ${formatNumber(timeline.buckets.length)} فترة`] })
      ] }),
      Object.keys(typeTotals).length > 0 ? jsx("section", {
        className: "flex flex-wrap gap-2",
        children: Object.entries(typeTotals).map(([type, count]) => jsxs("span", {
          className: "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-300",
          children: [
            jsx("span", { className: "inline-block h-2.5 w-2.5 rounded-full", style: { backgroundColor: typeColor.get(type) } }),
            `${typeName(type)} (${formatNumber(count)})`
          ]
        }, type))
      }) : null,
      timeline.buckets.length === 0 ? jsx("div", {
        className: "va-card rounded-2xl border border-dashed border-white/10 bg-gray-900/35",
        children: jsx(EmptyState, {
          icon: jsx(CalendarRange, { className: "h-16 w-16" }),
          title: "لا عناصر مؤرّخة بعد",
          description: "أضف عناصر إلى الأرشيف وستظهر هنا موزّعة على محور الزمن."
        })
      }) : jsx("section", {
        className: "rounded-2xl border border-white/10 bg-gray-900/40 p-4",
        children: jsx("div", {
          className: "flex items-end gap-1.5 overflow-x-auto pb-2",
          style: { minHeight: "12rem" },
          role: "list",
          "aria-label": "توزيع العناصر عبر الزمن",
          children: timeline.buckets.map((bucket) => {
            const heightPct = timeline.maxCount ? Math.max(6, Math.round((bucket.count / timeline.maxCount) * 100)) : 0;
            const isActive = bucket.key === activeKey;
            const segments = Object.entries(bucket.byType);
            return jsxs("button", {
              type: "button",
              role: "listitem",
              onClick: () => setActiveKey(isActive ? null : bucket.key),
              title: `${bucket.label} — ${bucket.count}`,
              className: `group flex min-w-[2.25rem] shrink-0 flex-col items-center gap-1 rounded-lg p-1 transition-colors ${isActive ? "bg-white/10" : "hover:bg-white/5"}`,
              children: [
                jsx("span", { className: "text-[10px] font-semibold text-gray-400", children: formatNumber(bucket.count) }),
                jsx("span", {
                  className: "flex w-7 flex-col-reverse overflow-hidden rounded-md",
                  style: { height: `${heightPct}%`, minHeight: "0.5rem" },
                  children: segments.map(([type, count]) => jsx("span", {
                    style: { backgroundColor: typeColor.get(type) || "#10b981", flexGrow: count, display: "block" }
                  }, type))
                }),
                jsx("span", { className: "max-w-[3.5rem] truncate text-[9px] text-gray-600", children: bucket.label })
              ]
            }, bucket.key);
          })
        })
      }),
      activeBucket ? jsxs("section", {
        className: "rounded-2xl border border-white/10 va-surface-muted p-4",
        children: [
          jsxs("h2", { className: "mb-3 text-base font-bold text-white", children: [activeBucket.label, " ", jsxs("span", { className: "text-sm font-normal text-gray-500", children: [`(${formatNumber(activeBucket.count)})`] })] }),
          jsx("div", { className: "space-y-2", children: activeBucket.items.slice(0, 100).map((item) => jsxs("button", {
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
          }, item.id)) })
        ]
      }) : null
    ]
  });
}

TimelinePage.pageId = "timeline";
TimelinePage.migrationStatus = "native";

export default TimelinePage;
