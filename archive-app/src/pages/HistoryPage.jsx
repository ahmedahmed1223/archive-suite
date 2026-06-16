import {
  parseAppRoute,
  writeAppRoute
} from "../services/router/index.js";
import {
  useAppStore
} from "../stores/index.js";
import {
  CirclePlus,
  Clock,
  FileText,
  History,
  PenLine,
  RefreshCw,
  Search,
  Trash2
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";

import { appConfirm } from "../components/common/ConfirmDialog.js";
import { EmptyState } from "../components/common/EmptyState.jsx";
import { Pagination } from "../components/common/Pagination.jsx";
import { MotionPage, PageHero, SkeletonBlock } from "../components/ui/V1Primitives.jsx";
import {
  HISTORY_ACTIONS,
  createHistoryRouteParams,
  formatHistoryValue,
  getFilteredHistoryRecords,
  getHistoryActionCounts,
  getHistoryActionLabel,
  getHistoryActionTone,
  getHistoryRecordTimestamp,
  parseHistoryRouteParams
} from "../features/history/viewModel.js";
import { formatDateTime, formatNumber } from "../utils/formatting.js";


const ACTION_ICON = {
  create: CirclePlus,
  update: PenLine,
  delete: Trash2,
  restore: RefreshCw
};

function toneClasses(tone) {
  if (tone === "emerald") return "va-accent-border va-accent-bg-soft va-accent-text-on-soft";
  if (tone === "blue") return "border-blue-500/20 bg-blue-500/10 text-blue-200";
  if (tone === "red") return "border-red-500/20 bg-red-500/10 text-red-200";
  if (tone === "amber") return "border-amber-500/20 bg-amber-500/10 text-amber-200";
  return "border-white/10 bg-white/5 text-gray-300";
}

function HistoryMetric({ action, label, value, active, onClick }) {
  const Icon = ACTION_ICON[action] || History;
  return jsxs("button", {
    type: "button",
    onClick,
    "aria-pressed": active,
    "aria-label": `${label}: ${value}`,
    className: `card va-action-card flex min-h-[92px] flex-row items-center gap-3 rounded-2xl border p-4 text-right transition-colors ${active ? toneClasses(getHistoryActionTone(action)) : "border-white/10 bg-gray-900/45 text-gray-300 hover:bg-white/5"}`,
    children: [
      jsx("span", {
        className: `flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${toneClasses(getHistoryActionTone(action))}`,
        "aria-hidden": "true",
        children: jsx(Icon, { className: "h-5 w-5" })
      }),
      jsxs("span", {
        className: "min-w-0",
        children: [
          jsx("span", { className: "block text-xl font-bold text-white", children: formatNumber(value) }),
          jsx("span", { className: "block text-xs text-gray-500", children: label })
        ]
      })
    ]
  });
}


function HistoryRecord({ record, itemTitle, index, settings }) {
  const tone = getHistoryActionTone(record.action);
  const Icon = ACTION_ICON[record.action] || History;
  return jsxs(motion.article, {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, delay: Math.min(index, 10) * 0.025 },
    className: "va-entity-card rounded-2xl va-surface-muted border p-4 text-right transition-colors hover:border-emerald-500/25",
    dir: "rtl",
    children: [
      jsxs("div", {
        className: "flex flex-wrap items-start justify-between gap-3",
        children: [
          jsxs("div", {
            className: "flex min-w-0 items-start gap-3",
            children: [
              jsx("span", {
                className: `mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${toneClasses(tone)}`,
                children: jsx(Icon, { className: "h-4 w-4" })
              }),
              jsxs("div", {
                className: "min-w-0",
                children: [
                  jsxs("div", {
                    className: "flex flex-wrap items-center gap-2",
                    children: [
                      jsx("span", { className: `badge badge-sm border ${toneClasses(tone)}`, children: getHistoryActionLabel(record.action) }),
                      jsx("h3", { className: "truncate text-sm font-semibold text-white", children: itemTitle || record.itemId || "عنصر غير معروف" })
                    ]
                  }),
                  record.field && jsx("p", { className: "mt-1 text-xs text-gray-500", children: `الحقل: ${record.field}` })
                ]
              })
            ]
          }),
          jsx("span", {
            className: "text-xs text-gray-600",
            children: getHistoryRecordTimestamp(record) ? formatDateTime(getHistoryRecordTimestamp(record), settings.numberSystem) : "بدون تاريخ"
          })
        ]
      }),
      record.action === "update" && record.field && jsxs("div", {
        className: "mt-3 grid gap-1.5 rounded-xl va-surface-muted border p-3 text-xs md:grid-cols-2",
        children: [
          jsxs("div", { className: "min-w-0 rounded-lg border border-red-500/15 bg-red-500/8 p-2", children: [
            jsx("p", { className: "mb-1.5 font-semibold text-red-300", children: "القيمة السابقة" }),
            jsx("p", { className: "truncate font-mono text-gray-400", dir: "ltr", children: formatHistoryValue(record.oldValue) })
          ] }),
          jsxs("div", { className: "min-w-0 rounded-lg border va-accent-border va-accent-bg-soft p-2", children: [
            jsx("p", { className: "mb-1.5 font-semibold va-accent-text", children: "القيمة الجديدة" }),
            jsx("p", { className: "truncate font-mono text-gray-400", dir: "ltr", children: formatHistoryValue(record.newValue) })
          ] })
        ]
      })
    ]
  }, record.id || `${record.action}-${record.itemId}-${record.timestamp}`);
}

