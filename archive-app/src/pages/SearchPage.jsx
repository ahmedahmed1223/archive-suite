import {
  formatDateTime,
  formatNumber
} from "../utils/formatting.js";
import {
  parseAppRoute,
  writeAppRoute
} from "../services/router/index.js";
import {
  useAppStore
} from "../stores/index.js";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FolderOpen,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Tags,
  Video
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";

import { MobileActionBar, MotionPage, PageHero, UXStateBlock } from "../components/ui/index.js";
import {
  ARCHIVE_ITEM_SIZE_OPTIONS,
  ARCHIVE_ITEM_SIZE_LABELS,
  SegmentedControl
} from "../features/archive/ArchiveViews.jsx";
import {
  createArchiveRouteParams
} from "../features/archive/viewModel.js";
import { SavedViewsBar } from "../features/archive/SavedViewsBar.jsx";
import { VoiceSearchButton } from "../components/search/VoiceSearchButton.jsx";
import {
  addSavedView,
  captureCurrentFilters,
  getSavedViews,
  hasMeaningfulFilters,
  removeSavedView,
  renameSavedView
} from "../features/archive/savedViews.js";
import { TagCloud } from "../features/archive/TagCloud.jsx";
import { createVirtualCollectionValue } from "../features/collections/viewModel.js";
import {
  createSearchRouteParams,
  getSearchActiveFilterCount,
  getSearchResults,
  parseSearchRouteParams
} from "../features/search/viewModel.js";

const PAGE_SIZE_OPTIONS = [12, 24, 48, 96];

function SearchMetric({ label, value, hint }) {
  return jsxs("div", {
    className: "va-metric-card rounded-xl va-surface-muted border p-3 text-right",
    children: [
      jsx("p", { className: "text-xs text-gray-500", children: label }),
      jsx("p", { className: "mt-1 text-lg font-bold text-white", children: value }),
      hint && jsx("p", { className: "mt-1 text-xs text-gray-500", children: hint })
    ]
  });
}

function SearchResultCard({ item, typeLabel, subtypeLabel, index, onOpen, onOpenSnippet, resultMode = "list", itemSize = "compact" }) {
  const dense = itemSize === "xs" || itemSize === "compact";
  const cardClass = resultMode === "grid"
    ? `va-video-list-item h-full rounded-2xl va-surface-muted border ${dense ? "p-3" : "p-4"} text-right transition-colors hover:border-emerald-500/25`
    : `va-video-list-item rounded-2xl va-surface-muted border ${dense ? "p-3" : "p-4"} text-right transition-colors hover:border-emerald-500/25`;
  return jsx(motion.article, {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, delay: Math.min(index, 10) * 0.025 },
    className: cardClass,
    dir: "rtl",
    children: jsxs("div", {
      className: resultMode === "grid" ? "flex h-full flex-col gap-3" : "grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]",
      children: [
        jsxs("div", {
          className: "min-w-0",
          children: [
            jsxs("div", {
              className: "flex flex-wrap items-center gap-2",
              children: [
                jsx("h3", { className: "line-clamp-2 text-base font-bold leading-relaxed text-white", children: item.title || "بدون عنوان" }),
                item.isFavorite && jsx("span", { className: "rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200", children: "مفضلة" })
              ]
            }),
            jsx("p", { className: "mt-1 text-sm text-gray-500", children: [typeLabel, subtypeLabel].filter(Boolean).join(" / ") || "غير مصنف" }),
            item.notes && jsx("p", { className: "mt-2 line-clamp-2 text-sm leading-relaxed text-gray-400", children: item.notes }),
            item.transcriptSnippets?.length > 0 && jsxs("div", { className: "mt-3 rounded-xl border va-accent-border va-accent-bg-soft p-2.5", children: [
              jsx("p", { className: "mb-2 text-xs font-bold va-accent-text-on-soft", children: "مقتطفات من التفريغ" }),
              jsx("div", { className: "space-y-2", children: item.transcriptSnippets.map((snippet) => jsxs("button", {
                type: "button",
                onClick: () => onOpenSnippet?.(snippet),
                className: "block w-full rounded-lg border border-white/10 bg-gray-950/25 p-2 text-right text-xs leading-6 text-gray-300 transition-colors hover:border-emerald-500/25 hover:bg-emerald-500/10",
                children: [
                  snippet.timecode && jsxs("span", { className: "mb-1 inline-flex items-center gap-1 rounded-full border va-accent-border va-accent-bg-soft px-2 py-0.5 font-mono text-[11px] va-accent-text-on-soft", dir: "ltr", children: [jsx(Clock3, { className: "h-3 w-3" }), snippet.timecode] }),
                  jsx("span", { className: "block", children: snippet.text })
                ]
              }, `${snippet.index}-${snippet.seconds ?? "x"}`)) })
            ] }),
            item.tags?.length > 0 && jsx("div", {
              className: "mt-3 flex flex-wrap gap-1.5",
              children: item.tags.slice(0, 8).map((tag) => jsx("span", {
                className: "rounded-full border border-white/5 bg-gray-950/45 px-2 py-0.5 text-xs text-gray-400",
                children: tag
              }, tag))
            }),
            jsx("p", { className: "mt-3 text-xs text-gray-600", children: item.updatedAt ? `آخر تحديث: ${formatDateTime(item.updatedAt)}` : "لم يسجل تحديث" })
          ]
        }),
        jsxs("button", {
          type: "button",
          onClick: onOpen,
          className: `btn btn-primary gap-2 ${resultMode === "grid" ? "mt-auto w-full" : ""}`,
          children: [jsx(Video, { className: "h-4 w-4" }), "فتح التفاصيل"]
        })
      ]
    })
  }, item.id);
}

