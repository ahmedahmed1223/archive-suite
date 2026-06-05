import { useAppStore } from "../stores/index.js";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  GitMerge,
  HardDrive,
  Sparkles,
  Upload
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";

import { EmptyState } from "../components/common/EmptyState.jsx";
import { MotionPage, PageHero } from "../components/ui/V1Primitives.jsx";
import { formatDateTime, formatNumber } from "../utils/formatting.js";

// Maps each sync.* audit event to a presentational record used by
// both the device summary cards and the chronological log. New
// event types added in future PRs just need an entry here.
const SYNC_EVENT_PRESENTATION = {
  "sync.export": {
    label: "تصدير حزمة نقل",
    description: "تم إنشاء ملف نقل لهذا الأرشيف",
    icon: Upload,
    tone: "emerald"
  },
  "sync.deltaApply": {
    label: "تطبيق دمج",
    description: "تم دمج تغييرات واردة من جهاز آخر",
    icon: GitMerge,
    tone: "cyan"
  },
  "sync.import": {
    label: "استيراد كامل",
    description: "تم استيراد حزمة بالكامل",
    icon: Download,
    tone: "amber"
  },
  "sync.deltaExport": {
    label: "تصدير delta",
    description: "تم تصدير التغييرات منذ آخر مزامنة",
    icon: Upload,
    tone: "violet"
  }
};

const TONE_CLASSES = {
  emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
  cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-200",
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-200",
  violet: "border-violet-500/25 bg-violet-500/10 text-violet-200"
};

function summarizeDetails(details) {
  if (!details || typeof details !== "object") return null;
  const chips = [];
  if (typeof details.itemCount === "number") chips.push(`${formatNumber(details.itemCount)} عنصر`);
  if (typeof details.newCount === "number" && details.newCount > 0) chips.push(`${formatNumber(details.newCount)} جديد`);
  if (typeof details.updateCount === "number" && details.updateCount > 0) chips.push(`${formatNumber(details.updateCount)} محدّث`);
  if (typeof details.resolvedCount === "number" && details.resolvedCount > 0) chips.push(`${formatNumber(details.resolvedCount)} تعارض محلول`);
  if (details.deviceName) chips.push(details.deviceName);
  return chips;
}

function SyncEventRow({ entry, index }) {
  const presentation = SYNC_EVENT_PRESENTATION[entry.eventType] || {
    label: entry.eventType,
    description: "حدث مزامنة",
    icon: Sparkles,
    tone: "emerald"
  };
  const Icon = presentation.icon;
  const chips = summarizeDetails(entry.details);
  const toneClass = TONE_CLASSES[presentation.tone] || TONE_CLASSES.emerald;

  return jsxs(motion.article, {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, delay: Math.min(index, 12) * 0.02 },
    className: "rounded-2xl border border-white/10 bg-gray-950/30 p-4",
    children: [
      jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [
        jsxs("div", { className: "flex min-w-0 items-start gap-3", children: [
          jsx("span", {
            className: `flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${toneClass}`,
            children: jsx(Icon, { className: "h-5 w-5" })
          }),
          jsxs("div", { className: "min-w-0", children: [
            jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
              jsx("h3", { className: "text-sm font-bold text-white", children: presentation.label }),
              entry.username && jsx("span", { className: "rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-gray-400", children: entry.username })
            ] }),
            jsx("p", { className: "mt-1 text-xs leading-relaxed text-gray-400", children: presentation.description }),
            chips && chips.length > 0 && jsx("div", { className: "mt-2 flex flex-wrap gap-1.5", children: chips.map((chip, chipIndex) => jsx("span", {
              className: "rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-gray-300",
              children: chip
            }, `${entry.id}-chip-${chipIndex}`)) })
          ] })
        ] }),
        jsx("time", {
          className: "shrink-0 text-xs text-gray-500 font-mono",
          dir: "ltr",
          dateTime: entry.timestamp,
          children: formatDateTime(entry.timestamp)
        })
      ] }),
      entry.details?.checksum && jsxs("p", {
        className: "mt-3 truncate text-[11px] text-gray-600 font-mono",
        dir: "ltr",
        title: entry.details.checksum,
        children: ["checksum: ", entry.details.checksum.slice(0, 24), "…"]
      })
    ]
  }, entry.id);
}

