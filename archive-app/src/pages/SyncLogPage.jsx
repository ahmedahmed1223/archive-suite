import { useAppStore } from "../stores/index.js";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudOff,
  Download,
  GitMerge,
  HardDrive,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";

import { EmptyState } from "../components/common/EmptyState.jsx";
import { MotionPage, PageHero } from "../components/ui/V1Primitives.jsx";
import { formatDateTime, formatNumber } from "../utils/formatting.js";
import {
  getSyncSnapshot,
  subscribeSync,
  startConnectionWatch,
  removeSyncOp,
  updateSyncOpStatus,
  resolveConflictInStore
} from "../features/sync/syncStatusStore.js";

// Presentational metadata for each connection state.
const CONNECTION_PRESENTATION = {
  online: { label: "متصل", icon: Cloud, className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" },
  offline: { label: "غير متصل", icon: CloudOff, className: "border-[var(--va-border-strong)] bg-[var(--va-surface-2)] text-[var(--va-text-2)]" },
  syncing: { label: "جارٍ المزامنة", icon: Loader2, className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200" }
};

const OP_STATUS_PRESENTATION = {
  pending: { label: "معلّقة", className: "border-amber-500/30 bg-amber-500/10 text-amber-200" },
  inFlight: { label: "قيد التنفيذ", className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200" },
  failed: { label: "فاشلة", className: "border-rose-500/30 bg-rose-500/10 text-rose-200" },
  done: { label: "مكتملة", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" }
};

const OP_ACTION_LABEL = { create: "إنشاء", update: "تعديل", delete: "حذف" };

const CONFLICT_TYPE_LABEL = {
  "both-modified": "تعديل من الجهازين",
  "version-clash": "تعارض إصدارات",
  "delete-vs-edit": "حذف مقابل تعديل",
  "edit-vs-delete": "تعديل مقابل حذف"
};

// Subscribe to the sync status store and re-render on every change.
function useSyncStatus() {
  const [snapshot, setSnapshot] = React.useState(() => getSyncSnapshot());
  React.useEffect(() => {
    const detach = startConnectionWatch();
    setSnapshot(getSyncSnapshot());
    const unsubscribe = subscribeSync(setSnapshot);
    return () => {
      unsubscribe();
      detach?.();
    };
  }, []);
  return snapshot;
}

function ConnectionBadge({ state }) {
  const presentation = CONNECTION_PRESENTATION[state] || CONNECTION_PRESENTATION.online;
  const Icon = presentation.icon;
  return jsxs("span", {
    className: `inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${presentation.className}`,
    children: [
      jsx(Icon, { className: state === "syncing" ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5" }),
      presentation.label
    ]
  });
}

function SyncOpRow({ op }) {
  const status = OP_STATUS_PRESENTATION[op.status] || OP_STATUS_PRESENTATION.pending;
  return jsxs("div", {
    className: "flex flex-wrap items-center justify-between gap-2 rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-3",
    children: [
      jsxs("div", { className: "min-w-0", children: [
        jsxs("p", { className: "truncate text-sm font-semibold text-[var(--va-text)]", children: [
          OP_ACTION_LABEL[op.action] || op.action, " · ", op.entity
        ] }),
        jsxs("p", { className: "mt-0.5 truncate text-[11px] font-[family-name:var(--va-font-mono)] text-[var(--va-text-muted)]", dir: "ltr", children: [
          op.entityId || "—", op.attempts > 0 ? ` · محاولات: ${op.attempts}` : ""
        ] }),
        op.error && jsx("p", { className: "mt-1 truncate text-[11px] text-rose-300", children: op.error })
      ] }),
      jsxs("div", { className: "flex shrink-0 items-center gap-2", children: [
        jsx("span", { className: `rounded-full border px-2 py-0.5 text-[11px] ${status.className}`, children: status.label }),
        op.status === "failed" && jsx("button", {
          type: "button",
          onClick: () => updateSyncOpStatus(op.id, "pending"),
          "aria-label": "إعادة المحاولة",
          className: "inline-flex h-7 w-7 items-center justify-center rounded-[var(--va-radius-sm)] text-cyan-300 hover:bg-cyan-500/10",
          children: jsx(RefreshCw, { className: "h-3.5 w-3.5" })
        }),
        jsx("button", {
          type: "button",
          onClick: () => removeSyncOp(op.id),
          "aria-label": "إزالة العملية",
          className: "inline-flex h-7 w-7 items-center justify-center rounded-[var(--va-radius-sm)] text-rose-300 hover:bg-rose-500/10",
          children: jsx(Trash2, { className: "h-3.5 w-3.5" })
        })
      ] })
    ]
  });
}

function ConflictRow({ conflict, onResolve }) {
  const title = conflict.local?.title || conflict.remote?.title || conflict.id;
  const typeLabel = CONFLICT_TYPE_LABEL[conflict.type] || conflict.type;
  const fields = Array.isArray(conflict.fields) ? conflict.fields : [];
  return jsxs("div", {
    className: "space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3",
    children: [
      jsxs("div", { className: "flex flex-wrap items-start justify-between gap-2", children: [
        jsxs("div", { className: "min-w-0", children: [
          jsx("p", { className: "truncate text-sm font-bold text-[var(--va-text)]", dir: "auto", children: title }),
          jsxs("p", { className: "mt-0.5 text-[11px] text-amber-200/80", children: [
            typeLabel,
            fields.length > 0 ? ` · ${formatNumber(fields.length)} حقل متعارض` : ""
          ] })
        ] }),
        jsx("span", { className: "shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200", children: "بانتظار الحل" })
      ] }),
      jsxs("div", { className: "flex flex-wrap gap-2", children: [
        jsx("button", {
          type: "button",
          onClick: () => onResolve(conflict.id, "keepLocal"),
          className: "rounded-lg border va-accent-border va-accent-bg-soft px-3 py-1.5 text-xs font-medium va-accent-text-on-soft hover:bg-emerald-500/15",
          children: "احتفظ بالمحلي"
        }),
        jsx("button", {
          type: "button",
          onClick: () => onResolve(conflict.id, "keepRemote"),
          className: "rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-500/15",
          children: "احتفظ بالوارد"
        }),
        jsx("button", {
          type: "button",
          onClick: () => onResolve(conflict.id, "newest"),
          className: "rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-500/15",
          children: "الأحدث يفوز"
        })
      ] })
    ]
  });
}

/**
 * Live sync status surface: connection state, visible operation queue,
 * and detected conflicts with per-conflict resolve actions. Driven by
 * the in-memory syncStatusStore; empty until the live sync loop (or a
 * remote snapshot comparison) populates it.
 */
function SyncStatusPanel() {
  const { connectionState, ops, conflicts, summary } = useSyncStatus();

  const handleResolve = (id, strategy) => {
    // Pure resolution → chosen record. Applying the record to the live
    // store is deferred to the sync-loop integration; here we clear the
    // visible conflict so the queue reflects the user's decision.
    resolveConflictInStore(id, strategy);
  };

  return jsxs("section", {
    className: "space-y-4 rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-4 shadow-[var(--va-elev-1)]",
    children: [
      jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
        jsxs("h2", { className: "flex items-center gap-2 text-base font-bold text-[var(--va-text)]", children: [
          jsx(Cloud, { className: "h-5 w-5 va-accent-text" }),
          "حالة المزامنة الحيّة"
        ] }),
        jsx(ConnectionBadge, { state: connectionState })
      ] }),
      jsxs("div", { className: "grid grid-cols-2 gap-2 sm:grid-cols-4", children: [
        jsxs("div", { className: "rounded-[var(--va-radius-sm)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-2 text-center", children: [
          jsx("p", { className: "text-[11px] text-amber-200", children: "معلّقة" }),
          jsx("p", { className: "mt-0.5 text-base font-bold text-[var(--va-text)] font-[family-name:var(--va-font-mono)]", children: formatNumber(summary.pending) })
        ] }),
        jsxs("div", { className: "rounded-[var(--va-radius-sm)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-2 text-center", children: [
          jsx("p", { className: "text-[11px] text-cyan-200", children: "قيد التنفيذ" }),
          jsx("p", { className: "mt-0.5 text-base font-bold text-[var(--va-text)] font-[family-name:var(--va-font-mono)]", children: formatNumber(summary.inFlight) })
        ] }),
        jsxs("div", { className: "rounded-[var(--va-radius-sm)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-2 text-center", children: [
          jsx("p", { className: "text-[11px] text-rose-200", children: "فاشلة" }),
          jsx("p", { className: "mt-0.5 text-base font-bold text-[var(--va-text)] font-[family-name:var(--va-font-mono)]", children: formatNumber(summary.failed) })
        ] }),
        jsxs("div", { className: "rounded-[var(--va-radius-sm)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-2 text-center", children: [
          jsx("p", { className: "text-[11px] text-emerald-200", children: "مكتملة" }),
          jsx("p", { className: "mt-0.5 text-base font-bold text-[var(--va-text)] font-[family-name:var(--va-font-mono)]", children: formatNumber(summary.done) })
        ] })
      ] }),
      jsxs("div", { className: "space-y-2", children: [
        jsx("h3", { className: "text-sm font-semibold text-[var(--va-text-2)]", children: "طابور العمليات" }),
        ops.length > 0
          ? jsx("div", { className: "space-y-2", children: ops.map((op) => jsx(SyncOpRow, { op }, op.id)) })
          : jsx("p", { className: "rounded-[var(--va-radius-md)] border border-dashed border-[var(--va-border-strong)] bg-[var(--va-surface-2)] p-3 text-center text-xs text-[var(--va-text-muted)]", children: "لا عمليات مزامنة معلّقة حالياً." })
      ] }),
      jsxs("div", { className: "space-y-2", children: [
        jsxs("h3", { className: "flex items-center gap-2 text-sm font-semibold text-[var(--va-text-2)]", children: [
          jsx(AlertTriangle, { className: "h-4 w-4 text-amber-300" }),
          "التعارضات المكتشفة"
        ] }),
        conflicts.length > 0
          ? jsx("div", { className: "space-y-2", children: conflicts.map((conflict) => jsx(ConflictRow, { conflict, onResolve: handleResolve }, conflict.id)) })
          : jsx("p", { className: "rounded-[var(--va-radius-md)] border border-dashed border-[var(--va-border-strong)] bg-[var(--va-surface-2)] p-3 text-center text-xs text-[var(--va-text-muted)]", children: "لا تعارضات بانتظار الحل." })
      ] })
    ]
  });
}

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
  emerald: "va-accent-border va-accent-bg-soft va-accent-text-on-soft",
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
    className: "rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-4 shadow-[var(--va-elev-1)]",
    children: [
      jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [
        jsxs("div", { className: "flex min-w-0 items-start gap-3", children: [
          jsx("span", {
            className: `flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--va-radius-md)] border ${toneClass}`,
            children: jsx(Icon, { className: "h-5 w-5" })
          }),
          jsxs("div", { className: "min-w-0", children: [
            jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
              jsx("h3", { className: "text-sm font-bold text-[var(--va-text)]", children: presentation.label }),
              entry.username && jsx("span", { className: "rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-2 py-0.5 text-xs text-[var(--va-text-muted)]", children: entry.username })
            ] }),
            jsx("p", { className: "mt-1 text-xs leading-relaxed text-[var(--va-text-muted)]", children: presentation.description }),
            chips && chips.length > 0 && jsx("div", { className: "mt-2 flex flex-wrap gap-1.5", children: chips.map((chip, chipIndex) => jsx("span", {
              className: "rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-2 py-0.5 text-[11px] text-[var(--va-text-2)]",
              children: chip
            }, `${entry.id}-chip-${chipIndex}`)) })
          ] })
        ] }),
        jsx("time", {
          className: "shrink-0 text-xs text-[var(--va-text-muted)] font-[family-name:var(--va-font-mono)]",
          dir: "ltr",
          dateTime: entry.timestamp,
          children: formatDateTime(entry.timestamp)
        })
      ] }),
      entry.details?.checksum && jsxs("p", {
        className: "mt-3 truncate text-[11px] text-[var(--va-text-muted)] font-[family-name:var(--va-font-mono)]",
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
    className: "rounded-[var(--va-radius-lg)] border va-accent-border bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-transparent p-4",
    children: [
      jsxs("div", { className: "flex items-start justify-between gap-3", children: [
        jsxs("div", { className: "min-w-0", children: [
          jsx("p", { className: "text-xs text-[var(--va-text-muted)]", children: "هذا الجهاز" }),
          jsx("h2", { className: "mt-1 truncate text-base font-bold text-[var(--va-text)]", children: device.deviceName || "بدون اسم" }),
          jsx("p", { className: "mt-1 truncate text-[11px] font-[family-name:var(--va-font-mono)] text-[var(--va-text-muted)]", dir: "ltr", children: device.deviceId || "—" })
        ] }),
        jsx("span", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--va-radius-md)] border va-accent-border va-accent-bg-soft va-accent-text-on-soft", children: jsx(HardDrive, { className: "h-5 w-5" }) })
      ] }),
      jsxs("div", { className: "mt-4 grid grid-cols-3 gap-2", children: [
        jsxs("div", { className: "rounded-[var(--va-radius-sm)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-2 text-center", children: [
          jsx("p", { className: "text-[11px] text-[var(--va-text-muted)]", children: "إجمالي" }),
          jsx("p", { className: "mt-0.5 text-base font-bold text-[var(--va-text)] font-[family-name:var(--va-font-mono)]", children: formatNumber(totalSync) })
        ] }),
        jsxs("div", { className: "rounded-[var(--va-radius-sm)] border va-accent-border va-accent-bg-soft p-2 text-center", children: [
          jsx("p", { className: "text-[11px] va-accent-text-on-soft", children: "صادرة" }),
          jsx("p", { className: "mt-0.5 text-base font-bold va-accent-text-on-soft font-[family-name:var(--va-font-mono)]", children: formatNumber(exportCount) })
        ] }),
        jsxs("div", { className: "rounded-[var(--va-radius-sm)] border border-cyan-500/15 bg-cyan-500/5 p-2 text-center", children: [
          jsx("p", { className: "text-[11px] text-cyan-200", children: "واردة" }),
          jsx("p", { className: "mt-0.5 text-base font-bold text-cyan-100 font-[family-name:var(--va-font-mono)]", children: formatNumber(importCount) })
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
        icon: jsx(GitMerge, { className: "h-6 w-6 va-accent-text" }),
        title: "سجل المزامنة",
        description: "كل عمليات تصدير ودمج حزم النقل بين الأجهزة، مرتبة بالأحدث أولاً.",
        actions: lastEventAt ? jsxs("span", {
          className: "rounded-full border va-accent-border va-accent-bg-soft px-3 py-1.5 text-xs va-accent-text-on-soft",
          children: ["آخر عملية: ", formatDateTime(lastEventAt)]
        }) : jsx("span", {
          className: "rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-3 py-1.5 text-xs text-[var(--va-text-muted)]",
          children: "لا توجد عمليات بعد"
        })
      }),
      jsx(SyncStatusPanel, {}),
      jsxs("section", { className: "grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]", children: [
        syncEvents.length ? jsx("div", { className: "space-y-3", children: syncEvents.map((entry, index) => jsx(SyncEventRow, { entry, index }, entry.id)) }) : jsx("div", {
          className: "rounded-[var(--va-radius-lg)] border border-dashed border-[var(--va-border-strong)] bg-[var(--va-surface)]",
          children: jsx(EmptyState, {
            icon: jsx(GitMerge, { className: "h-10 w-10" }),
            title: "لا توجد عمليات مزامنة بعد",
            description: "عند تصدير ملف نقل أو دمج حزمة من جهاز آخر ستظهر العملية هنا مع تفاصيل الـ checksum والعدد."
          })
        }),
        jsxs("aside", { className: "space-y-3", children: [
          jsx(DeviceSummaryCard, { device, eventsByType }),
          jsxs("div", { className: "rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-4 text-xs leading-relaxed text-[var(--va-text-muted)]", children: [
            jsxs("p", { className: "flex items-center gap-2 font-semibold text-[var(--va-text)]", children: [
              jsx(CheckCircle2, { className: "h-4 w-4 va-accent-text" }),
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