function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  return jsxs("div", {
    className: "va-control-surface flex flex-wrap items-center justify-between gap-3 va-surface-muted rounded-2xl border p-3",
    children: [
      jsxs("button", {
        type: "button",
        onClick: () => onPageChange(currentPage - 1),
        disabled: currentPage <= 1,
        className: "inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40",
        children: [jsx(ChevronRight, { className: "h-4 w-4" }), "السابق"]
      }),
      jsx("p", { className: "text-sm text-gray-500", children: `الصفحة ${formatNumber(currentPage)} من ${formatNumber(totalPages)}` }),
      jsxs("button", {
        type: "button",
        onClick: () => onPageChange(currentPage + 1),
        disabled: currentPage >= totalPages,
        className: "inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40",
        children: ["التالي", jsx(ChevronLeft, { className: "h-4 w-4" })]
      })
    ]
  });
}

export function SearchPage() {
  const {
    videoItems = [],
    contentTypes = [],
    settings = {},
    isLoading = false,
    recentSearches = [],
    setCurrentPage,
    setSelectedItemId,
    setSearchQuery,
    setFilterType,
    setFilterSubtype,
    addRecentSearch,
    clearRecentSearches,
    addVirtualCollection,
    updateSettings,
    showToast
  } = useAppStore();

  const initialRouteState = React.useMemo(() => parseSearchRouteParams(parseAppRoute().params), []);
  const [query, setQuery] = React.useState(initialRouteState.query || "");
  const [type, setType] = React.useState(initialRouteState.type || "all");
  const [subtype, setSubtype] = React.useState(initialRouteState.subtype || "all");
  const [favoritesOnly, setFavoritesOnly] = React.useState(initialRouteState.favoritesOnly || false);
  const [missingFieldsOnly, setMissingFieldsOnly] = React.useState(initialRouteState.missingFieldsOnly || false);
  const [dateFrom, setDateFrom] = React.useState(initialRouteState.dateFrom || "");
  const [dateTo, setDateTo] = React.useState(initialRouteState.dateTo || "");
  const [page, setPage] = React.useState(initialRouteState.page || 1);
  const [pageSize, setPageSize] = React.useState(initialRouteState.pageSize || 24);
  const [resultMode, setResultMode] = React.useState(initialRouteState.viewMode || "list");
  const [itemSize, setItemSize] = React.useState(initialRouteState.itemSize || "compact");
  const searchInputRef = React.useRef(null);
  const filtersRef = React.useRef(null);
  const skipInitialPageReset = React.useRef(true);
  const isApplyingRouteState = React.useRef(false);

  const typeById = React.useMemo(() => new Map(contentTypes.map((item) => [item.id, item])), [contentTypes]);
  const activeType = typeById.get(type);
  const subtypes = activeType?.subtypes || [];
  const activeFilterCount = getSearchActiveFilterCount({ query, type, subtype, favoritesOnly, missingFieldsOnly, dateFrom, dateTo });

  const results = React.useMemo(() => getSearchResults({
    videoItems,
    query,
    type,
    subtype,
    favoritesOnly,
    missingFieldsOnly,
    dateFrom,
    dateTo
  }), [dateFrom, dateTo, favoritesOnly, missingFieldsOnly, query, subtype, type, videoItems]);

  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleResults = results.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const savedViews = React.useMemo(() => getSavedViews(settings), [settings]);
  const currentFiltersForSave = React.useMemo(() => captureCurrentFilters({
    searchQuery: query,
    filterType: type,
    filterSubtype: subtype,
    showFavoritesOnly: favoritesOnly,
    missingFieldsOnly,
    dateFrom,
    dateTo,
    itemSize,
    viewMode: resultMode
  }), [dateFrom, dateTo, favoritesOnly, itemSize, missingFieldsOnly, query, resultMode, subtype, type]);

  React.useEffect(() => {
    const applyRouteState = () => {
      const nextState = parseSearchRouteParams(parseAppRoute().params);
      isApplyingRouteState.current = true;
      setQuery(nextState.query);
      setType(nextState.type);
      setSubtype(nextState.subtype);
      setFavoritesOnly(nextState.favoritesOnly);
      setMissingFieldsOnly(!!nextState.missingFieldsOnly);
      setDateFrom(nextState.dateFrom);
      setDateTo(nextState.dateTo);
      setPage(nextState.page);
      setPageSize(nextState.pageSize);
      setResultMode(nextState.viewMode || "list");
      setItemSize(nextState.itemSize || "compact");
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
      const params = createSearchRouteParams({ query, type, subtype, favoritesOnly, missingFieldsOnly, dateFrom, dateTo, page: currentPage, pageSize, viewMode: resultMode, itemSize });
      writeAppRoute("search", { params }, settings, true);
      setSearchQuery?.(query);
      if (query.trim()) addRecentSearch?.(query.trim());
    }, 120);
    return () => window.clearTimeout(handle);
  }, [addRecentSearch, currentPage, dateFrom, dateTo, favoritesOnly, itemSize, missingFieldsOnly, pageSize, query, resultMode, settings, setSearchQuery, subtype, type]);

  React.useEffect(() => {
    if (skipInitialPageReset.current) {
      skipInitialPageReset.current = false;
      return;
    }
    if (isApplyingRouteState.current) {
      isApplyingRouteState.current = false;
      return;
    }
    setPage(1);
  }, [dateFrom, dateTo, favoritesOnly, itemSize, missingFieldsOnly, pageSize, query, resultMode, subtype, type]);

  React.useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [currentPage, page]);

  const resetSearch = () => {
    setQuery("");
    setType("all");
    setSubtype("all");
    setFavoritesOnly(false);
    setMissingFieldsOnly(false);
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const openItem = (item, seconds = null) => {
    if (seconds !== null && Number.isFinite(Number(seconds))) {
      try {
        sessionStorage.setItem("videoArchive:pendingTranscriptSeek", JSON.stringify({ itemId: item.id, seconds: Number(seconds) }));
      } catch (error) {
        /* non-critical */
      }
    }
    setSelectedItemId?.(item.id);
    setCurrentPage?.("detail");
  };

  const handleVoiceIntent = (intent) => {
    if (intent.kind === "add") {
      showToast?.("تم التقاط أمر إضافة مادة جديدة.", "info");
      setCurrentPage?.("add");
      return;
    }

    const nextQuery = intent.query || intent.rawTranscript || "";
    setQuery(nextQuery);
    setPage(1);
    searchInputRef.current?.focus?.();

    if (intent.kind === "open") {
      const matches = getSearchResults({
        videoItems,
        query: nextQuery,
        type,
        subtype,
        favoritesOnly,
        missingFieldsOnly,
        dateFrom,
        dateTo
      });
      if (matches.length === 1) {
        openItem(matches[0]);
        showToast?.("تم فتح النتيجة المطابقة للأمر الصوتي.", "success");
      } else {
        showToast?.(matches.length ? "تم تضييق النتائج صوتياً. اختر المادة المطلوبة." : "لم أجد مادة مطابقة للأمر الصوتي.", "info");
      }
      return;
    }

    showToast?.(nextQuery ? `تم البحث صوتياً عن: ${nextQuery}` : "لم ألتقط عبارة بحث واضحة.", nextQuery ? "success" : "warning");
  };

  const handleVoiceUnsupported = () => {
    showToast?.("البحث الصوتي غير متاح في هذا المتصفح. استخدم Chrome أو Edge مع إذن الميكروفون.", "warning");
  };

  const handleVoiceError = (error) => {
    const message = error === "not-allowed" || error === "service-not-allowed"
      ? "لم يُمنح إذن الميكروفون للبحث الصوتي."
      : "تعذر التقاط الصوت. جرّب مرة أخرى من زر الميكروفون.";
    showToast?.(message, "warning");
  };

  const openInArchive = () => {
    setSearchQuery?.(query);
    setFilterType?.(type);
    setFilterSubtype?.(subtype);
    const params = createArchiveRouteParams({
      searchQuery: query,
      filterType: type,
      filterSubtype: subtype,
      showFavoritesOnly: favoritesOnly,
      itemSize,
      viewMode: resultMode === "grid" ? "grid" : "list"
    });
    writeAppRoute("archive", { params }, settings, false);
    setCurrentPage?.("archive");
  };

  const applySavedView = (view) => {
    if (!view?.filters) return;
    const filters = view.filters;
    setQuery(filters.query || "");
    setType(filters.type || "all");
    setSubtype(filters.subtype || "all");
    setFavoritesOnly(!!filters.favoritesOnly);
    setMissingFieldsOnly(!!filters.missingFieldsOnly);
    setDateFrom(filters.dateFrom || "");
    setDateTo(filters.dateTo || "");
    setResultMode(filters.viewMode === "grid" ? "grid" : "list");
    setItemSize(filters.itemSize || "compact");
    setPage(1);
    showToast?.(`تم تطبيق "${view.name}"`, "info");
  };

  const saveCurrentView = async (name, filters) => {
    const nextList = addSavedView(settings, { name, filters });
    await updateSettings?.({ ui: { ...(settings.ui || {}), savedArchiveViews: nextList } });
    showToast?.(`تم حفظ العرض "${name}"`, "success");
  };

  const removeView = async (viewId) => {
    const nextList = removeSavedView(settings, viewId);
    await updateSettings?.({ ui: { ...(settings.ui || {}), savedArchiveViews: nextList } });
  };

  const renameView = async (viewId, name) => {
    const nextList = renameSavedView(settings, viewId, name);
    await updateSettings?.({ ui: { ...(settings.ui || {}), savedArchiveViews: nextList } });
  };

  const saveAsSmartCollection = async () => {
    const created = await addVirtualCollection?.(createVirtualCollectionValue({
      name: query.trim() ? `بحث: ${query.trim()}` : "مجموعة ذكية جديدة",
      type: "smart",
      filterRules: { kind: "advanced-search", options: { query, type, subtype, favoritesOnly, missingFieldsOnly, dateFrom, dateTo } }
    }));
    if (created) showToast?.("تم حفظ البحث كمجموعة ذكية — تُحدّث نتائجها تلقائياً.", "success");
  };

  const typeLabel = (item) => typeById.get(item.type)?.name || item.type || "";
  const subtypeLabel = (item) => typeById.get(item.type)?.subtypes?.find((sub) => sub.id === item.subtype)?.name || item.subtype || "";

  return jsxs(MotionPage, {
    className: "space-y-6 p-4 pb-24 sm:p-6",
    children: [
      jsx(PageHero, {
        icon: jsx(Search, { className: "h-6 w-6 va-accent-text" }),
        title: "البحث المتقدم",
        description: "بحث لحظي داخل الأرشيف مع فلاتر مباشرة ونتائج مصغرة بدون مغادرة الصفحة.",
        actions: jsxs(React.Fragment, {
          children: [
            activeFilterCount > 0 && jsxs("button", { type: "button", onClick: saveAsSmartCollection, className: "va-secondary-button inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-white/5", children: [jsx(FolderOpen, { className: "h-4 w-4" }), "حفظ كمجموعة ذكية"] }, "save-smart-collection"),
            jsxs("button", { type: "button", onClick: openInArchive, className: "va-secondary-button inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-white/5", children: [jsx(Archive, { className: "h-4 w-4" }), "عرض في الأرشيف"] }, "open-in-archive"),
            jsxs("button", { type: "button", onClick: () => setCurrentPage?.("add"), className: "btn btn-primary gap-2", children: [jsx(Video, { className: "h-4 w-4" }), "إضافة فيديو"] }, "add-video")
          ]
        })
      }),
      jsxs("section", {
        className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
        children: [
          jsx(SearchMetric, { label: "نتائج البحث", value: formatNumber(results.length), hint: results.length ? `عرض ${formatNumber(visibleResults.length)} الآن` : "لا توجد نتائج" }),
          jsx(SearchMetric, { label: "الفلاتر", value: formatNumber(activeFilterCount), hint: activeFilterCount ? "فلاتر مطبقة" : "بحث واسع" }),
          jsx(SearchMetric, { label: "المفضلة", value: formatNumber(results.filter((item) => item.isFavorite).length), hint: "ضمن النتائج" }),
          jsx(SearchMetric, { label: "كل العناصر", value: formatNumber(videoItems.filter((item) => !item.isDeleted).length), hint: "نشطة في الأرشيف" })
        ]
      }),
      jsx(SavedViewsBar, {
        views: savedViews,
        currentFilters: currentFiltersForSave,
        canSave: hasMeaningfulFilters(currentFiltersForSave),
        onApply: applySavedView,
        onSave: saveCurrentView,
        onRemove: removeView,
        onRename: renameView
      }),
      jsxs("section", {
        ref: filtersRef,
        role: "search",
        "aria-label": "بحث في الأرشيف",
        className: "va-filter-surface rounded-2xl va-surface-muted border p-4 text-right backdrop-blur-sm",
        children: [
          jsxs("div", {
            className: "grid gap-3 xl:grid-cols-[minmax(260px,1fr)_220px_180px_160px]",
            children: [
              jsxs("label", {
                className: "relative block",
                children: [
                  jsx(Search, { className: "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" }),
                  jsx("input", {
                    ref: searchInputRef,
                    value: query,
                    onChange: (event) => setQuery(event.target.value),
                    placeholder: "ابحث في العنوان أو الوسوم أو الملاحظات",
                    "aria-label": "كلمات البحث",
                    type: "search",
                    className: "min-h-11 w-full va-surface-deep rounded-xl border py-2 pl-12 pr-10 text-sm text-white outline-none focus:border-emerald-500/50"
                  }),
                  jsx("span", {
                    className: "absolute left-2 top-1/2 -translate-y-1/2",
                    children: jsx(VoiceSearchButton, {
                      onIntent: handleVoiceIntent,
                      onUnsupported: handleVoiceUnsupported,
                      onError: handleVoiceError
                    })
                  })
                ]
              }),
              jsxs("select", {
                "aria-label": "تصفية البحث حسب نوع المحتوى",
                value: type,
                onChange: (event) => {
                  setType(event.target.value);
                  setSubtype("all");
                },
                className: "min-h-11 va-surface-deep rounded-xl border px-3 py-2 text-sm text-white",
                children: [
                  jsx("option", { value: "all", children: "كل الأنواع" }),
                  ...contentTypes.map((item) => jsx("option", { value: item.id, children: item.name || item.id }, item.id))
                ]
              }),
              jsxs("select", {
                "aria-label": "تصفية البحث حسب الفرع",
                value: subtype,
                onChange: (event) => setSubtype(event.target.value),
                disabled: !subtypes.length,
                className: "min-h-11 va-surface-deep rounded-xl border px-3 py-2 text-sm text-white disabled:opacity-50",
                children: [
                  jsx("option", { value: "all", children: "كل الفروع" }),
                  ...subtypes.map((item) => jsx("option", { value: item.id, children: item.name || item.id }, item.id))
                ]
              }),
              jsxs("select", {
                "aria-label": "عدد نتائج البحث في الصفحة",
                value: pageSize,
                onChange: (event) => setPageSize(Number(event.target.value)),
                className: "min-h-11 va-surface-deep rounded-xl border px-3 py-2 text-sm text-white",
                children: PAGE_SIZE_OPTIONS.map((value) => jsx("option", { value, children: `${formatNumber(value)} نتيجة` }, value))
              })
            ]
          }),
          jsxs("div", {
            className: "mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-[1fr_1fr_auto_auto_auto]",
            children: [
              jsxs("label", {
                className: "block va-surface-muted rounded-xl border p-3",
                children: [
                  jsx("span", { className: "text-xs text-gray-500", children: "من تاريخ" }),
                  jsx("input", { type: "date", value: dateFrom, onChange: (event) => setDateFrom(event.target.value), dir: "ltr", className: "mt-2 min-h-9 w-full rounded-lg border border-white/10 bg-gray-900 px-3 py-1 text-sm text-white outline-none focus:border-emerald-500/40" })
                ]
              }),
              jsxs("label", {
                className: "block va-surface-muted rounded-xl border p-3",
                children: [
                  jsx("span", { className: "text-xs text-gray-500", children: "إلى تاريخ" }),
                  jsx("input", { type: "date", value: dateTo, onChange: (event) => setDateTo(event.target.value), dir: "ltr", className: "mt-2 min-h-9 w-full rounded-lg border border-white/10 bg-gray-900 px-3 py-1 text-sm text-white outline-none focus:border-emerald-500/40" })
                ]
              }),
              jsx("button", {
                type: "button",
                onClick: () => setFavoritesOnly((value) => !value),
                className: `rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${favoritesOnly ? "border-amber-500/30 bg-amber-500/10 text-amber-100" : "border-white/10 text-gray-300 hover:bg-white/5"}`,
                children: "المفضلة فقط"
              }),
              jsx("button", {
                type: "button",
                onClick: () => setMissingFieldsOnly((value) => !value),
                className: `rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${missingFieldsOnly ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "border-white/10 text-gray-300 hover:bg-white/5"}`,
                children: "حقول ناقصة"
              }),
              activeFilterCount > 0 && jsxs("button", {
                type: "button",
                onClick: resetSearch,
                className: "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-gray-300 hover:bg-white/5",
                children: [jsx(RefreshCw, { className: "h-4 w-4" }), "مسح"]
              })
            ]
          }),
          jsxs("div", {
            className: "mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3",
            children: [
              jsx(SegmentedControl, {
                label: "عرض النتائج",
                value: resultMode,
                options: [
                  { value: "list", label: "قائمة", icon: jsx(List, { className: "h-3.5 w-3.5" }) },
                  { value: "grid", label: "بطاقات", icon: jsx(LayoutGrid, { className: "h-3.5 w-3.5" }) }
                ],
                onChange: setResultMode
              }),
              jsxs("label", {
                className: "inline-flex min-h-9 items-center gap-2 va-surface-muted rounded-xl border px-2.5 py-1 text-xs text-gray-400",
                children: [
                  jsx("span", { className: "text-gray-500", children: "الكثافة" }),
                  jsx("select", {
                    value: itemSize,
                    onChange: (event) => setItemSize(event.target.value),
                    "aria-label": "كثافة نتائج البحث",
                    className: "min-h-7 rounded-lg border-0 bg-transparent px-1 text-xs font-semibold text-white outline-none",
                    children: ARCHIVE_ITEM_SIZE_OPTIONS.map((option) => jsx("option", { value: option.value, children: ARCHIVE_ITEM_SIZE_LABELS[option.value] || option.label }, option.value))
                  })
                ]
              })
            ]
          })
        ]
      }),
      isLoading && results.length === 0 && videoItems.length === 0 && activeFilterCount === 0 ? jsx(UXStateBlock, {
        state: "loading",
        title: "جارٍ تحميل قاعدة البحث",
        className: "va-card va-surface-muted"
      }) :
      results.length === 0 ? jsxs("section", {
        className: "space-y-4",
        children: [
          jsx(UXStateBlock, {
            icon: jsx(Search, { className: "h-7 w-7", "aria-hidden": true }),
            title: activeFilterCount ? "لا توجد نتائج مطابقة" : "ابدأ بكتابة كلمة بحث",
            description: activeFilterCount
              ? "جرّب كلمة أقصر، أو امسح بعض الفلاتر، أو افتح الأرشيف لاستعراض كل العناصر."
              : "اكتب جزءاً من العنوان أو الوسم أو الملاحظة لتظهر النتائج هنا مباشرة.",
            actionLabel: activeFilterCount > 0 ? "مسح البحث" : undefined,
            onAction: activeFilterCount > 0 ? resetSearch : undefined,
            className: "va-card rounded-2xl border border-dashed border-white/10 bg-gray-950/35"
          }),
          jsx(TagCloud, { videoItems, onSelect: (tag) => setQuery(tag), activeTag: query }),
          recentSearches.length > 0 && jsxs("div", {
            className: "va-card rounded-2xl border p-4 text-right",
            dir: "rtl",
            children: [
              jsxs("div", {
                className: "mb-3 flex items-center justify-between gap-2",
                children: [
                  jsxs("h3", { className: "flex items-center gap-2 text-sm font-semibold text-gray-300", children: [jsx(Tags, { className: "h-4 w-4 va-accent-text" }), "عمليات البحث الأخيرة"] }),
                  jsx("button", { type: "button", onClick: clearRecentSearches, className: "text-xs text-gray-600 hover:text-gray-400 transition-colors", children: "مسح الكل" })
                ]
              }),
              jsx("div", {
                className: "flex flex-wrap gap-2",
                children: recentSearches.map((term) => jsxs("button", {
                  type: "button",
                  onClick: () => setQuery(term),
                  className: "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-gray-900/60 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-200",
                  children: [jsx(Search, { className: "h-3 w-3 opacity-60" }), term]
                }, term))
              })
            ]
          })
        ]
      }) : jsxs("section", {
        className: "space-y-4",
        children: [
          jsxs("div", {
            className: "va-control-surface flex flex-wrap items-center justify-between gap-3 va-surface-muted rounded-2xl border p-3 text-sm",
            children: [
              jsx("p", { className: "font-semibold text-white", children: `عرض ${formatNumber(visibleResults.length)} من ${formatNumber(results.length)} نتيجة` }),
              jsx("p", { className: "text-xs text-gray-500", children: query ? `بحث عن: ${query}` : "كل النتائج حسب الفلاتر" })
            ]
          }),
          jsx("div", {
            className: resultMode === "grid" ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3" : "space-y-3",
            children: visibleResults.map((item, index) => jsx(SearchResultCard, {
              item,
              index,
              typeLabel: typeLabel(item),
              subtypeLabel: subtypeLabel(item),
              resultMode,
              itemSize,
              onOpen: () => openItem(item),
              onOpenSnippet: (snippet) => openItem(item, snippet.seconds)
            }, item.id))
          }),
          jsx(Pagination, { currentPage, totalPages, onPageChange: (nextPage) => setPage(Math.min(Math.max(nextPage, 1), totalPages)) })
        ]
      }),
      jsx(MobileActionBar, {
        label: "إجراءات البحث",
        actions: [
          { id: "filters", label: "فلاتر", icon: SlidersHorizontal, active: activeFilterCount > 0, onClick: () => filtersRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }) },
          { id: "save", label: "حفظ", icon: FolderOpen, disabled: activeFilterCount <= 0, onClick: saveAsSmartCollection },
          { id: "archive", label: "الأرشيف", icon: Archive, onClick: openInArchive },
          { id: "reset", label: "مسح", icon: RefreshCw, disabled: activeFilterCount <= 0, onClick: resetSearch },
          { id: "add", label: "إضافة", icon: Video, primary: true, onClick: () => setCurrentPage?.("add") }
        ]
      })
    ]
  });
}

SearchPage.pageId = "search";
SearchPage.migrationStatus = "native";

export default SearchPage;
