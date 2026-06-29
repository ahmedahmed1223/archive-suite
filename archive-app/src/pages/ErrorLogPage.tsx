import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";
import { AlertOctagon, RefreshCw, RotateCcw, Trash2 } from "lucide-react";

import { appConfirm } from "../components/common/ConfirmDialog.js";
import { PageHero } from "../components/ui/V1Primitives.jsx";
import { EmptyState } from "../components/common/EmptyState.jsx";
import { ErrorDetailsPanel } from "../components/errors/ErrorDetailsPanel.jsx";
import {
  clearErrorLog,
  countBySeverity,
  filterErrors,
  listErrors,
  removeError,
  subscribeErrorLog
} from "../features/errors/errorLogStore.js";
import {
  listRecovery,
  retryAllRecovery,
  retryRecovery,
  removeRecovery,
  subscribeRecovery
} from "../features/errors/recoveryQueue.js";
import { useAppStore } from "../stores/index.js";
import { formatDateTime, formatNumber } from "../utils/formatting.js";

const SEVERITY_FILTERS = [
  { value: "", label: "الكل" },
  { value: "critical", label: "حرج" },
  { value: "error", label: "خطأ" },
  { value: "warning", label: "تحذير" },
  { value: "info", label: "معلومة" }
];

// listErrors returns a cached, frozen snapshot — safe to pass directly as the
// getSnapshot argument to useSyncExternalStore without re-creating it each call.
function useErrorLog() {
  return React.useSyncExternalStore(subscribeErrorLog, listErrors, listErrors);
}

function useRecoveryQueue() {
  return React.useSyncExternalStore(subscribeRecovery, listRecovery, listRecovery);
}