export function HistoryPage() {
  const {
    changeHistory = [],
    videoItems = [],
    settings = {},
    isLoading = false,
    clearHistory,
    showToast
  } = useAppStore();

  const initialRouteState = React.useMemo(() => parseHistoryRouteParams(parseAppRoute().params), []);
  const [query, setQuery] = React.useState(initialRouteState.query);
  const [action, setAction] = React.useState(initialRouteState.action);
  const [page, setPage] = React.useState(initialRouteState.page);
  const [pageSize, setPageSize] = React.useState(initialRouteState.pageSize);
  const skipPageReset = React.useRef(true);

  const itemTitleById = React.useMemo(() => new Map(videoItems.map((item) => [item.id, item.title || item.id])), [videoItems]);
  const counts = React.useMemo(() => getHistoryActionCounts(changeHistory), [changeHistory]);
  const filteredRecords = React.useMemo(() => getFilteredHistoryRecords({
    changeHistory,
    query,
    action,
    itemTitleById
  }), [action, changeHistory, itemTitleById, query]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  React.useEffect(() => {
    const applyRouteState = () => {
      const next = parseHistoryRouteParams(parseAppRoute().params);
      setQuery(next.query);
      setAction(next.action);
      setPage(next.page);
      setPageSize(next.pageSize);
    };
    window.addEventListener("hashchange", applyRouteState);
    window.addEventListener("popstate", applyRouteState);
    return () => {
      window.removeEventListener("hashchange", applyRouteState);
      window.removeEventListener("popstate", applyRouteState);
    };
  }, []);

  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      writeAppRoute("history", {
        params: createHistoryRouteParams({ query, action, page: currentPage, pageSize })
      }, settings, true);
    }, 120);
    return () => window.clearTimeout(handle);
  }, [action, currentPage, pageSize, query, settings]);

  React.useEffect(() => {
    if (skipPageReset.current) {
      skipPageReset.current = false;
      return;
    }
    setPage(1);
  }, [action, pageSize, query]);

  React.useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [currentPage, page]);

  const handleClearHistory = async () => {
    const confirmed = await appConfirm("هل تريد مسح سجل التغييرات بالكامل؟ لا يمكن التراجع عن هذه العملية.", {
      title: "مسح سجل التغييرات",
      kind: "danger",
      confirmLabel: "مسح السجل"
    });
    if (!confirmed) return;
    try {
      if (typeof clearHistory === "function") await clearHistory();
      else showToast?.("تعذر العثور على إجراء مسح السجل", "error");
    } catch (error) {
      showToast?.("تعذر مسح سجل التغييرات", "error");
    }
  };

  return jsxs(MotionPage, {
    className: "space-y-6 p-4 sm:p-6",
    children: [
      jsx(PageHero, {
        icon: jsx(History, { className: "h-6 w-6 va-accent-text" }),
        title: "سجل التغييرات",
        description: "مراجعة عمليات الإنشاء والتحديث والحذف والاستعادة مع بحث مباشر وروابط تحفظ حالة الفلترة.",
        actions: changeHistory.length > 0 ? jsxs("button", {
          type: "button",
          onClick: handleClearHistory,
          className: "btn btn-sm min-h-10 rounded-xl border-red-500/20 bg-red-500/10 text-red-200 hover:bg-red-500/15 hover:border-red-500/30",
          children: [jsx(Trash2, { className: "h-4 w-4" }), "مسح السجل"]
        }) : null
      }),
      jsxs("section", {
        className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-5",
        children: [
          jsx(HistoryMetric, { action: "all", label: "كل النشاط", value: counts.all || 0, active: action === "all", onClick: () => setAction("all") }, "all"),
          ...HISTORY_ACTIONS.map((item) => jsx(HistoryMetric, {
            action: item.id,
            label: item.label,
            value: counts[item.id] || 0,
            active: action === item.id,
            onClick: () => setAction(item.id)
          }, item.id))
        ]
      }),
      jsxs("section", {
        className: "va-filter-surface rounded-2xl va-surface-muted border p-4",
        children: [
          jsxs("div", {
            className: "grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]",
            children: [
              jsxs("label", {
                className: "relative block",
                children: [
                  jsx(Search, { className: "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" }),
                  jsx("input", {
                    value: query,
                    onChange: (event) => setQuery(event.target.value),
                    placeholder: "ابحث باسم العنصر أو الحقل أو القيمة...",
                    className: "input input-bordered min-h-11 w-full va-surface-deep rounded-xl py-2 pl-3 pr-10 text-sm text-white placeholder:text-gray-600 focus:border-emerald-500/40"
                  })
                ]
              }),
              jsxs("select", {
                value: action,
                onChange: (event) => setAction(event.target.value),
                className: "select select-bordered min-h-11 va-surface-deep rounded-xl px-3 text-sm text-white",
                children: [
                  jsx("option", { value: "all", children: "كل الإجراءات" }),
                  ...HISTORY_ACTIONS.map((item) => jsx("option", { value: item.id, children: item.label }, item.id))
                ]
              }),
              jsx("select", {
                value: pageSize,
                onChange: (event) => setPageSize(Number(event.target.value)),
                className: "select select-bordered min-h-11 va-surface-deep rounded-xl px-3 text-sm text-white",
                children: [20, 50, 100].map((size) => jsx("option", { value: size, children: `${size} سجل` }, size))
              })
            ]
          }),
          jsx("p", { className: "mt-3 text-xs text-gray-500", children: `${formatNumber(filteredRecords.length, settings.numberSystem)} نتيجة من ${formatNumber(changeHistory.length, settings.numberSystem)} سجل` })
        ]
      }),
      isLoading && visibleRecords.length === 0 && changeHistory.length === 0 ? jsx("section", {
        className: "va-card rounded-2xl border border-white/10 va-surface-muted p-4 space-y-2",
        role: "status",
        "aria-live": "polite",
        "aria-label": "جارٍ تحميل سجل التغييرات",
        children: Array.from({ length: 6 }).map((_, index) => jsx(SkeletonBlock, {
          className: "h-14 w-full"
        }, index))
      }) :
      visibleRecords.length ? jsx("section", {
        className: "space-y-3",
        children: visibleRecords.map((record, index) => jsx(HistoryRecord, {
          record,
          itemTitle: itemTitleById.get(record.itemId),
          index,
          settings
        }, record.id || `${record.itemId}-${record.timestamp}-${index}`))
      }) : jsx("section", {
        className: "va-card rounded-2xl border border-dashed border-white/10 bg-gray-900/35",
        children: jsx(EmptyState, {
          icon: jsx(FileText, { className: "h-16 w-16" }),
          title: changeHistory.length ? "لا توجد نتائج مطابقة" : "لا توجد تغييرات مسجلة",
          description: changeHistory.length
            ? "خفف البحث أو اختر كل الإجراءات لعرض السجل."
            : "ستظهر هنا عمليات الإنشاء والتعديل والحذف بعد استخدام الأرشيف."
        })
      }),
      jsx(Pagination, { page: currentPage, totalPages, onPageChange: setPage, totalItems: filteredRecords.length }),
      jsxs("p", { className: "flex items-center gap-2 text-xs text-gray-600", children: [jsx(Clock, { className: "h-3.5 w-3.5" }), "السجل يعرض بيانات محلية محفوظة داخل هذا الجهاز."] })
    ]
  });
}

HistoryPage.pageId = "history";
HistoryPage.migrationStatus = "native";

export default HistoryPage;
