import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { Activity, Clock, FileText } from "lucide-react";

import { useAppStore } from "../stores/index.js";
import { EmptyState } from "../components/common/EmptyState.jsx";
import { Pagination } from "../components/common/Pagination.jsx";
import { MotionPage, PageHero, SkeletonBlock } from "../components/ui/V1Primitives.jsx";
import { ActivityFilterBar } from "../components/activity/ActivityFilterBar.jsx";
import { ActivityTimeline } from "../components/activity/ActivityTimeline.jsx";
import { filterActivityEntries } from "../features/activityLog/viewModel.js";
import { formatNumber } from "../utils/formatting.js";

const PAGE_SIZE = 50;

/**
 * سجل النشاط (§18.1) — central activity timeline grouped by day with
 * before/after diffs and per-entry undo/redo. Complements HistoryPage
 * (سجل التغييرات), which lists field-level change_history records for
 * items only; this page covers all target types with snapshots + undo.
 */
export function ActivityPage() {
  const {
    activityLog = [],
    activityLoading = false,
    settings = {},
    loadActivityFromStorage,
    undoActivityEntryById,
    redoActivityEntryById,
    showToast
  } = useAppStore();

  const [filters, setFilters] = React.useState({
    query: "",
    action: "",
    targetType: "",
    dateFrom: "",
    dateTo: ""
  });
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    loadActivityFromStorage?.();
  }, [loadActivityFromStorage]);

  const filteredEntries = React.useMemo(() => filterActivityEntries(activityLog, {
    action: filters.action || null,
    targetType: filters.targetType || null,
    query: filters.query || null,
    dateFrom: filters.dateFrom || null,
    dateTo: filters.dateTo || null
  } as any), [activityLog, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleEntries = filteredEntries.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleFiltersChange = (patch: any) => {
    setFilters((current: any) => ({ ...current, ...patch }));
    setPage(1);
  };

  const handleUndo = async (entry: any) => {
    const result = await undoActivityEntryById?.(entry.id);
    if (result) showToast?.("تم التراجع عن النشاط", "success");
    else showToast?.("تعذر التراجع عن هذا النشاط", "error");
  };

  const handleRedo = async (entry: any) => {
    const result = await redoActivityEntryById?.(entry.id);
    if (result) showToast?.("تمت إعادة النشاط", "success");
    else showToast?.("تعذر إعادة هذا النشاط", "error");
  };

  return jsxs(MotionPage, {
    className: "space-y-6 p-4 sm:p-6",
    children: [
      jsx(PageHero, {
        icon: jsx(Activity, { className: "h-6 w-6 va-accent-text" }),
        title: "سجل النشاط",
        description: "خط زمني مجمّع حسب اليوم لكل عمليات الأرشيف مع فروقات قبل/بعد وإمكانية التراجع والإعادة."
      }),
      jsx(ActivityFilterBar, { value: filters, onChange: handleFiltersChange }),
      jsx("p", {
        className: "text-xs text-[var(--va-text-muted)]",
        dir: "rtl",
        children: `${formatNumber(filteredEntries.length, settings.numberSystem)} نشاط من ${formatNumber(activityLog.length, settings.numberSystem)} مسجل`
      }),
      activityLoading && activityLog.length === 0 ? jsx("section", {
        className: "va-card rounded-2xl border border-[var(--va-border-soft)] va-surface-muted p-4 space-y-2",
        role: "status",
        "aria-live": "polite",
        "aria-label": "جارٍ تحميل سجل النشاط",
        children: Array.from({ length: 6 }).map((_: any, index: any) => jsx(SkeletonBlock, { className: "h-14 w-full" }, index))
      }) : visibleEntries.length ? jsx(ActivityTimeline, {
        entries: visibleEntries,
        settings,
        onUndo: handleUndo,
        onRedo: handleRedo
      }) : jsx("section", {
        className: "va-card rounded-2xl border border-dashed border-[var(--va-border-strong)] bg-[var(--va-surface)]",
        children: jsx(EmptyState, {
          icon: jsx(FileText, { className: "h-16 w-16" }),
          title: activityLog.length ? "لا توجد نتائج مطابقة" : "لا يوجد نشاط مسجل",
          description: activityLog.length
            ? "خفف البحث أو امسح الفلاتر لعرض السجل."
            : "ستظهر هنا عمليات الإنشاء والتعديل والحذف مع لقطات قبل/بعد فور استخدام الأرشيف."
        })
      }),
      jsx(Pagination, { page: currentPage, totalPages, onPageChange: setPage, totalItems: filteredEntries.length }),
      jsxs("p", {
        className: "flex items-center gap-2 text-xs text-[var(--va-text-muted)]",
        dir: "rtl",
        children: [jsx(Clock, { className: "h-3.5 w-3.5" }), "التراجع متاح حالياً لعمليات تعديل العناصر فقط (المرحلة الأولى)."]
      })
    ]
  });
}

ActivityPage.pageId = "activity";
ActivityPage.migrationStatus = "native";

export default ActivityPage;