export function ErrorLogPage() {
  const { showToast } = useAppStore();
  const errors = useErrorLog();
  const pending = useRecoveryQueue();
  const [severity, setSeverity] = React.useState("");
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(
    () => filterErrors(errors, { severity, query }),
    [errors, severity, query]
  );
  const severityCounts = React.useMemo(() => countBySeverity(errors), [errors]);

  const onCopy = (ok: any) => showToast?.(ok ? "تم نسخ تقرير الخطأ" : "تعذّر النسخ", ok ? "success" : "error");

  const retryOne = async (id: any) => {
    const result = await retryRecovery(id);
    showToast?.(result.ok ? "تمت إعادة المحاولة بنجاح" : `تعذّرت إعادة المحاولة: ${result.error?.message || ""}`, result.ok ? "success" : "error");
  };
  const retryEverything = async () => {
    const { succeeded, failed } = await retryAllRecovery();
    showToast?.(`أُعيدت المحاولة — نجح ${succeeded}، فشل ${failed}`, failed ? "warning" : "success");
  };

  // Destructive clear needs explicit confirmation so a misclick can't wipe the
  // log of unreviewed criticals.
  const onClearLog = async () => {
    const ok = await appConfirm(
      `سيتم حذف ${formatNumber(errors.length)} تقريراً نهائياً. لا يمكن التراجع عن هذا الإجراء.`,
      { title: "مسح سجل الأخطاء", confirmLabel: "مسح السجل", cancelLabel: "إلغاء", kind: "danger" }
    );
    if (!ok) return;
    clearErrorLog();
    showToast?.("تم مسح سجل الأخطاء", "info");
  };

  return jsxs(motion.div, {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.2 },
    className: "va-page-shell space-y-6 p-4 sm:p-6",
    dir: "rtl",
    children: [
      jsx(PageHero, {
        icon: jsx(AlertOctagon, { className: "h-6 w-6 va-accent-text" }),
        title: "سجل الأخطاء والاسترداد",
        description: "كل الأخطاء بطبقات مبسطة وتقنية، مع طابور للعمليات المعلّقة وإعادة محاولة بضغطة. الأخطاء المتكررة تُجمّع تلقائياً."
      }),
      pending.length > 0 ? jsxs("section", {
        className: "rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4",
        children: [
          jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
            jsxs("div", { className: "flex items-center gap-2 text-amber-100", children: [
              jsx(RotateCcw, { className: "h-5 w-5" }),
              jsxs("span", { className: "text-sm font-semibold", children: [`${pending.length} عملية معلّقة بانتظار إعادة المحاولة`] })
            ] }),
            jsxs("button", {
              type: "button",
              onClick: retryEverything,
              className: "inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-sm font-semibold text-amber-100 hover:bg-amber-400/20",
              children: [jsx(RefreshCw, { className: "h-4 w-4" }), "إعادة محاولة الكل"]
            })
          ] }),
          jsx("ul", { className: "mt-3 space-y-2", children: pending.map((entry: any) => jsxs("li", {
            className: "flex items-center justify-between gap-2 rounded-lg border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-2.5 text-sm",
            children: [
              jsxs("div", { className: "min-w-0", children: [
                jsx("p", { className: "truncate font-medium text-[var(--va-text)]", children: entry.label }),
                jsxs("p", { className: "text-xs text-[var(--va-text-muted)]", children: [`محاولات: ${entry.attempts}`, entry.lastError ? ` · ${entry.lastError}` : ""] })
              ] }),
              jsxs("div", { className: "flex shrink-0 gap-1", children: [
                jsx("button", { type: "button", onClick: () => retryOne(entry.id), className: "inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--va-border-soft)] px-2 text-xs text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)]", children: "إعادة" }),
                jsx("button", { type: "button", onClick: () => removeRecovery(entry.id), "aria-label": "تجاهل", className: "inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-300 hover:bg-red-500/10", children: jsx(Trash2, { className: "h-4 w-4" }) })
              ] })
            ]
          }, entry.id)) })
        ]
      }) : null,
      jsxs("section", { className: "flex flex-wrap items-center gap-2", children: [
        jsx("div", { className: "flex flex-wrap gap-1", role: "group", "aria-label": "تصفية حسب الخطورة", children: SEVERITY_FILTERS.map((option: any) => {
          const count = option.value ? ((severityCounts as any)[option.value] || 0) : errors.length;
          const active = severity === option.value;
          return jsxs("button", {
            type: "button",
            onClick: () => setSeverity(option.value),
            "aria-pressed": active,
            className: `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${active ? "va-accent-bg-soft va-accent-text-on-soft border va-accent-border" : "border border-transparent text-[var(--va-text-muted)] hover:text-[var(--va-text)] hover:bg-[var(--va-surface-2)]"}`,
            children: [
              option.label,
              count > 0 ? jsx("span", { className: `rounded-full px-1.5 text-[11px] ${active ? "va-accent-text-on-soft/70" : "bg-[var(--va-surface-2)] text-[var(--va-text-muted)]"}`, children: formatNumber(count) }) : null
            ]
          }, option.value || "all");
        }) }),
        jsx("input", {
          value: query,
          onChange: (event: any) => setQuery(event.target.value),
          placeholder: "بحث في الأخطاء...",
          "aria-label": "بحث في الأخطاء",
          className: "input input-bordered w-full"
        }),
        errors.length > 0 ? jsxs("button", {
          type: "button",
          onClick: onClearLog,
          className: "inline-flex items-center gap-1.5 rounded-lg border border-[var(--va-border-soft)] px-3 py-2 text-sm text-[var(--va-text-2)] hover:bg-red-500/10 hover:text-red-300",
          children: [jsx(Trash2, { className: "h-4 w-4" }), "مسح السجل"]
        }) : null
      ] }),
      filtered.length === 0 ? jsx("div", {
        className: "va-card rounded-2xl border border-dashed border-[var(--va-border-strong)] bg-[var(--va-surface)]",
        children: jsx(EmptyState, {
          icon: jsx(AlertOctagon, { className: "h-16 w-16" }),
          title: errors.length ? "لا أخطاء مطابقة للفلاتر" : "لا أخطاء مسجّلة",
          description: errors.length ? "جرّب فلتراً أوسع أو امسح البحث." : "ستظهر هنا أي أخطاء عمليات أو مزامنة مع حلول مقترحة وتفاصيل تقنية."
        })
      }) : jsx("div", {
        className: "space-y-3",
        children: filtered.map((report: any) => jsxs("div", {
          className: "space-y-2",
          children: [
            jsx(ErrorDetailsPanel, { report, onCopy }),
            jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[var(--va-text-muted)]", children: [
              jsxs("span", { children: [
                formatDateTime(report.timestamp),
                report.count && report.count > 1
                  ? jsxs("span", { className: "ms-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-amber-100", children: ["تكرر ", formatNumber(report.count), " مرة"] })
                  : null
              ] }),
              jsx("button", { type: "button", onClick: () => removeError(report.id), className: "text-[var(--va-text-muted)] hover:text-rose-400", children: "إزالة" })
            ] })
          ]
        }, report.id))
      })
    ]
  });
}

ErrorLogPage.pageId = "errors";
ErrorLogPage.migrationStatus = "native";

export default ErrorLogPage;
