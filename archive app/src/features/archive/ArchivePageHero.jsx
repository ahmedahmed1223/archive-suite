import {
  Archive,
  CheckSquare,
  FolderOpen,
  LayoutGrid,
  RefreshCw,
  Rows3,
  Search,
  SlidersHorizontal,
  Tags,
  Trash2,
  TriangleAlert,
  Upload,
  Video,
  X
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import { PageHero } from "../../components/ui/V1Primitives.jsx";
import { KbdHint } from "../../components/common/Kbd.jsx";
import { formatNumber } from "../../utils/formatting.js";
import { isHtml5PreviewableVideo } from "./mediaPreview.js";
import { ArchiveSortMenu } from "./ArchiveToolbar.jsx";
import { ColumnManagerMenu } from "./ColumnManagerMenu.jsx";
import {
  ARCHIVE_ITEM_SIZE_OPTIONS,
  ARCHIVE_PAGE_SIZE_OPTIONS,
  SegmentedControl,
  ToolbarButton
} from "./ArchiveViews.jsx";
import { ExportButton } from "../../components/archive/ExportButton.jsx";

function CompactStat({ label, value, hint }) {
  return jsxs("span", {
    className: "inline-flex min-h-9 items-center gap-2 va-surface-muted rounded-xl border px-3 py-1.5 text-xs text-gray-400",
    children: [
      jsx("span", { className: "text-gray-500", children: label }),
      jsx("strong", { className: "text-sm text-white", children: value }),
      hint && jsx("span", { className: "hidden text-gray-600 sm:inline", children: hint })
    ]
  });
}

function MobileControlButton({ children, onClick, active = false, danger = false, icon }) {
  return jsxs("button", {
    type: "button",
    onClick,
    "aria-pressed": active,
    className: `inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
      active
        ? danger
          ? "border-red-500/35 bg-red-500/15 text-red-100"
          : "va-accent-border va-accent-bg-soft va-accent-text-on-soft border"
        : "border-white/10 bg-gray-950/35 text-gray-400 hover:bg-white/5 hover:text-white"
    }`,
    children: [
      icon,
      jsx("span", { className: "truncate", children })
    ]
  });
}

const VIEW_MODE_BUTTONS = [
  { id: "grid", label: "شبكة", Icon: LayoutGrid },
  { id: "compact", label: "مدمجة", Icon: Rows3 },
  { id: "list", label: "قائمة", Icon: Archive },
  { id: "details", label: "تفاصيل", Icon: FolderOpen }
];

/**
 * Windows-Explorer-style density slider for grid view. Drag to set how many
 * items sit per row (2 = large cards, 8 = small/dense) — one control that
 * replaces the old "columns" + "rows" segmented buttons. Writes an explicit
 * column count via `changeGridColumns`; page size follows (rows × columns).
 */
function GridDensitySlider({ gridColumns, gridColumnCount, onChange }) {
  const current = gridColumns === "auto" ? (gridColumnCount || 3) : (Number(gridColumns) || 3);
  const value = Math.min(8, Math.max(2, current));
  return jsxs("label", {
    className: "va-surface-muted inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 py-1 text-xs text-gray-400",
    title: "اسحب للتحكم بحجم العناصر وعددها في الصف",
    children: [
      jsx("span", { className: "shrink-0 text-gray-500", children: "أكبر" }),
      jsx("input", {
        type: "range",
        min: 2,
        max: 8,
        step: 1,
        value,
        onChange: (event) => onChange(Number(event.target.value)),
        "aria-label": "حجم عناصر الشبكة وعددها في الصف",
        className: "va-range w-24 sm:w-36"
      }),
      jsx("span", { className: "shrink-0 text-gray-500", children: "أصغر" }),
      jsx("span", { className: "min-w-[3.25rem] shrink-0 text-center font-semibold text-gray-200", children: `${formatNumber(value)} بالصف` })
    ]
  });
}

/**
 * The top hero band of the archive page — search bar, view-mode
 * switcher, item-size, columns/rows/page-size controls, quick stats,
 * sort, mode toggle (quick/detailed). Lives on its own because the
 * markup is dense and was responsible for ~200 lines of the original
 * ArchivePage.jsx.
 */
export function ArchivePageHero(props) {
  const {
    activeTopMode,
    activeViewMode,
    activeItemSize,
    activeGridRows,
    gridColumns,
    gridColumnCount,
    localSearch,
    setLocalSearch,
    quickSearchMatches,
    setPage,
    setPreviewId,
    listPageSize,
    activePageSize,
    rangeText,
    filteredItems,
    videoItems,
    activeFilterCount,
    showFavoritesOnly,
    setShowFavoritesOnly,
    showGapsOnly,
    setShowGapsOnly,
    showDeleted,
    setShowDeleted,
    bulkMode,
    setBulkMode,
    clearSelection,
    sortField,
    sortDirection,
    setSortField,
    setSortDirection,
    hasFilters,
    resetFilters,
    tableColumns,
    changeTableColumns,
    changeTopMode,
    changeViewMode,
    changeItemSize,
    changeGridColumns,
    changeGridRows,
    changePageSize,
    openImport,
    openAdd,
    confirmEmptyTrash,
    storeSelectedItems = []
  } = props;

  const [mobileControlsOpen, setMobileControlsOpen] = React.useState(false);
  const mobilePanelId = "archive-mobile-controls-panel";
  const currentViewLabel = VIEW_MODE_BUTTONS.find((button) => button.id === activeViewMode)?.label || "شبكة";

  React.useEffect(() => {
    if (!mobileControlsOpen || typeof window === "undefined") return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMobileControlsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileControlsOpen]);

  const handleSortChange = ({ sortField: nextField, sortDirection: nextDirection }) => {
    setSortField(nextField);
    setSortDirection(nextDirection);
  };

  const toggleBulkMode = () => {
    setBulkMode((value) => {
      if (value) clearSelection?.();
      return !value;
    });
  };

  const resetMobileFilters = () => {
    resetFilters();
    setMobileControlsOpen(false);
  };

  const topModeControl = ({ mobile = false } = {}) => jsxs("div", {
    className: `va-control-surface inline-flex min-h-9 overflow-hidden va-surface-muted rounded-xl border p-1 ${mobile ? "w-full" : ""}`,
    role: "group",
    "aria-label": "وضع القسم العلوي",
    children: [
      jsx("button", {
        type: "button",
        onClick: () => changeTopMode("quick"),
        "aria-pressed": activeTopMode === "quick",
        className: `rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${mobile ? "flex-1" : ""} ${activeTopMode === "quick" ? "va-accent-bg-soft va-accent-text-on-soft" : "text-gray-400 hover:bg-white/5 hover:text-white"}`,
        children: "سريع"
      }),
      jsx("button", {
        type: "button",
        onClick: () => changeTopMode("detailed"),
        "aria-pressed": activeTopMode === "detailed",
        className: `rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${mobile ? "flex-1" : ""} ${activeTopMode === "detailed" ? "va-accent-bg-soft va-accent-text-on-soft" : "text-gray-400 hover:bg-white/5 hover:text-white"}`,
        children: "تفصيلي"
      })
    ]
  });

  const viewModeControl = ({ mobile = false } = {}) => jsx("div", {
    className: `join va-control-surface min-h-9 overflow-hidden va-surface-muted rounded-xl border p-1 ${mobile ? "flex w-full flex-wrap" : "inline-flex"}`,
    role: "group",
    "aria-label": "وضع عرض الأرشيف",
    children: VIEW_MODE_BUTTONS.map(({ id, label, Icon }) => jsxs("button", {
      type: "button",
      onClick: () => changeViewMode(id),
      "aria-pressed": activeViewMode === id,
      className: `btn btn-xs join-item min-h-7 gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${mobile ? "flex-1 justify-center" : ""} ${activeViewMode === id ? "btn-active btn-primary" : "btn-ghost"}`,
      children: [jsx(Icon, { className: "h-3.5 w-3.5" }), label]
    }, id))
  });

  const renderSizingControl = () => (activeViewMode === "grid" || activeViewMode === "compact") ? jsx(GridDensitySlider, {
    gridColumns,
    gridColumnCount,
    onChange: changeGridColumns
  }) : jsxs("div", {
    className: "inline-flex flex-wrap items-center gap-2",
    children: [
      activeViewMode === "details" && jsx(ColumnManagerMenu, {
        stored: tableColumns,
        onChange: changeTableColumns
      }),
      jsxs("label", {
        className: "inline-flex min-h-9 items-center gap-2 va-surface-muted rounded-xl border px-2.5 py-1 text-xs text-gray-400",
        children: [
          jsx("span", { className: "text-gray-500", children: "في الصفحة" }),
          jsxs("select", {
            value: listPageSize,
            onChange: (event) => changePageSize(event.target.value),
            "aria-label": "عدد العناصر في الصفحة",
            className: "min-h-7 rounded-lg border-0 bg-transparent px-1 text-xs font-semibold text-white outline-none",
            children: ARCHIVE_PAGE_SIZE_OPTIONS.map((option) => jsx("option", { value: option, children: formatNumber(option) }, option))
          })
        ]
      })
    ]
  });

  return jsx(PageHero, {
    icon: jsx(Archive, { className: "h-6 w-6 va-accent-text" }),
    title: "الأرشيف",
    compact: true,
    actions: jsxs(React.Fragment, {
      children: [
        jsxs("button", {
          type: "button",
          onClick: () => setMobileControlsOpen(true),
          "aria-expanded": mobileControlsOpen,
          "aria-controls": mobilePanelId,
          className: "va-tool-button inline-flex min-h-9 items-center gap-2 rounded-xl border border-white/10 bg-gray-950/35 px-3 py-1.5 text-sm font-semibold text-gray-200 hover:bg-white/5 md:hidden",
          title: "خيارات العرض والفلاتر",
          children: [
            jsx(SlidersHorizontal, { className: "h-4 w-4 va-accent-text" }),
            "خيارات",
            activeFilterCount > 0 && jsx("span", { className: "rounded-full va-accent-bg-soft px-2 py-0.5 text-[11px] va-accent-text-on-soft", children: formatNumber(activeFilterCount) })
          ]
        }),
        jsxs("button", {
          type: "button",
          onClick: openAdd,
          className: "va-primary-button inline-flex min-h-9 items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold text-white md:hidden",
          title: "إضافة فيديو — اختصار A",
          children: [
            jsx(Video, { className: "h-4 w-4" }),
            "إضافة فيديو",
            jsx(KbdHint, { keys: ["A"], className: "opacity-80" })
          ]
        })
      ]
    }),
    children: jsxs(React.Fragment, { children: [
      jsxs("div", {
        className: "mt-3 grid gap-2 xl:grid-cols-[minmax(18rem,1fr)_auto]",
        children: [
          jsxs("label", {
            className: "relative block",
            children: [
              jsx(Search, { className: "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" }),
              jsx("input", {
                value: localSearch,
                onChange: (event) => setLocalSearch(event.target.value),
                placeholder: "بحث بالعنوان أو الوسوم أو الملاحظات",
                "aria-label": "بحث في الأرشيف",
                className: "min-h-10 w-full va-surface-deep rounded-xl border py-2 pl-3 pr-12 text-sm text-white outline-none focus:border-[var(--va-action,#10b981)]"
              }),
              jsx("span", {
                className: "pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2",
                children: jsx(KbdHint, { keys: ["/"], className: "opacity-70" })
              })
            ]
          }),
          jsxs("div", {
            className: "va-control-surface flex min-h-10 flex-wrap items-center gap-2 rounded-xl border px-2 py-1 va-surface-muted",
            "aria-label": "شريط عمل الأرشيف",
            children: [
              jsx("div", {
                className: "hidden flex-wrap items-center gap-2 md:flex",
                children: [
                  topModeControl(),
                  viewModeControl(),
                  renderSizingControl(),
                  jsx(ArchiveSortMenu, {
                    sortField,
                    sortDirection,
                    onChange: handleSortChange
                  })
                ]
              }),
              jsxs("button", {
                type: "button",
                onClick: () => setMobileControlsOpen(true),
                "aria-expanded": mobileControlsOpen,
                "aria-controls": mobilePanelId,
                className: "va-tool-button inline-flex min-h-9 items-center gap-2 rounded-xl border border-white/10 bg-gray-950/35 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-white/5 md:hidden",
                children: [
                  jsx(SlidersHorizontal, { className: "h-4 w-4 va-accent-text" }),
                  currentViewLabel,
                  activeFilterCount > 0 && jsx("span", { className: "rounded-full va-accent-bg-soft px-2 py-0.5 text-[11px] va-accent-text-on-soft", children: formatNumber(activeFilterCount) })
                ]
              }),
              jsx(ToolbarButton, {
                active: bulkMode,
                onClick: toggleBulkMode,
                icon: jsx(CheckSquare, { className: "h-4 w-4" }),
                children: bulkMode ? "إنهاء التحديد" : "تحديد"
              }),
              jsx(ToolbarButton, {
                onClick: openImport,
                icon: jsx(Upload, { className: "h-4 w-4" }),
                children: "استيراد"
              }),
              jsx(ExportButton, { selectedIds: storeSelectedItems }),
              (hasFilters || showDeleted) && jsx(ToolbarButton, {
                onClick: resetFilters,
                icon: jsx(RefreshCw, { className: "h-4 w-4" }),
                children: "مسح"
              }),
              showDeleted && confirmEmptyTrash && jsxs("button", {
                type: "button",
                onClick: () => {
                  const deletedCount = videoItems.filter((item) => item.isDeleted).length;
                  confirmEmptyTrash(deletedCount);
                },
                className: "inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/15",
                title: "حذف نهائي لجميع عناصر سلة المحذوفات",
                children: [
                  jsx(Trash2, { className: "h-3.5 w-3.5" }),
                  "إفراغ السلة"
                ]
              }),
              jsxs("button", {
                type: "button",
                onClick: openAdd,
                className: "va-primary-button inline-flex min-h-9 items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold text-white",
                title: "إضافة فيديو — اختصار A",
                children: [
                  jsx(Video, { className: "h-4 w-4" }),
                  "إضافة"
                ]
              })
            ]
          })
        ]
      }),
      quickSearchMatches.length > 0 && jsxs("div", {
        className: "mt-2 rounded-xl va-surface-subtle border p-2",
        children: [
          jsx("p", { className: "mb-1 text-xs font-semibold text-gray-500", children: "نتائج سريعة" }),
          jsx("div", {
            className: "flex gap-2 overflow-x-auto md:grid md:grid-cols-2 md:overflow-visible xl:grid-cols-5",
            children: quickSearchMatches.map((item) => jsxs("button", {
              type: "button",
              onClick: () => {
                setPage(1);
                setPreviewId(item.id);
              },
              className: "va-action-card min-w-[12rem] rounded-xl va-surface-subtle border px-3 py-2 text-right hover:border-[var(--va-action,#10b981)]/25 md:min-w-0",
              children: [
                jsx("span", { dir: "auto", className: "block truncate text-xs font-semibold text-white", children: item.title || "بدون عنوان" }),
                jsx("span", { className: "mt-0.5 block truncate text-[11px] text-gray-500", children: item.updatedAt ? `آخر تحديث: ${item.updatedAt.slice(0, 10)}` : "بدون تاريخ" })
              ]
            }, item.id))
          })
        ]
      }),
      mobileControlsOpen && jsxs(React.Fragment, {
        children: [
          jsx("button", {
            type: "button",
            className: "fixed inset-0 z-40 bg-black/55",
            onClick: () => setMobileControlsOpen(false),
            "aria-label": "إغلاق خيارات الأرشيف"
          }),
          jsxs("section", {
            id: mobilePanelId,
            role: "dialog",
            "aria-modal": "true",
            "aria-label": "خيارات الفلاتر والعرض",
            dir: "rtl",
            className: "va-surface-muted fixed inset-x-3 bottom-4 z-50 mx-auto max-h-[78vh] max-w-2xl overflow-y-auto rounded-2xl border p-3 text-right shadow-2xl shadow-black/40",
            children: [
              jsxs("div", {
                className: "flex items-start justify-between gap-3",
                children: [
                  jsxs("div", {
                    className: "min-w-0",
                    children: [
                      jsx("h3", { className: "text-sm font-bold text-white", children: "خيارات الأرشيف" }),
                      jsx("p", { className: "mt-1 text-xs leading-5 text-gray-500", children: "الفلاتر وطريقة العرض بدون إبعاد النتائج عن أول الشاشة." })
                    ]
                  }),
                  jsx("button", {
                    type: "button",
                    onClick: () => setMobileControlsOpen(false),
                    className: "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-gray-300",
                    "aria-label": "إغلاق",
                    children: jsx(X, { className: "h-4 w-4" })
                  })
                ]
              }),
              jsxs("div", {
                className: "mt-3 space-y-2",
                children: [
                  jsx("p", { className: "text-xs font-semibold text-gray-500", children: "النمط" }),
                  topModeControl({ mobile: true })
                ]
              }),
              jsxs("div", {
                className: "mt-3 space-y-2",
                children: [
                  jsx("p", { className: "text-xs font-semibold text-gray-500", children: "طريقة العرض" }),
                  viewModeControl({ mobile: true })
                ]
              }),
              jsxs("div", {
                className: "mt-3 space-y-2",
                children: [
                  jsx("p", { className: "text-xs font-semibold text-gray-500", children: "الحجم والكثافة" }),
                  jsx(SegmentedControl, {
                    label: "الحجم",
                    value: activeItemSize,
                    options: ARCHIVE_ITEM_SIZE_OPTIONS,
                    onChange: changeItemSize
                  }),
                  jsx("div", { className: "flex flex-wrap items-center gap-2", children: renderSizingControl() })
                ]
              }),
              jsxs("div", {
                className: "mt-3 grid grid-cols-2 gap-2",
                children: [
                  jsx(MobileControlButton, { active: showFavoritesOnly, onClick: () => setShowFavoritesOnly((value) => !value), icon: jsx(Tags, { className: "h-4 w-4" }), children: "المفضلة" }),
                  jsx(MobileControlButton, { active: showDeleted, danger: showDeleted, onClick: () => setShowDeleted((value) => !value), icon: jsx(Trash2, { className: "h-4 w-4" }), children: "المحذوفات" }),
                  jsx(MobileControlButton, { active: showGapsOnly, onClick: () => setShowGapsOnly?.((value) => !value), icon: jsx(TriangleAlert, { className: "h-4 w-4" }), children: "بحاجة لتوصيف" }),
                  jsx(MobileControlButton, { active: bulkMode, onClick: toggleBulkMode, icon: jsx(CheckSquare, { className: "h-4 w-4" }), children: bulkMode ? "إنهاء التحديد" : "تحديد متعدد" })
                ]
              }),
              jsxs("div", {
                className: "mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3",
                children: [
                  jsx(ArchiveSortMenu, {
                    sortField,
                    sortDirection,
                    onChange: handleSortChange
                  }),
                  (hasFilters || showDeleted) && jsx(ToolbarButton, { onClick: resetMobileFilters, icon: jsx(RefreshCw, { className: "h-4 w-4" }), children: "مسح الفلاتر" }),
                  showDeleted && confirmEmptyTrash && jsxs("button", {
                    type: "button",
                    onClick: () => {
                      setMobileControlsOpen(false);
                      const deletedCount = videoItems.filter((item) => item.isDeleted).length;
                      confirmEmptyTrash(deletedCount);
                    },
                    className: "inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/15",
                    children: [jsx(Trash2, { className: "h-3.5 w-3.5" }), "إفراغ السلة"]
                  })
                ]
              }),
              jsxs("div", {
                className: "mt-3 grid grid-cols-2 gap-2",
                children: [
                  jsx(ToolbarButton, { onClick: () => { setMobileControlsOpen(false); openImport?.(); }, icon: jsx(Upload, { className: "h-4 w-4" }), children: "استيراد" }),
                  jsxs("button", {
                    type: "button",
                    onClick: () => { setMobileControlsOpen(false); openAdd?.(); },
                    className: "va-primary-button inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white",
                    children: [jsx(Video, { className: "h-4 w-4" }), "إضافة"]
                  })
                ]
              })
            ]
          })
        ]
      })
    ] })
  });
}

export default ArchivePageHero;