function DeviceSummaryCard({ device, eventsByType }) {
  const exportCount = eventsByType["sync.export"] || 0;
  const importCount = (eventsByType["sync.deltaApply"] || 0) + (eventsByType["sync.import"] || 0);
  const totalSync = exportCount + importCount;

  return jsxs("div", {
    className: "rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-transparent p-4",
    children: [
      jsxs("div", { className: "flex items-start justify-between gap-3", children: [
        jsxs("div", { className: "min-w-0", children: [
          jsx("p", { className: "text-xs text-gray-400", children: "هذا الجهاز" }),
          jsx("h2", { className: "mt-1 truncate text-base font-bold text-white", children: device.deviceName || "بدون اسم" }),
          jsx("p", { className: "mt-1 truncate text-[11px] font-mono text-gray-500", dir: "ltr", children: device.deviceId || "—" })
        ] }),
        jsx("span", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-200", children: jsx(HardDrive, { className: "h-5 w-5" }) })
      ] }),
      jsxs("div", { className: "mt-4 grid grid-cols-3 gap-2", children: [
        jsxs("div", { className: "rounded-lg border border-white/10 bg-gray-950/35 p-2 text-center", children: [
          jsx("p", { className: "text-[11px] text-gray-500", children: "إجمالي" }),
          jsx("p", { className: "mt-0.5 text-base font-bold text-white", children: formatNumber(totalSync) })
        ] }),
        jsxs("div", { className: "rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-2 text-center", children: [
          jsx("p", { className: "text-[11px] text-emerald-200", children: "صادرة" }),
          jsx("p", { className: "mt-0.5 text-base font-bold text-emerald-100", children: formatNumber(exportCount) })
        ] }),
        jsxs("div", { className: "rounded-lg border border-cyan-500/15 bg-cyan-500/5 p-2 text-center", children: [
          jsx("p", { className: "text-[11px] text-cyan-200", children: "واردة" }),
          jsx("p", { className: "mt-0.5 text-base font-bold text-cyan-100", children: formatNumber(importCount) })
        ] })
      ] })
    ]
  });
}

export function SyncLogPage() {
  const {
    auditLogs = [],
    settings = {}
  } = useAppStore();

  // Filter and sort. We keep ascending memory by limiting to 200
  // most recent sync events.
  const syncEvents = React.useMemo(() => auditLogs
    .filter((log) => typeof log?.eventType === "string" && log.eventType.startsWith("sync."))
    .slice()
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
    .slice(0, 200),
    [auditLogs]
  );

  const eventsByType = React.useMemo(() => {
    const counts = {};
    for (const entry of syncEvents) counts[entry.eventType] = (counts[entry.eventType] || 0) + 1;
    return counts;
  }, [syncEvents]);

  const device = {
    deviceId: settings.ui?.deviceId || null,
    deviceName: settings.ui?.deviceName || "هذا الجهاز"
  };

  const lastEventAt = syncEvents[0]?.timestamp || null;

  return jsxs(MotionPage, {
    className: "space-y-6 p-4 sm:p-6",
    children: [
      jsx(PageHero, {
        icon: jsx(GitMerge, { className: "h-6 w-6 text-emerald-400" }),
        title: "سجل المزامنة",
        description: "كل عمليات تصدير ودمج حزم النقل بين الأجهزة، مرتبة بالأحدث أولاً.",
        actions: lastEventAt ? jsxs("span", {
          className: "rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200",
          children: ["آخر عملية: ", formatDateTime(lastEventAt)]
        }) : jsx("span", {
          className: "rounded-full border border-white/10 bg-gray-950/35 px-3 py-1.5 text-xs text-gray-400",
          children: "لا توجد عمليات بعد"
        })
      }),
      jsxs("section", { className: "grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]", children: [
        syncEvents.length ? jsx("div", { className: "space-y-3", children: syncEvents.map((entry, index) => jsx(SyncEventRow, { entry, index }, entry.id)) }) : jsx("div", {
          className: "rounded-2xl border border-dashed border-white/10 bg-gray-950/30",
          children: jsx(EmptyState, {
            icon: jsx(GitMerge, { className: "h-10 w-10" }),
            title: "لا توجد عمليات مزامنة بعد",
            description: "عند تصدير ملف نقل أو دمج حزمة من جهاز آخر ستظهر العملية هنا مع تفاصيل الـ checksum والعدد."
          })
        }),
        jsxs("aside", { className: "space-y-3", children: [
          jsx(DeviceSummaryCard, { device, eventsByType }),
          jsxs("div", { className: "rounded-2xl border border-white/10 bg-gray-950/30 p-4 text-xs leading-relaxed text-gray-400", children: [
            jsxs("p", { className: "flex items-center gap-2 font-semibold text-white", children: [
              jsx(CheckCircle2, { className: "h-4 w-4 text-emerald-300" }),
              "كل البيانات محلية"
            ] }),
            jsx("p", { className: "mt-2", children: "السجل يُحفظ في IndexedDB ولا يُرسَل لأي خادم. يُحفظ آخر 1000 سجل، والأقدم يُحذف تلقائياً." })
          ] }),
          eventsByType["sync.deltaApply"] > 0 && jsxs("div", { className: "rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100", children: [
            jsxs("p", { className: "flex items-center gap-2 font-semibold", children: [
              jsx(AlertCircle, { className: "h-4 w-4" }),
              "تنبيه"
            ] }),
            jsx("p", { className: "mt-1.5", children: "إعادة تطبيق دمج سابق غير مدعومة في هذا الإصدار. لتراجع تغييرات مزامنة، استخدم الـ undo من الإشعار في وقت العملية." })
          ] })
        ] })
      ] })
    ]
  });
}

SyncLogPage.pageId = "sync-log";
SyncLogPage.pageTitle = "سجل المزامنة";
SyncLogPage.migrationStatus = "native";

export default SyncLogPage;
