import { AlertTriangle, Archive, Bell, CheckCircle2, ExternalLink, Info, Search, Trash2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import * as React from "react";
import { createPortal } from "react-dom";
import { jsx, jsxs } from "react/jsx-runtime";

import { useAppStore } from "../../stores/index.js";
import { useFocusTrap } from "./useFocusTrap.js";
import { appConfirm } from "./ConfirmDialog.js";
import {
  filterNotifications,
  getNotificationCounts,
  groupNotificationsByDay
} from "../../features/notifications/viewModel.js";

const FILTER_TABS = [
  { id: "all", label: "الكل" },
  { id: "unread", label: "غير مقروء" },
  { id: "mention", label: "إشارات" },
  { id: "comment", label: "تعليقات" },
  { id: "task", label: "مهام" },
  { id: "share", label: "مشاركة" },
  { id: "export", label: "تصدير" },
  { id: "error", label: "أخطاء" },
  { id: "archived", label: "مؤرشف" }
];

const READ_FILTERS = [
  { id: "all", label: "كل الحالات" },
  { id: "unread", label: "غير مقروء" },
  { id: "read", label: "مقروء" }
];

const TYPE_ICON = {
  success: { Icon: CheckCircle2, tone: "va-accent-text" },
  error: { Icon: AlertTriangle, tone: "text-red-300" },
  warning: { Icon: AlertTriangle, tone: "text-amber-300" },
  info: { Icon: Info, tone: "text-sky-300" }
};

function formatRelativeTime(timestamp) {
  if (!timestamp) return "";
  const date = typeof timestamp === "string" ? new Date(timestamp) : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const diffSeconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (diffSeconds < 45) return "الآن";
  if (diffSeconds < 90) return "قبل دقيقة";
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `قبل ${diffMinutes} دقيقة`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `قبل ${diffHours} ساعة`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `قبل ${diffDays} يوم`;
  return date.toLocaleDateString("ar");
}

function getActionLabel(item) {
  if (item.action?.label) return item.action.label;
  if (item.targetType === "item" || item.itemId || item.targetItemId) return "فتح المادة";
  if (item.targetType === "project" || item.projectId || item.targetProjectId) return "فتح المشروع";
  if (item.page) return "فتح الصفحة";
  return "";
}

export function NotificationDrawer() {
  const open = useAppStore((state) => state.notificationCenterOpen);
  const toggle = useAppStore((state) => state.toggleNotificationCenter);
  const history = useAppStore((state) => state.notificationHistory || []);
  const clearHistory = useAppStore((state) => state.clearNotificationHistory);
  const markAllRead = useAppStore((state) => state.markAllNotificationsRead);
  const markRead = useAppStore((state) => state.markNotificationsRead);
  const archiveNotification = useAppStore((state) => state.archiveNotification);
  const setCurrentPage = useAppStore((state) => state.setCurrentPage);
  const setSelectedItemId = useAppStore((state) => state.setSelectedItemId);
  const showToast = useAppStore((state) => state.showToast);
  const prefersReducedMotion = useReducedMotion();
  const [filter, setFilter] = React.useState("all");
  const [readState, setReadState] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const closeButtonRef = React.useRef(null);
  const panelRef = React.useRef(null);
  useFocusTrap(panelRef, open, { initialFocusRef: closeButtonRef });

  React.useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") toggle?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, toggle]);

  React.useEffect(() => {
    if (open) {
      window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    }
  }, [open]);

  const groups = React.useMemo(() => groupNotificationsByDay(history, { filter, readState, query }), [filter, history, query, readState]);
  const filtered = React.useMemo(() => filterNotifications(history, { filter, readState, query }), [filter, history, query, readState]);
  const counts = React.useMemo(() => getNotificationCounts(history), [history]);

  const runNotificationAction = (item) => {
    const itemId = item.itemId || item.targetItemId || (item.targetType === "item" ? item.targetId : null);
    const projectId = item.projectId || item.targetProjectId || (item.targetType === "project" ? item.targetId : null);
    try {
      if (typeof item.action?.run === "function") {
        item.action.run();
      } else if (itemId) {
        setSelectedItemId?.(itemId);
        setCurrentPage?.("detail");
      } else if (projectId) {
        setCurrentPage?.("projects");
      } else if (item.page) {
        setSelectedItemId?.(null);
        setCurrentPage?.(item.page);
      } else {
        showToast?.("لا يوجد إجراء مباشر لهذا الإشعار", "info");
        return;
      }
      markRead?.([item.id]);
      if (item.action?.dismissOnRun !== false) toggle?.();
    } catch (error) {
      showToast?.(error?.message || "تعذر تنفيذ إجراء الإشعار", "error");
    }
  };

  const clearWithConfirm = async () => {
    const confirmed = await appConfirm("سيتم مسح سجل الإشعارات غير المؤرشف من هذه الجلسة. هل تريد المتابعة؟", {
      title: "مسح سجل الإشعارات",
      kind: "warning",
      confirmLabel: "مسح السجل"
    });
    if (confirmed) clearHistory?.();
  };

  const copyTechnicalDetails = async (item) => {
    try {
      if (!navigator?.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(item.technicalDetails || "");
      showToast?.("تم نسخ التفاصيل التقنية", "success");
    } catch (error) {
      showToast?.("تعذر نسخ التفاصيل التقنية", "error");
    }
  };

  if (typeof document === "undefined") return null;

  const slideDuration = prefersReducedMotion ? 0 : 0.25;

  return createPortal(
    jsx(AnimatePresence, {
      children: open && jsxs(motion.div, {
        key: "notification-drawer",
        className: "fixed inset-0 z-[9995] flex",
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: prefersReducedMotion ? 0 : 0.18 },
        dir: "rtl",
        children: [
          jsx(motion.button, {
            type: "button",
            "aria-label": "إغلاق مركز الإشعارات",
            onClick: () => toggle?.(),
            className: "absolute inset-0 cursor-default bg-black/45 backdrop-blur-sm",
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0 }
          }),
          jsxs(motion.aside, {
            ref: panelRef,
            role: "dialog",
            "aria-modal": "true",
            "aria-label": "مركز الإشعارات",
            className: "relative ms-auto flex h-full w-full max-w-[440px] flex-col border-s border-[var(--va-border-soft)] bg-[var(--va-surface)] text-[var(--va-text)] shadow-[var(--va-elev-popover)]",
            initial: { x: prefersReducedMotion ? 0 : -32, opacity: 0 },
            animate: { x: 0, opacity: 1 },
            exit: { x: prefersReducedMotion ? 0 : -32, opacity: 0 },
            transition: { duration: slideDuration, ease: "easeOut" },
            children: [
              jsxs("header", {
                className: "flex items-center justify-between gap-3 border-b border-[var(--va-border-soft)] px-4 py-3",
                children: [
                  jsxs("div", {
                    className: "flex min-w-0 items-center gap-2",
                    children: [
                      jsx(Bell, { className: "h-5 w-5 text-emerald-500" }),
                      jsxs("div", {
                        className: "min-w-0",
                        children: [
                          jsx("h2", { className: "truncate text-sm font-bold", children: "مركز الإشعارات" }),
                          jsx("p", { className: "text-xs text-[var(--va-text-muted)]", children: counts.unread ? `${counts.unread} غير مقروء من ${counts.all}` : `${counts.all} إشعار نشط` })
                        ]
                      })
                    ]
                  }),
                  jsx("button", {
                    ref: closeButtonRef,
                    type: "button",
                    onClick: () => toggle?.(),
                    "aria-label": "إغلاق",
                    className: "rounded-[var(--va-radius-md)] p-2 text-[var(--va-text-muted)] transition-colors hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)]",
                    children: jsx(X, { className: "h-4 w-4" })
                  })
                ]
              }),
              jsxs("div", { className: "space-y-2 border-b border-[var(--va-border-soft)] px-3 py-3", children: [
                jsxs("label", { className: "relative block", children: [
                  jsx(Search, { className: "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--va-text-muted)]" }),
                  jsx("input", {
                    value: query,
                    onChange: (event) => setQuery(event.target.value),
                    className: "min-h-10 w-full rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface-2)] py-2 pe-3 ps-10 text-sm text-[var(--va-text)] outline-none placeholder:text-[var(--va-text-muted)] focus:border-emerald-500/60",
                    placeholder: "بحث في العنوان أو التفاصيل أو الهدف",
                    "aria-label": "بحث في الإشعارات"
                  })
                ] }),
                jsx("div", {
                  role: "tablist",
                  "aria-label": "تصفية حسب النوع",
                  className: "flex gap-1 overflow-x-auto",
                  children: FILTER_TABS.map((tab) => {
                    const active = filter === tab.id;
                    const tabCount = counts[tab.id] ?? 0;
                    return jsxs("button", {
                      type: "button",
                      role: "tab",
                      "aria-selected": active,
                      onClick: () => setFilter(tab.id),
                      className: `shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${active
                        ? "bg-emerald-500/15 text-emerald-500"
                        : "text-[var(--va-text-muted)] hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)]"}`,
                      children: [tab.label, " · ", tabCount]
                    }, tab.id);
                  })
                }),
                jsx("div", { className: "grid grid-cols-3 gap-1 rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-1", children: READ_FILTERS.map((item) => jsx("button", {
                  type: "button",
                  onClick: () => setReadState(item.id),
                  className: `rounded-[var(--va-radius-sm)] px-2 py-1.5 text-xs font-semibold transition-colors ${readState === item.id ? "bg-[var(--va-elevated)] text-[var(--va-text)] shadow-[var(--va-elev-1)]" : "text-[var(--va-text-muted)] hover:text-[var(--va-text)]"}`,
                  children: item.label
                }, item.id)) })
              ] }),
              jsx("div", {
                className: "flex-1 overflow-y-auto px-3 py-2",
                children: filtered.length === 0
                  ? jsxs("div", {
                    className: "flex h-full flex-col items-center justify-center px-4 py-12 text-center",
                    children: [
                      jsx(Bell, { className: "h-10 w-10 text-[var(--va-text-muted)]" }),
                      jsx("p", { className: "mt-4 text-sm font-semibold text-[var(--va-text-2)]", children: history.length === 0 ? "لا توجد إشعارات بعد" : "لا توجد نتائج مطابقة" }),
                      jsx("p", { className: "mt-1 text-xs text-[var(--va-text-muted)]", children: history.length === 0 ? "ستظهر هنا إشعارات العمل والتنبيهات التشغيلية." : "غيّر البحث أو الفلاتر الحالية." })
                    ]
                  })
                  : jsx("div", {
                    className: "space-y-4",
                    children: groups.map((group) => jsxs("section", {
                      children: [
                        jsx("h3", { className: "px-1 pb-2 text-xs font-bold text-[var(--va-text-muted)]", children: group.label }),
                        jsx("ul", { className: "space-y-2", children: group.items.map((item) => {
                          const meta = TYPE_ICON[item.type] || TYPE_ICON.info;
                          const Icon = meta.Icon;
                          const actionLabel = getActionLabel(item);
                          return jsxs("li", {
                            className: `rounded-[var(--va-radius-lg)] border p-3 ${item.readAt ? "border-[var(--va-border-soft)] bg-[var(--va-surface-2)]" : "border-emerald-500/30 bg-emerald-500/[0.08]"}`,
                            children: [
                              jsxs("div", {
                                className: "flex items-start gap-3",
                                children: [
                                  jsx(Icon, { className: `mt-0.5 h-4 w-4 shrink-0 ${meta.tone}` }),
                                  jsxs("div", {
                                    className: "min-w-0 flex-1",
                                    children: [
                                      jsxs("div", { className: "flex items-start justify-between gap-2", children: [
                                        jsx("p", { className: "text-sm font-semibold text-[var(--va-text)]", children: item.title || "إشعار" }),
                                        !item.readAt && jsx("span", { className: "mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500", "aria-label": "غير مقروء" })
                                      ] }),
                                      jsx("p", { className: "mt-1 whitespace-pre-wrap text-xs leading-6 text-[var(--va-text-2)]", dir: "auto", children: item.message }),
                                      typeof item.progress === "number" && jsxs("div", {
                                        className: "mt-2",
                                        children: [
                                          jsx("div", {
                                            className: "h-1.5 w-full overflow-hidden rounded-full bg-[var(--va-surface-2)]",
                                            role: "progressbar",
                                            "aria-valuenow": Math.round(item.progress),
                                            "aria-valuemin": 0,
                                            "aria-valuemax": 100,
                                            "aria-label": "تقدّم العملية",
                                            children: jsx("div", {
                                              className: "h-full rounded-full bg-emerald-500 transition-[width] duration-300",
                                              style: { width: `${Math.min(100, Math.max(0, item.progress))}%` }
                                            })
                                          }),
                                          jsxs("p", { className: "mt-1 text-[10px] font-semibold text-[var(--va-text-muted)]", children: [Math.round(item.progress), "%"] })
                                        ]
                                      })
                                    ]
                                  })
                                ]
                              }),
                              jsxs("p", { className: "mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[var(--va-text-muted)]", children: [
                                jsx("span", { children: formatRelativeTime(item.createdAt) }),
                                item.targetLabel && jsx("span", { className: "max-w-[12rem] truncate rounded-full bg-[var(--va-surface-2)] px-2 py-0.5", title: item.targetLabel, children: item.targetLabel })
                              ] }),
                              jsxs("div", { className: "mt-3 flex flex-wrap gap-2", children: [
                                actionLabel && jsxs("button", { type: "button", onClick: () => runNotificationAction(item), className: "inline-flex items-center gap-1.5 rounded-[var(--va-radius-md)] border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-500 transition-colors hover:bg-emerald-500/18", children: [jsx(ExternalLink, { className: "h-3.5 w-3.5" }), actionLabel] }),
                                !item.readAt && jsx("button", { type: "button", onClick: () => markRead?.([item.id]), className: "inline-flex items-center gap-1.5 rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] px-2.5 py-1.5 text-xs text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-surface-2)]", children: [jsx(CheckCircle2, { className: "h-3.5 w-3.5" }), "مقروء"] }),
                                item.technicalDetails && jsx("button", { type: "button", onClick: () => copyTechnicalDetails(item), className: "inline-flex items-center gap-1.5 rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] px-2.5 py-1.5 text-xs text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-surface-2)]", children: "نسخ التفاصيل" }),
                                !item.archivedAt && jsx("button", { type: "button", onClick: () => archiveNotification?.(item.id), className: "inline-flex items-center gap-1.5 rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] px-2.5 py-1.5 text-xs text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-surface-2)]", children: [jsx(Archive, { className: "h-3.5 w-3.5" }), "أرشفة"] })
                              ] })
                            ]
                          }, item.id);
                        }) })
                      ]
                    }, group.id))
                  })
              }),
              history.length > 0 && jsx("footer", {
                className: "grid gap-2 border-t border-[var(--va-border-soft)] px-4 py-3 sm:grid-cols-2",
                children: [
                  jsxs("button", {
                    type: "button",
                    onClick: () => markAllRead?.(),
                    disabled: counts.unread === 0,
                    className: "inline-flex w-full items-center justify-center gap-2 rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] px-3 py-2 text-xs font-semibold text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-surface-2)] disabled:opacity-45",
                    children: [jsx(CheckCircle2, { className: "h-3.5 w-3.5" }), "تحديد الكل كمقروء"]
                  }),
                  jsxs("button", {
                    type: "button",
                    onClick: clearWithConfirm,
                    className: "inline-flex w-full items-center justify-center gap-2 rounded-[var(--va-radius-md)] border border-[color-mix(in_oklab,var(--va-status-danger)_22%,transparent)] bg-[color-mix(in_oklab,var(--va-status-danger)_8%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--va-status-danger)] transition-colors hover:bg-[color-mix(in_oklab,var(--va-status-danger)_14%,transparent)]",
                    children: [jsx(Trash2, { className: "h-3.5 w-3.5" }), "مسح السجل"]
                  })
                ]
              })
            ]
          })
        ]
      })
    }),
    document.body
  );
}

NotificationDrawer.displayName = "NotificationDrawer";
export default NotificationDrawer;
