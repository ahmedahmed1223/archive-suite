import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";
import { CalendarRange, CircleDot, ExternalLink, GitBranch, ListFilter } from "lucide-react";

import { PageHero } from "../components/ui/V1Primitives.jsx";
import { EmptyState } from "../components/common/EmptyState.jsx";
import { useAppStore } from "../stores/index.js";
import { formatDateTime, formatNumber } from "../utils/formatting.js";
import {
  TIMELINE_GRANULARITIES,
  TIMELINE_LANE_GROUPS,
  buildTimeline,
  buildTimelineLanes,
  timelineTypeTotals
} from "../features/timeline/timelineSelectors.js";

const GRANULARITY_LABELS = { day: "يوم", week: "أسبوع", month: "شهر", year: "سنة" };
const LANE_GROUP_LABELS = { all: "سلسلة واحدة", type: "حسب النوع", year: "حسب السنة", workflow: "حسب الحالة" };
const TYPE_PALETTE = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#ef4444", "#6b7280"];

function colorForType(index: any) {
  return TYPE_PALETTE[index % TYPE_PALETTE.length] || "#10b981";
}

export function TimelinePage() {
  const { videoItems = [], contentTypes = [], setCurrentPage, setSelectedItemId } = useAppStore();
  const [granularity, setGranularity] = React.useState("month");
  const [groupBy, setGroupBy] = React.useState("type");
  const [activeNode, setActiveNode] = React.useState<any>(null);

  const timeline = React.useMemo(
    () => buildTimeline(videoItems, { granularity }),
    [videoItems, granularity]
  );
  const lanesModel = React.useMemo(
    () => buildTimelineLanes(videoItems, { granularity, groupBy }),
    [videoItems, granularity, groupBy]
  );
  const typeTotals = React.useMemo(() => timelineTypeTotals(timeline), [timeline]);
  const typeColor = React.useMemo(() => {
    const map = new Map();
    Object.keys(typeTotals).forEach((type: any, index: any) => map.set(type, colorForType(index)));
    return map;
  }, [typeTotals]);
  const typeName = React.useCallback(
    (type: any) => contentTypes.find((entry: any) => entry.id === type)?.name || type,
    [contentTypes]
  );

  const activeLane = lanesModel.lanes.find((lane: any) => lane.key === (activeNode as any)?.laneKey) || null;
  const activeBucket = activeLane?.buckets.find((bucket: any) => bucket.key === (activeNode as any)?.bucketKey) || null;
  const openItem = (item: any) => {
    setSelectedItemId?.(item.id);
    setCurrentPage?.("detail");
  };

  React.useEffect(() => {
    if (!activeNode) return;
    const exists = lanesModel.lanes.some((lane: any) => lane.key === (activeNode as any).laneKey && lane.buckets.some((bucket: any) => bucket.key === (activeNode as any).bucketKey));
    if (!exists) setActiveNode(null);
  }, [activeNode, lanesModel]);

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
        description: "سلاسل زمنية لعناصر الأرشيف على شكل عقد متصلة. بدّل الدقة أو أنشئ أكثر من شريط حسب النوع أو السنة أو الحالة."
      }),
      jsxs("section", { className: "grid gap-3 rounded-2xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-3 xl:grid-cols-[minmax(0,1fr)_auto]", children: [
        jsxs("div", { className: "flex flex-wrap gap-3", children: [
          jsxs("div", { className: "min-w-[16rem] flex-1", children: [
            jsxs("p", { className: "mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--va-text-2)]", children: [jsx(ListFilter, { className: "h-4 w-4 va-accent-text" }), "آلية إنشاء الأشرطة" ] }),
            jsx("div", { role: "tablist", "aria-label": "آلية إنشاء الأشرطة الزمنية", className: "flex flex-wrap gap-1 rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-1", children: TIMELINE_LANE_GROUPS.map((value: any) => jsx("button", {
              type: "button",
              role: "tab",
              "aria-selected": groupBy === value,
              onClick: () => { setGroupBy(value); setActiveNode(null); },
              className: `rounded-[var(--va-radius-md)] px-3 py-1.5 text-sm font-semibold transition-colors ${groupBy === value ? "va-accent-bg-soft va-accent-text-on-soft border va-accent-border" : "text-[var(--va-text-2)] hover:text-[var(--va-text)]"}`,
              children: (LANE_GROUP_LABELS as any)[value]
            }, value)) })
          ] }),
          jsxs("div", { className: "min-w-[14rem]", children: [
            jsxs("p", { className: "mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--va-text-2)]", children: [jsx(CalendarRange, { className: "h-4 w-4 va-accent-text" }), "دقة العقد الزمنية" ] }),
            jsx("div", { role: "tablist", "aria-label": "دقة الخط الزمني", className: "flex gap-1 rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-1", children: TIMELINE_GRANULARITIES.map((value: any) => jsx("button", {
              type: "button",
              role: "tab",
              "aria-selected": granularity === value,
              onClick: () => { setGranularity(value); setActiveNode(null); },
              className: `rounded-[var(--va-radius-md)] px-3 py-1.5 text-sm font-semibold transition-colors ${granularity === value ? "va-accent-bg-soft va-accent-text-on-soft border va-accent-border" : "text-[var(--va-text-2)] hover:text-[var(--va-text)]"}`,
              children: (GRANULARITY_LABELS as any)[value]
            }, value)) })
          ] })
        ] }),
        jsxs("div", { className: "grid grid-cols-3 gap-2 text-xs sm:min-w-[22rem]", children: [
          jsxs("div", { className: "rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-3", children: [jsx("p", { className: "text-[var(--va-text-muted)]", children: "العناصر" }), jsx("p", { className: "mt-1 text-lg font-bold text-[var(--va-text)]", children: formatNumber(lanesModel.total) })] }),
          jsxs("div", { className: "rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-3", children: [jsx("p", { className: "text-[var(--va-text-muted)]", children: "الأشرطة" }), jsx("p", { className: "mt-1 text-lg font-bold text-[var(--va-text)]", children: formatNumber(lanesModel.lanes.length) })] }),
          jsxs("div", { className: "rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-3", children: [jsx("p", { className: "text-[var(--va-text-muted)]", children: "الفترات" }), jsx("p", { className: "mt-1 text-lg font-bold text-[var(--va-text)]", children: formatNumber(timeline.buckets.length) })] })
        ] })
      ] }),
      Object.keys(typeTotals).length > 0 ? jsx("section", {
        className: "flex flex-wrap gap-2",
        children: Object.entries(typeTotals).map(([type, count]: any) => jsxs("span", {
          className: "inline-flex items-center gap-1.5 rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface)] px-2.5 py-1 text-xs text-[var(--va-text-2)]",
          children: [
            jsx("span", { className: "inline-block h-2.5 w-2.5 rounded-full", style: { backgroundColor: typeColor.get(type) } }),
            `${typeName(type)} (${formatNumber(count)})`
          ]
        }, type))
      }) : null,
      lanesModel.lanes.length === 0 ? jsx(EmptyState, {
        icon: jsx(CalendarRange, { className: "h-16 w-16" }),
        title: "لا عناصر مؤرّخة بعد",
        description: "أضف عناصر إلى الأرشيف وستظهر هنا موزّعة على محور الزمن."
      }) : jsx("section", { className: "space-y-4", "aria-label": "سلاسل الخط الزمني", children: lanesModel.lanes.map((lane: any, laneIndex: any) => {
        const laneColor = groupBy === "type" ? typeColor.get(lane.key) || colorForType(laneIndex) : colorForType(laneIndex);
        const width = Math.max(720, lane.buckets.length * 132);
        return jsxs("article", {
          className: "rounded-2xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-4",
          children: [
            jsxs("header", { className: "mb-4 flex flex-wrap items-center justify-between gap-3", children: [
              jsxs("div", { className: "flex min-w-0 items-center gap-3", children: [
                jsx("span", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", style: { borderColor: `${laneColor}44`, backgroundColor: `${laneColor}18`, color: laneColor }, children: jsx(GitBranch, { className: "h-5 w-5" }) }),
                jsxs("div", { className: "min-w-0", children: [
                  jsx("h2", { className: "truncate text-base font-bold text-[var(--va-text)]", children: groupBy === "type" ? typeName(lane.label) : lane.label }),
                  jsx("p", { className: "text-xs text-[var(--va-text-muted)]", children: `${formatNumber(lane.total)} عنصر · ${formatNumber(lane.buckets.length)} عقدة` })
                ] })
              ] }),
              jsx("span", { className: "rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-3 py-1 text-xs text-[var(--va-text-2)]", children: lane.range.from && lane.range.to ? `${formatDateTime(lane.range.from)} ← ${formatDateTime(lane.range.to)}` : "بلا نطاق" })
            ] }),
            jsx("div", { className: "overflow-x-auto pb-2", dir: "rtl", children: jsx("div", {
              className: "relative flex items-center gap-0 py-5",
              style: { minWidth: width },
              role: "list",
              "aria-label": `سلسلة ${lane.label}`,
              children: lane.buckets.map((bucket: any, index: any) => {
                const active = (activeNode as any)?.laneKey === lane.key && (activeNode as any)?.bucketKey === bucket.key;
                const size = 42 + Math.round((bucket.count / Math.max(1, lane.maxCount)) * 30);
                const majorType = Object.entries(bucket.byType).sort((a: any, b: any) => b[1] - a[1])[0]?.[0];
                const nodeColor = typeColor.get(majorType) || laneColor;
                return jsxs("div", { className: "flex min-w-[8rem] flex-1 items-center", children: [
                  index > 0 && jsx("span", { className: "h-1 flex-1 rounded-full", style: { background: `linear-gradient(90deg, ${nodeColor}33, ${laneColor}66)` }, "aria-hidden": true }),
                  jsxs("button", {
                    type: "button",
                    role: "listitem",
                    onClick: () => setActiveNode(active ? null : { laneKey: lane.key, bucketKey: bucket.key }),
                    className: `group relative flex shrink-0 flex-col items-center gap-2 rounded-2xl p-2 transition-colors ${active ? "bg-emerald-500/12" : "hover:bg-[var(--va-surface-2)]"}`,
                    title: `${bucket.label} — ${bucket.count}`,
                    children: [
                      jsxs("span", {
                        className: "grid place-items-center rounded-full border text-sm font-bold text-white shadow-lg transition-transform group-hover:scale-105",
                        style: { width: size, height: size, borderColor: `${nodeColor}66`, background: `radial-gradient(circle at 35% 30%, ${nodeColor}, ${laneColor}99)` },
                        children: [
                          jsx(CircleDot, { className: "mb-0.5 h-4 w-4 opacity-90" }),
                          formatNumber(bucket.count)
                        ]
                      }),
                      jsx("span", { className: "max-w-[7rem] truncate text-center text-[11px] font-semibold text-[var(--va-text-2)]", children: bucket.label }),
                      jsx("span", { className: "text-[10px] text-[var(--va-text-muted)]", children: majorType ? typeName(majorType) : "غير محدد" })
                    ]
                  })
                ] }, bucket.key);
              })
            }) })
          ]
        }, lane.key);
      }) }),
      activeBucket ? jsxs("section", {
        className: "rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-4",
        children: [
          jsxs("h2", { className: "mb-3 text-base font-bold text-[var(--va-text)]", children: [activeLane?.label ? `${groupBy === "type" ? typeName(activeLane.label) : activeLane.label} · ` : "", activeBucket.label, " ", jsxs("span", { className: "text-sm font-normal text-[var(--va-text-muted)]", children: [`(${formatNumber(activeBucket.count)})`] })] }),
          jsx("div", { className: "space-y-2", children: activeBucket.items.slice(0, 100).map((item: any) => jsxs("button", {
            type: "button",
            onClick: () => openItem(item),
            className: "flex w-full items-center justify-between gap-2 rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-2.5 text-right transition-colors hover:border-emerald-500/25",
            children: [
              jsxs("div", { className: "min-w-0", children: [
                jsx("p", { className: "truncate text-sm font-semibold text-[var(--va-text)]", dir: "auto", children: item.title || "بدون عنوان" }),
                jsx("p", { className: "text-xs text-[var(--va-text-muted)]", children: item.createdAt ? formatDateTime(item.createdAt) : "" })
              ] }),
              jsx(ExternalLink, { className: "h-4 w-4 shrink-0 text-[var(--va-text-muted)]" })
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
