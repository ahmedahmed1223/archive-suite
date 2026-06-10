import {
  Activity,
  Archive,
  Check,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Gauge,
  HardDrive,
  LayoutGrid,
  MoreHorizontal,
  PenLine,
  Plus,
  RotateCcw,
  Rows3,
  Scaling,
  Square,
  Star,
  Tags,
  Trash2,
  Video
} from "lucide-react";
import { motion } from "framer-motion";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import {
  MEDIA_PREVIEW_STATUS,
  getMediaPreviewDescriptor
} from "./mediaPreview.js";
import { COMPLETENESS_TIERS, computeCompleteness } from "./completeness.js";
import {
  formatDateTime,
  formatFileSize,
  formatNumber
} from "../../utils/formatting.js";
import { normalizeLocalFileValue } from "../videos/viewModel.js";
import { InlineCellEditor } from "../../components/data/InlineCellEditor.jsx";

export const ARCHIVE_VIEW_MODES = [
  { id: "grid", label: "شبكة", Icon: LayoutGrid },
  { id: "tiles", label: "بلاطات", Icon: Rows3 },
  { id: "list", label: "قائمة", Icon: Archive },
  { id: "table", label: "تفاصيل", Icon: FolderOpen }
];

/** Compact icon-only view-mode switcher (grid / tiles / list / table). */
export function ViewModeSwitch({ value = "grid", onChange, className = "" }) {
  return jsx("div", {
    className: `va-control-surface inline-flex min-h-8 overflow-hidden va-surface-muted rounded-lg border p-0.5 ${className}`,
    role: "group",
    "aria-label": "طريقة العرض",
    children: ARCHIVE_VIEW_MODES.map(({ id, label, Icon }) => jsx("button", {
      type: "button",
      onClick: () => onChange?.(id),
      "aria-pressed": value === id,
      title: label,
      "aria-label": `عرض ${label}`,
      className: `inline-flex h-7 w-8 items-center justify-center rounded-md transition-colors ${value === id ? "va-accent-bg-soft va-accent-text-on-soft" : "text-gray-300 hover:bg-white/5 hover:text-white"}`,
      children: jsx(Icon, { className: "h-4 w-4" })
    }, id))
  });
}

/**
 * Windows-Explorer-style item-size slider — works in EVERY view (grid, tiles,
 * list, table). Maps the 5 size levels (فحص سريع → أكبر) to a 0-4 range so the
 * user can tune how large each item renders, independent of column count.
 */
export function ItemSizeSlider({ value = "comfortable", onChange, className = "" }) {
  const found = ARCHIVE_ITEM_SIZE_OPTIONS.findIndex((option) => option.value === value);
  const idx = found < 0 ? 2 : found;
  return jsxs("label", {
    className: `va-surface-muted inline-flex min-h-8 items-center gap-2 rounded-lg border px-2.5 py-1 text-xs text-gray-400 ${className}`,
    title: "حجم العناصر",
    children: [
      jsx(Scaling, { className: "h-3.5 w-3.5 shrink-0 text-gray-500" }),
      jsx("input", {
        type: "range",
        min: 0,
        max: ARCHIVE_ITEM_SIZE_OPTIONS.length - 1,
        step: 1,
        value: idx,
        onChange: (event) => onChange?.(ARCHIVE_ITEM_SIZE_OPTIONS[Number(event.target.value)]?.value || "comfortable"),
        "aria-label": "حجم العناصر",
        className: "va-range w-16 sm:w-24"
      }),
      jsx("span", { className: "min-w-[2.5rem] shrink-0 text-center font-semibold text-gray-200", children: ARCHIVE_ITEM_SIZE_OPTIONS[idx]?.label || "متوسط" })
    ]
  });
}

/**
 * Windows-Explorer-style density slider for grid/tiles: drag to set how many
 * items sit per row (2 = large cards, 8 = small/dense). Writes an explicit
 * column count via `onChange`; page size follows (rows × columns).
 */
export function GridDensitySlider({ gridColumns, gridColumnCount, onChange, className = "" }) {
  const current = gridColumns === "auto" ? (gridColumnCount || 3) : (Number(gridColumns) || 3);
  const value = Math.min(8, Math.max(2, current));
  return jsxs("label", {
    className: `va-surface-muted inline-flex min-h-8 items-center gap-2 rounded-lg border px-2.5 py-1 text-xs text-gray-400 ${className}`,
    title: "اسحب للتحكم بحجم العناصر وعددها في الصف",
    children: [
      jsx(LayoutGrid, { className: "h-3.5 w-3.5 shrink-0 text-gray-500" }),
      jsx("input", {
        type: "range",
        min: 2,
        max: 8,
        step: 1,
        value,
        onChange: (event) => onChange?.(Number(event.target.value)),
        "aria-label": "حجم عناصر الشبكة وعددها في الصف",
        className: "va-range w-20 sm:w-28"
      }),
      jsx("span", { className: "min-w-[3rem] shrink-0 text-center font-semibold text-gray-200", children: `${formatNumber(value)} بالصف` })
    ]
  });
}

const REVIEW_STATUS_CLASS = {
  "يحتاج مراجعة": "border-amber-500/25 bg-amber-500/10 text-amber-200",
  "قيد المراجعة": "border-blue-500/25 bg-blue-500/10 text-blue-200",
  "معتمد": "va-accent-border va-accent-bg-soft va-accent-text-on-soft border bg-transparent"
};

const PREVIEW_STATUS_LABELS = {
  [MEDIA_PREVIEW_STATUS.MISSING_PATH]: "لا يوجد مسار للمعاينة",
  [MEDIA_PREVIEW_STATUS.UNSUPPORTED_FORMAT]: "صيغة غير مدعومة داخل المتصفح",
  [MEDIA_PREVIEW_STATUS.BLOCKED_LOCAL_PATH]: "المسار المحلي محجوب من المتصفح",
  [MEDIA_PREVIEW_STATUS.TIMED_OUT]: "تعذر تحميل المعاينة"
};

function ItemBadges({ item, compact = false, completeness = null }) {
  const reviewStatus = item.metadata?.reviewStatus;
  const rating = Number(item.metadata?.rating) || 0;
  const statusClass = reviewStatus ? REVIEW_STATUS_CLASS[reviewStatus] : null;
  const tier = completeness ? COMPLETENESS_TIERS[completeness.tier] : null;
  if (!statusClass && rating === 0 && !tier) return null;
  return jsxs("div", {
    className: "flex flex-wrap items-center gap-1",
    children: [
      tier && jsxs("span", {
        className: "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
        style: { borderColor: `${tier.color}55`, color: tier.color },
        title: completeness.missing.length ? `ينقص: ${completeness.missing.join("، ")}` : "توصيف مكتمل",
        children: [
          jsx("span", { "aria-hidden": "true", style: { width: "6px", height: "6px", borderRadius: "9999px", background: tier.color, display: "inline-block" } }),
          `${completeness.percent}%`
        ]
      }),
      statusClass && jsx("span", {
        className: `va-chip rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusClass}`,
        children: reviewStatus
      }),
      rating > 0 && jsx("span", {
        className: `text-amber-400 ${compact ? "text-[10px]" : "text-xs"}`,
        "aria-label": `تقييم ${rating} من 5`,
        children: "★".repeat(rating) + "☆".repeat(5 - rating)
      })
    ]
  });
}

function BulkCheckbox({ checked, onToggle, label }) {
  return jsx("button", {
    type: "button",
    role: "checkbox",
    "aria-checked": checked,
    "aria-label": label || (checked ? "إلغاء التحديد" : "تحديد"),
    onClick: (event) => {
      event.stopPropagation();
      event.preventDefault();
      onToggle?.(event);
    },
    className: `inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${checked
      ? "border-[color-mix(in_srgb,var(--va-action)_60%,transparent)] bg-[color-mix(in_srgb,var(--va-action)_25%,transparent)] text-white"
      : "border-white/20 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08]"}`,
    children: checked ? jsx(Check, { className: "h-3.5 w-3.5" }) : jsx(Square, { className: "h-3.5 w-3.5 opacity-40" })
  });
}

export const ARCHIVE_ITEM_SIZE_OPTIONS = [
  { value: "xs", label: "فحص سريع" },
  { value: "compact", label: "صغير" },
  { value: "comfortable", label: "متوسط" },
  { value: "large", label: "كبير" },
  { value: "xl", label: "أكبر" }
];

export const ARCHIVE_PAGE_SIZE_OPTIONS = [12, 24, 48, 96];

/**
 * Default grid classes used when "auto" columns is chosen (responsive
 * fallback). When an explicit `gridColumns` value is provided, the
 * container instead receives an inline `grid-template-columns` style.
 */
export const ARCHIVE_GRID_CLASSES = {
  xs: "grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8",
  compact: "grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
  comfortable: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4",
  large: "grid gap-4 lg:grid-cols-2 2xl:grid-cols-3",
  xl: "grid gap-4 lg:grid-cols-2"
};

export function getGridStyleForColumns(gridColumns) {
  if (gridColumns === "auto" || gridColumns == null) return undefined;
  const cols = Number(gridColumns);
  if (!Number.isFinite(cols) || cols < 1) return undefined;
  return { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };
}

const ARCHIVE_CARD_SIZE = {
  xs: {
    body: "space-y-1 p-1.5",
    footer: "gap-1 p-1.5",
    title: "line-clamp-2 text-[11px] leading-tight",
    meta: "text-[10px]",
    button: "min-h-6 px-1.5 py-0.5 text-[10px]",
    tags: 1
  },
  compact: {
    body: "space-y-1.5 p-2.5",
    footer: "gap-1.5 p-2",
    title: "line-clamp-2 text-xs",
    meta: "text-[11px]",
    button: "min-h-7 px-2 py-0.5 text-[11px]",
    tags: 2
  },
  comfortable: {
    body: "space-y-3 p-4",
    footer: "gap-2 p-3",
    title: "line-clamp-2 text-sm",
    meta: "text-xs",
    button: "min-h-9 px-3 py-1.5 text-sm",
    tags: 3
  },
  large: {
    body: "space-y-4 p-5",
    footer: "gap-2.5 p-4",
    title: "line-clamp-2 text-base",
    meta: "text-sm",
    button: "min-h-10 px-4 py-2 text-sm",
    tags: 6
  },
  xl: {
    body: "space-y-4 p-6",
    footer: "gap-3 p-5",
    title: "line-clamp-2 text-lg leading-snug",
    meta: "text-sm",
    button: "min-h-10 px-4 py-2 text-sm",
    tags: 8
  }
};

const ARCHIVE_LIST_SIZE = {
  xs: {
    article: "gap-2 p-2 sm:grid-cols-[100px_minmax(0,1fr)_auto]",
    title: "text-[13px]",
    meta: "text-[11px]",
    notes: "mt-1 line-clamp-1 text-[11px] leading-relaxed",
    tags: 2,
    actionColumn: "sm:w-24",
    actionButton: "min-h-7 px-2 py-0.5 text-[11px]"
  },
  compact: {
    article: "gap-2 p-2.5 sm:grid-cols-[132px_minmax(0,1fr)_auto]",
    title: "text-sm",
    meta: "text-xs",
    notes: "mt-1 line-clamp-1 text-xs leading-relaxed",
    tags: 3,
    actionColumn: "sm:w-28",
    actionButton: "min-h-8 px-2.5 py-1 text-xs"
  },
  comfortable: {
    article: "gap-3 p-3 sm:grid-cols-[180px_minmax(0,1fr)_auto]",
    title: "text-base",
    meta: "text-sm",
    notes: "mt-2 line-clamp-2 text-sm leading-relaxed",
    tags: 6,
    actionColumn: "sm:w-32",
    actionButton: "min-h-9 px-3 py-1.5 text-sm"
  },
  large: {
    article: "gap-4 p-4 sm:grid-cols-[220px_minmax(0,1fr)_auto]",
    title: "text-lg",
    meta: "text-sm",
    notes: "mt-3 line-clamp-3 text-sm leading-relaxed",
    tags: 8,
    actionColumn: "sm:w-36",
    actionButton: "min-h-10 px-4 py-2 text-sm"
  },
  xl: {
    article: "gap-5 p-5 sm:grid-cols-[260px_minmax(0,1fr)_auto]",
    title: "text-xl",
    meta: "text-sm",
    notes: "mt-3 line-clamp-4 text-sm leading-relaxed",
    tags: 10,
    actionColumn: "sm:w-40",
    actionButton: "min-h-10 px-4 py-2 text-sm"
  }
};

const ARCHIVE_TABLE_SIZE = {
  xs: { table: "min-w-[760px]", cell: "px-2 py-1.5", actionButton: "px-2 py-0.5 text-[10px]", tags: 2 },
  compact: { table: "min-w-[860px]", cell: "px-3 py-2", actionButton: "px-2.5 py-1 text-[11px]", tags: 3 },
  comfortable: { table: "min-w-[940px]", cell: "px-4 py-3", actionButton: "px-3 py-1.5 text-xs", tags: 4 },
  large: { table: "min-w-[1040px]", cell: "px-5 py-4", actionButton: "px-4 py-2 text-sm", tags: 6 },
  xl: { table: "min-w-[1160px]", cell: "px-6 py-5", actionButton: "px-4 py-2 text-sm", tags: 8 }
};

export const ARCHIVE_ITEM_SIZE_LABELS = {
  xs: "فحص سريع",
  compact: "صغير",
  comfortable: "متوسط",
  large: "كبير",
  xl: "أكبر"
};

function getArchivePaginationSlots(currentPage, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const slots = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) slots.push("start-ellipsis");
  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    slots.push(pageNumber);
  }
  if (end < totalPages - 1) slots.push("end-ellipsis");
  slots.push(totalPages);

  return slots;
}

export function ToolbarButton({ children, onClick, active = false, danger = false, icon }) {
  return jsxs("button", {
    type: "button",
    onClick,
    "aria-pressed": active,
    className: `va-tool-button inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors ${
      active
        ? danger
          ? "border-red-500/35 bg-red-500/15 text-red-100"
          : "va-accent-border va-accent-bg-soft va-accent-text-on-soft border"
        : "border-white/10 bg-gray-950/35 text-gray-400 hover:bg-white/5 hover:text-white"
    }`,
    children: [
      icon,
      children
    ]
  });
}

export function ArchiveMetric({ label, value, hint }) {
  return jsxs("div", {
    className: "va-metric-card rounded-xl va-surface-muted border p-2.5",
    children: [
      jsx("p", { className: "text-xs text-gray-500", children: label }),
      jsx("p", { className: "mt-1 text-base font-bold text-white", children: value }),
      hint && jsx("p", { className: "mt-1 text-xs text-gray-500", children: hint })
    ]
  });
}

export function ArchivePagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pageSlots = getArchivePaginationSlots(currentPage, totalPages);
  const buttonBase = "inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors";

  return jsxs("nav", {
    className: "va-control-surface flex flex-wrap items-center justify-between gap-3 va-surface-muted rounded-2xl border p-3",
    dir: "rtl",
    "aria-label": "صفحات الأرشيف",
    children: [
      jsxs("button", {
        type: "button",
        onClick: () => onPageChange(currentPage - 1),
        disabled: currentPage <= 1,
        "aria-label": "الصفحة السابقة",
        className: `${buttonBase} border-white/10 text-gray-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40`,
        children: [jsx(ChevronRight, { className: "h-4 w-4" }), "السابق"]
      }),
      jsx("div", {
        className: "flex flex-wrap justify-center gap-1.5",
        children: pageSlots.map((slot) => typeof slot === "number" ? jsx("button", {
          type: "button",
          onClick: () => onPageChange(slot),
          className: `${buttonBase} ${slot === currentPage ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "border-white/10 text-gray-400 hover:bg-white/5 hover:text-white"}`,
          "aria-current": slot === currentPage ? "page" : undefined,
          "aria-label": `صفحة ${slot}`,
          children: formatNumber(slot)
        }, slot) : jsx("span", {
          className: "inline-flex min-h-9 min-w-9 items-center justify-center px-2 text-gray-600",
          "aria-hidden": "true",
          children: jsx(MoreHorizontal, { className: "h-4 w-4" })
        }, slot))
      }),
      jsxs("button", {
        type: "button",
        onClick: () => onPageChange(currentPage + 1),
        disabled: currentPage >= totalPages,
        "aria-label": "الصفحة التالية",
        className: `${buttonBase} border-white/10 text-gray-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40`,
        children: ["التالي", jsx(ChevronLeft, { className: "h-4 w-4" })]
      })
    ]
  });
}

function VideoThumb({ item }) {
  const descriptor = getMediaPreviewDescriptor(item.path || item.filePath || item.url || "", {
    runtimeProtocol: typeof window !== "undefined" ? window.location.protocol : ""
  });
  if (descriptor.status === MEDIA_PREVIEW_STATUS.PLAYABLE && descriptor.source) {
    return jsx("video", {
      className: "h-full w-full object-cover",
      src: descriptor.source,
      preload: "metadata",
      muted: true,
      playsInline: true
    });
  }

  return jsxs("div", {
    className: "va-thumb-placeholder flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-950 text-gray-500",
    children: [
      jsx(Video, { className: "h-9 w-9" }),
      jsx("span", { className: "mt-2 max-w-[75%] truncate text-xs", dir: "auto", children: item.title || "بدون عنوان" })
    ]
  });
}

function getArchiveFileMeta(item = {}) {
  const localFile = normalizeLocalFileValue(item.metadata?.localFile || item.localFile);
  const path = localFile?.relativePath || localFile?.path || item.path || item.filePath || item.url || "";
  const name = localFile?.name || String(path || "").split(/[\\/]/).pop() || "";
  const extension = localFile?.extension || (name.includes(".") ? name.split(".").pop()?.toLowerCase() || "" : "");
  return {
    localFile,
    path,
    name,
    extension,
    size: Number(localFile?.size || 0)
  };
}

function FileMetaStrip({ item, compact = false }) {
  const file = getArchiveFileMeta(item);
  if (!file.name && !file.path) return null;

  return jsxs("div", {
    className: `rounded-xl va-surface-muted border ${compact ? "px-2.5 py-2" : "px-3 py-2"}`,
    children: [
      jsxs("div", {
        className: "flex items-center gap-2 text-xs text-gray-400",
        children: [
          jsx(HardDrive, { className: "h-3.5 w-3.5 shrink-0 va-accent-text" }),
          jsx("span", { className: "min-w-0 truncate font-medium text-gray-300", dir: "auto", children: file.name || "ملف محلي" }),
          file.extension && jsx("span", { className: "rounded-full border va-accent-border va-accent-bg-soft px-1.5 py-0.5 text-[10px] uppercase va-accent-text-on-soft", children: file.extension })
        ]
      }),
      file.size > 0 && jsx("p", { className: "mt-1 text-[11px] text-gray-600", children: formatFileSize(file.size) }),
      file.path && !compact && jsx("p", { className: "mt-1 truncate text-left text-[11px] text-gray-600", dir: "ltr", children: file.path })
    ]
  });
}

export function SegmentedControl({ label, value, options, onChange }) {
  return jsxs("div", {
    className: "flex flex-wrap items-center gap-2",
    children: [
      label && jsx("span", { className: "text-xs text-gray-500", children: label }),
      jsx("div", {
        className: "va-control-surface inline-flex min-h-9 overflow-hidden va-surface-muted rounded-xl border p-1",
        role: "group",
        "aria-label": label,
        children: options.map((option) => jsxs("button", {
          type: "button",
          onClick: () => onChange(option.value),
          "aria-pressed": value === option.value,
          className: `inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-colors ${value === option.value ? "va-accent-bg-soft va-accent-text-on-soft" : "text-gray-400 hover:bg-white/5 hover:text-white"}`,
          children: [option.icon, option.label]
        }, option.value))
      })
    ]
  });
}

export function VideoCard({ item, typeLabel, subtypeLabel, selected, onPreview, onOpen, onFavorite, onDelete, onRestore, showDeleted, itemSize = "comfortable", bulkMode = false, bulkSelected = false, onBulkToggle, onContextMenu, completeness = null }) {
  const size = ARCHIVE_CARD_SIZE[itemSize] || ARCHIVE_CARD_SIZE.comfortable;
  const highlight = bulkMode ? bulkSelected : selected;
  const handleCardClick = bulkMode ? () => onBulkToggle?.() : onPreview;
  return jsxs("article", {
    onContextMenu,
    "data-item-size": itemSize,
    className: `va-video-card va-virtual-grid-cell h-full ${highlight ? "va-video-card-selected" : ""} group relative overflow-hidden rounded-2xl border bg-gray-900/45 text-right transition-colors ${
      highlight ? "border-[color-mix(in_srgb,var(--va-action)_55%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--va-action)_30%,transparent)]" : "border-white/10 hover:border-[color-mix(in_srgb,var(--va-action)_30%,transparent)]"
    }`,
    dir: "rtl",
    children: [
      bulkMode && jsx("div", {
        className: "absolute right-2 top-2 z-10",
        children: jsx(BulkCheckbox, { checked: bulkSelected, onToggle: onBulkToggle, label: `تحديد ${item.title || "فيديو"}` })
      }),
      jsxs("button", {
        type: "button",
        onClick: handleCardClick,
        className: "va-archive-card-main block w-full text-right",
        children: [
          jsx("div", { className: "aspect-video overflow-hidden border-b border-white/5 bg-gray-950", children: jsx(VideoThumb, { item }) }),
          jsxs("div", {
            className: `va-archive-card-body ${size.body}`,
            children: [
              jsxs("div", {
                className: "flex items-start justify-between gap-3",
                children: [
                  jsxs("div", {
                    className: "min-w-0",
                    children: [
                      jsx("h3", { className: `${size.title} font-bold leading-relaxed text-white`, children: item.title || "بدون عنوان" }),
                      jsx("p", { className: `mt-1 truncate ${size.meta} text-gray-500`, children: [typeLabel, subtypeLabel].filter(Boolean).join(" / ") || "غير مصنف" })
                    ]
                  }),
                  item.isFavorite && jsx("span", { className: "rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200", children: "مفضلة" })
                ]
              }),
              jsx(ItemBadges, { item, compact: itemSize === "xs" || itemSize === "compact", completeness }),
              item.tags?.length > 0 && jsxs("div", {
                className: "flex flex-wrap gap-1.5",
                children: item.tags.slice(0, size.tags).map((tag) => jsx("span", {
                  className: "va-chip rounded-full border border-white/5 bg-gray-950/45 px-2 py-0.5 text-xs text-gray-400",
                  children: tag
                }, tag))
              }),
              jsx(FileMetaStrip, { item, compact: itemSize === "compact" }),
              jsx("p", { className: `${size.meta} text-gray-600`, children: item.updatedAt ? formatDateTime(item.updatedAt) : "لم يسجل تحديث" })
            ]
          })
        ]
      }),
      jsxs("div", {
        className: `va-archive-card-footer flex items-center gap-1.5 border-t border-white/5 ${size.footer}`,
        children: [
          jsx("button", {
            type: "button",
            onClick: onOpen,
            className: `va-primary-button ${size.button} flex-1 rounded-lg font-semibold text-white`,
            children: "فتح التفاصيل"
          }),
          !showDeleted && jsx("button", {
            type: "button",
            onClick: onFavorite,
            title: item.isFavorite ? "إزالة من المفضلة" : "إضافة للمفضلة",
            "aria-label": item.isFavorite ? "إزالة من المفضلة" : "إضافة للمفضلة",
            "aria-pressed": !!item.isFavorite,
            className: `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${item.isFavorite ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-white/10 text-gray-400 hover:bg-white/5"}`,
            children: jsx(Star, { className: "h-4 w-4", fill: item.isFavorite ? "currentColor" : "none" })
          }),
          showDeleted ? jsx("button", {
            type: "button",
            onClick: onRestore,
            title: "استعادة",
            "aria-label": "استعادة",
            className: "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border va-accent-border va-accent-text-on-soft hover:opacity-80",
            children: jsx(RotateCcw, { className: "h-4 w-4" })
          }) : jsx("button", {
            type: "button",
            onClick: onDelete,
            title: "حذف",
            "aria-label": "حذف",
            className: "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-500/20 text-red-200 hover:bg-red-500/10",
            children: jsx(Trash2, { className: "h-4 w-4" })
          })
        ]
      })
    ]
  });
}

export function AnimatedItem({ index, children, as = "div", className = "", itemId, disableMotion = false }) {
  const shouldDisableMotion = disableMotion || index >= 24;
  const Component = shouldDisableMotion ? as : motion[as] || motion.div;
  const motionProps = shouldDisableMotion ? {} : {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, delay: Math.min(index, 10) * 0.025 }
  };
  return jsx(Component, {
    ...motionProps,
    className,
    "data-archive-item-id": itemId,
    children
  });
}

/**
 * VideoTileItem — Windows-Explorer-style horizontal tile.
 *
 * Sits between the grid view (small icon-tile cards) and the list
 * view (full row with notes). A compact thumbnail on one side, the
 * key metadata stack on the other, and a single primary action.
 * Ideal for quick visual browsing without giving up titles or tags.
 */
export function VideoTileItem({ item, typeLabel, subtypeLabel, selected, onPreview, onOpen, onFavorite, onDelete, onRestore, showDeleted, itemSize = "comfortable", bulkMode = false, bulkSelected = false, onBulkToggle, onContextMenu, completeness = null }) {
  const highlight = bulkMode ? bulkSelected : selected;
  const handlePreview = bulkMode ? () => onBulkToggle?.() : onPreview;
  const tagLimit = itemSize === "xs" ? 1 : itemSize === "compact" ? 2 : itemSize === "comfortable" ? 3 : 4;
  const thumbWidth = itemSize === "xs" ? "w-20" : itemSize === "compact" ? "w-24" : itemSize === "large" || itemSize === "xl" ? "w-36" : "w-28";

  return jsxs("article", {
    onContextMenu,
    "data-item-size": itemSize,
    className: `va-video-list-item va-video-tile va-virtual-tile-row h-full ${highlight ? "va-video-list-item-selected" : ""} group relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border bg-gray-900/45 p-2 text-right transition-colors ${
      highlight ? "border-[color-mix(in_srgb,var(--va-action)_55%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--va-action)_30%,transparent)]" : "border-white/10 hover:border-[color-mix(in_srgb,var(--va-action)_30%,transparent)]"
    }`,
    dir: "rtl",
    children: [
      bulkMode && jsx("div", {
        className: "absolute right-2 top-2 z-10",
        children: jsx(BulkCheckbox, { checked: bulkSelected, onToggle: onBulkToggle, label: `تحديد ${item.title || "فيديو"}` })
      }),
      jsx("button", {
        type: "button",
        onClick: handlePreview,
        className: `overflow-hidden rounded-lg border border-white/10 bg-gray-950 ${thumbWidth} shrink-0`,
        "aria-label": `معاينة ${item.title || "الفيديو"}`,
        children: jsx("div", { className: "aspect-video", children: jsx(VideoThumb, { item }) })
      }),
      jsxs("button", {
        type: "button",
        onClick: handlePreview,
        className: "min-w-0 text-right",
        children: [
          jsxs("div", {
            className: "flex flex-wrap items-center gap-1.5",
            children: [
              jsx("h3", { className: "line-clamp-1 text-sm font-bold leading-tight text-white", children: item.title || "بدون عنوان" }),
              item.isFavorite && jsx("span", { className: "rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-200", children: "★" })
            ]
          }),
          jsx("p", { className: "mt-0.5 line-clamp-1 text-[11px] text-gray-500", children: [typeLabel, subtypeLabel].filter(Boolean).join(" / ") || "غير مصنف" }),
          jsx(ItemBadges, { item, compact: true, completeness }),
          item.tags?.length > 0 && jsx("div", {
            className: "mt-1 flex flex-wrap gap-1",
            children: item.tags.slice(0, tagLimit).map((tag) => jsx("span", {
              className: "va-chip rounded-full border border-white/5 bg-gray-950/45 px-1.5 py-0 text-[10px] text-gray-400",
              children: tag
            }, tag))
          })
        ]
      }),
      jsxs("div", {
        className: "flex shrink-0 items-center gap-1",
        children: [
          jsx("button", {
            type: "button",
            onClick: onOpen,
            "aria-label": `فتح ${item.title || "الفيديو"}`,
            className: "va-primary-button rounded-md px-2.5 py-1 text-[11px] font-semibold text-white",
            children: "فتح"
          }),
          !showDeleted && jsx("button", {
            type: "button",
            onClick: onFavorite,
            "aria-label": item.isFavorite ? `إزالة من المفضلة` : `إضافة للمفضلة`,
            className: "rounded-md border border-white/10 px-2 py-1 text-[11px] text-gray-300 hover:bg-white/5",
            children: item.isFavorite ? "✦" : "☆"
          }),
          showDeleted ? jsx("button", {
            type: "button",
            onClick: onRestore,
            "aria-label": `استعادة`,
            className: "rounded-md border va-accent-border px-2 py-1 text-[11px] va-accent-text-on-soft hover:opacity-80",
            children: jsx(RotateCcw, { className: "h-3 w-3" })
          }) : jsx("button", {
            type: "button",
            onClick: onDelete,
            "aria-label": `حذف`,
            className: "rounded-md border border-red-500/20 px-2 py-1 text-[11px] text-red-100 hover:bg-red-500/10",
            children: jsx(Trash2, { className: "h-3 w-3" })
          })
        ]
      })
    ]
  });
}

export function VideoListItem({ item, typeLabel, subtypeLabel, selected, onPreview, onOpen, onFavorite, onDelete, onRestore, showDeleted, itemSize = "comfortable", bulkMode = false, bulkSelected = false, onBulkToggle, onContextMenu, completeness = null }) {
  const size = ARCHIVE_LIST_SIZE[itemSize] || ARCHIVE_LIST_SIZE.comfortable;
  const highlight = bulkMode ? bulkSelected : selected;
  const handlePreview = bulkMode ? () => onBulkToggle?.() : onPreview;

  return jsxs("article", {
    onContextMenu,
    className: `va-video-list-item va-virtual-list-row ${highlight ? "va-video-list-item-selected" : ""} group relative grid rounded-2xl border bg-gray-900/45 text-right transition-colors ${size.article} ${
      highlight ? "border-[color-mix(in_srgb,var(--va-action)_55%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--va-action)_30%,transparent)]" : "border-white/10 hover:border-[color-mix(in_srgb,var(--va-action)_30%,transparent)]"
    }`,
    dir: "rtl",
    children: [
      bulkMode && jsx("div", {
        className: "absolute right-3 top-3 z-10",
        children: jsx(BulkCheckbox, { checked: bulkSelected, onToggle: onBulkToggle, label: `تحديد ${item.title || "فيديو"}` })
      }),
      jsx("button", {
        type: "button",
        onClick: handlePreview,
        className: "overflow-hidden rounded-xl border border-white/10 bg-gray-950 text-right",
        children: jsx("div", { className: "aspect-video", children: jsx(VideoThumb, { item }) })
      }),
      jsxs("button", {
        type: "button",
        onClick: handlePreview,
        className: "min-w-0 text-right",
        children: [
          jsxs("div", {
            className: "flex flex-wrap items-center gap-2",
            children: [
              jsx("h3", { className: `line-clamp-2 ${size.title} font-bold leading-relaxed text-white`, children: item.title || "بدون عنوان" }),
              item.isFavorite && jsx("span", { className: "rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200", children: "مفضلة" })
            ]
          }),
          jsx("p", { className: `mt-1 ${size.meta} text-gray-500`, children: [typeLabel, subtypeLabel].filter(Boolean).join(" / ") || "غير مصنف" }),
          item.notes && jsx("p", { className: `${size.notes} text-gray-400`, children: item.notes }),
          jsx("div", { className: "mt-2", children: jsx(ItemBadges, { item, completeness }) }),
          item.tags?.length > 0 && jsx("div", {
            className: "mt-2 flex flex-wrap gap-1.5",
            children: item.tags.slice(0, size.tags).map((tag) => jsx("span", {
              className: "va-chip rounded-full border border-white/5 bg-gray-950/45 px-2 py-0.5 text-xs text-gray-400",
              children: tag
            }, tag))
          }),
          jsx("div", { className: "mt-3", children: jsx(FileMetaStrip, { item, compact: itemSize === "compact" }) }),
          jsx("p", { className: "mt-3 text-xs text-gray-600", children: item.updatedAt ? formatDateTime(item.updatedAt) : "لم يسجل تحديث" })
        ]
      }),
      jsxs("div", {
        className: `flex flex-wrap items-center gap-2 sm:flex-col sm:items-stretch ${size.actionColumn}`,
        children: [
          jsx("button", {
            type: "button",
            onClick: onOpen,
            className: `va-primary-button ${size.actionButton} rounded-lg font-semibold text-white `,
            children: "التفاصيل"
          }),
          !showDeleted && jsx("button", {
            type: "button",
            onClick: onFavorite,
            className: `${size.actionButton} rounded-lg border border-white/10 text-gray-300 hover:bg-white/5`,
            children: item.isFavorite ? "إزالة" : "مفضلة"
          }),
          showDeleted ? jsx("button", {
            type: "button",
            onClick: onRestore,
            className: `${size.actionButton} rounded-lg border va-accent-border va-accent-text-on-soft hover:opacity-80`,
            children: "استعادة"
          }) : jsx("button", {
            type: "button",
            onClick: onDelete,
            className: `${size.actionButton} rounded-lg border border-red-500/20 text-red-100 hover:bg-red-500/10`,
            children: "حذف"
          })
        ]
      })
    ]
  });
}

const DEFAULT_TABLE_COLUMNS = [
  { id: "title", visible: true, width: 280 },
  { id: "type", visible: true, width: 160 },
  { id: "file", visible: true, width: 200 },
  { id: "tags", visible: true, width: 180 },
  { id: "updated", visible: true, width: 160 },
  { id: "actions", visible: true, width: 180 }
];

const COLUMN_LABELS = {
  title: "العنوان",
  type: "النوع",
  file: "الملف",
  tags: "الوسوم",
  size: "الحجم",
  created: "تاريخ الإنشاء",
  updated: "آخر تحديث",
  viewed: "آخر مشاهدة",
  actions: "إجراءات"
};

function getFileSizeForItem(item) {
  const file = normalizeLocalFileValue(item?.localFile);
  return file?.size > 0 ? formatFileSize(file.size) : null;
}

function renderTableCell({ column, item, size, showDeleted, bulkMode, onPreview, onOpen, onFavorite, onDelete, onRestore, onBulkToggle, typeLabel, subtypeLabel, typeOptions, editingCell, onStartCellEdit, onCommitCellEdit, onCancelCellEdit }) {
  const isEditingCell = (columnId) => editingCell?.itemId === item.id && editingCell?.columnId === columnId;
  const canInlineEdit = !showDeleted && !bulkMode && typeof onStartCellEdit === "function";
  switch (column.id) {
    case "title": {
      if (isEditingCell("title")) {
        return jsx("td", {
          className: size.cell,
          style: { minWidth: column.width },
          children: jsx(InlineCellEditor, {
            value: item.title || "",
            fieldType: "text",
            isEditing: true,
            placeholder: "عنوان المادة",
            onSave: (next) => {
              const trimmed = String(next || "").trim();
              if (!trimmed || trimmed === item.title) {
                onCancelCellEdit?.();
                return;
              }
              onCommitCellEdit?.(item, { title: trimmed });
            },
            onCancel: onCancelCellEdit
          })
        }, column.id);
      }
      return jsxs("td", {
        className: size.cell,
        style: { minWidth: column.width },
        children: [
          jsxs("div", {
            className: "group/cell flex items-start gap-1.5",
            onDoubleClick: canInlineEdit ? () => onStartCellEdit(item.id, "title") : undefined,
            children: [
              jsx("button", {
                type: "button",
                onClick: () => bulkMode ? onBulkToggle?.(item.id) : onPreview(item),
                className: "min-w-0 flex-1 line-clamp-2 text-right font-semibold leading-relaxed text-white hover:text-[color-mix(in_srgb,var(--va-action)_70%,#ffffff)]",
                children: item.title || "بدون عنوان"
              }),
              canInlineEdit && jsx("button", {
                type: "button",
                onClick: () => onStartCellEdit(item.id, "title"),
                "aria-label": `تحرير عنوان ${item.title || "المادة"}`,
                title: "تحرير العنوان",
                className: "shrink-0 rounded p-0.5 text-gray-600 opacity-0 transition-opacity hover:text-white focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--va-action)]/40 group-hover/cell:opacity-100",
                children: jsx(PenLine, { className: "h-3.5 w-3.5", "aria-hidden": "true" })
              })
            ]
          }),
          item.isFavorite && jsx("span", { className: "mt-1 inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200", children: "مفضلة" })
        ]
      }, column.id);
    }
    case "type": {
      if (isEditingCell("type")) {
        return jsx("td", {
          className: size.cell,
          style: { minWidth: column.width },
          children: jsx(InlineCellEditor, {
            value: item.type || "",
            fieldType: "select",
            options: typeOptions || [],
            isEditing: true,
            placeholder: "اختر النوع",
            onSave: (nextValue) => {
              if (!nextValue) {
                onCancelCellEdit?.();
                return;
              }
              if (nextValue === item.type) {
                onCancelCellEdit?.();
                return;
              }
              onCommitCellEdit?.(item, { type: nextValue, subtype: "" });
            },
            onCancel: onCancelCellEdit
          })
        }, column.id);
      }
      return jsx("td", {
        className: `${size.cell} text-gray-400`,
        style: { minWidth: column.width },
        children: jsxs("div", {
          className: "group/cell flex items-center gap-1.5",
          onDoubleClick: canInlineEdit && typeOptions?.length ? () => onStartCellEdit(item.id, "type") : undefined,
          children: [
            jsx("span", {
              className: "min-w-0 flex-1",
              children: [typeLabel(item), subtypeLabel(item)].filter(Boolean).join(" / ") || "غير مصنف"
            }),
            canInlineEdit && typeOptions?.length > 0 && jsx("button", {
              type: "button",
              onClick: () => onStartCellEdit(item.id, "type"),
              "aria-label": `تحرير نوع ${item.title || "المادة"}`,
              title: "تحرير النوع",
              className: "shrink-0 rounded p-0.5 text-gray-600 opacity-0 transition-opacity hover:text-white focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--va-action)]/40 group-hover/cell:opacity-100",
              children: jsx(PenLine, { className: "h-3.5 w-3.5", "aria-hidden": "true" })
            })
          ]
        })
      }, column.id);
    }
    case "file":
      return jsx("td", { className: size.cell, style: { minWidth: column.width }, children: jsx(FileMetaStrip, { item, compact: true }) }, column.id);
    case "tags": {
      if (isEditingCell("tags")) {
        return jsx("td", {
          className: size.cell,
          style: { minWidth: column.width },
          children: jsx(InlineCellEditor, {
            value: item.tags || [],
            fieldType: "tags",
            isEditing: true,
            placeholder: "وسوم مفصولة بفواصل",
            onSave: (nextTags) => {
              const current = item.tags || [];
              const unchanged = nextTags.length === current.length && nextTags.every((tag, index) => tag === current[index]);
              if (unchanged) {
                onCancelCellEdit?.();
                return;
              }
              onCommitCellEdit?.(item, { tags: nextTags });
            },
            onCancel: onCancelCellEdit
          })
        }, column.id);
      }
      return jsx("td", {
        className: size.cell,
        style: { minWidth: column.width },
        children: jsxs("div", {
          className: "group/cell flex items-start gap-1.5",
          onDoubleClick: canInlineEdit ? () => onStartCellEdit(item.id, "tags") : undefined,
          children: [
            item.tags?.length ? jsx("div", {
              className: "min-w-0 flex-1 flex flex-wrap gap-1.5",
              children: item.tags.slice(0, size.tags).map((tag) => jsx("span", {
                className: "va-chip rounded-full border border-white/5 bg-gray-950/45 px-2 py-0.5 text-xs text-gray-400",
                children: tag
              }, tag))
            }) : jsx("span", { className: "min-w-0 flex-1 text-gray-600", children: "—" }),
            canInlineEdit && jsx("button", {
              type: "button",
              onClick: () => onStartCellEdit(item.id, "tags"),
              "aria-label": `تحرير وسوم ${item.title || "المادة"}`,
              title: "تحرير الوسوم",
              className: "shrink-0 rounded p-0.5 text-gray-600 opacity-0 transition-opacity hover:text-white focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--va-action)]/40 group-hover/cell:opacity-100",
              children: jsx(PenLine, { className: "h-3.5 w-3.5", "aria-hidden": "true" })
            })
          ]
        })
      }, column.id);
    }
    case "size": {
      const fileSize = getFileSizeForItem(item);
      return jsx("td", { className: `${size.cell} text-xs text-gray-500`, style: { minWidth: column.width }, children: fileSize || "—" }, column.id);
    }
    case "created":
      return jsx("td", { className: `${size.cell} text-xs text-gray-500`, style: { minWidth: column.width }, children: item.createdAt ? formatDateTime(item.createdAt) : "—" }, column.id);
    case "updated":
      return jsx("td", { className: `${size.cell} text-xs text-gray-500`, style: { minWidth: column.width }, children: item.updatedAt ? formatDateTime(item.updatedAt) : "—" }, column.id);
    case "viewed":
      return jsx("td", { className: `${size.cell} text-xs text-gray-500`, style: { minWidth: column.width }, children: item.lastViewedAt ? formatDateTime(item.lastViewedAt) : "—" }, column.id);
    case "actions":
      return jsx("td", {
        className: size.cell,
        style: { minWidth: column.width },
        children: jsxs("div", {
          className: "flex flex-wrap gap-2",
          children: [
            jsx("button", { type: "button", onClick: () => onOpen(item), className: `va-primary-button rounded-lg font-semibold text-white  ${size.actionButton}`, children: "فتح" }),
            !showDeleted && jsx("button", { type: "button", onClick: () => onFavorite(item), className: `rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 ${size.actionButton}`, children: item.isFavorite ? "إزالة" : "مفضلة" }),
            showDeleted ? jsx("button", { type: "button", onClick: () => onRestore(item), className: `rounded-lg border va-accent-border va-accent-text-on-soft hover:opacity-80 ${size.actionButton}`, children: "استعادة" }) : jsx("button", { type: "button", onClick: () => onDelete(item), className: `rounded-lg border border-red-500/20 text-red-100 hover:bg-red-500/10 ${size.actionButton}`, children: "حذف" })
          ]
        })
      }, column.id);
    default:
      return null;
  }
}

function ResizableHeader({ column, label, cellClass, onResize }) {
  const [resizing, setResizing] = React.useState(false);
  const dragStateRef = React.useRef(null);

  const handleMouseDown = React.useCallback((event) => {
    if (!onResize) return;
    event.preventDefault();
    event.stopPropagation();
    setResizing(true);
    dragStateRef.current = {
      startX: event.clientX,
      startWidth: column.width || 160
    };
    const handleMove = (moveEvent) => {
      const state = dragStateRef.current;
      if (!state) return;
      // In RTL the visual leading edge moves opposite to the X delta.
      const delta = state.startX - moveEvent.clientX;
      const next = Math.max(60, state.startWidth + delta);
      onResize(column.id, Math.round(next));
    };
    const handleUp = () => {
      setResizing(false);
      dragStateRef.current = null;
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  }, [column.id, column.width, onResize]);

  return jsxs("th", {
    className: `${cellClass} relative font-medium`,
    style: { minWidth: column.width, width: column.width },
    scope: "col",
    children: [
      label,
      onResize && jsx("span", {
        className: "va-column-resize-handle",
        role: "separator",
        "aria-orientation": "vertical",
        "aria-label": `إعادة تحجيم عمود ${label}`,
        "data-resizing": resizing ? "true" : undefined,
        onMouseDown: handleMouseDown,
        onClick: (event) => event.stopPropagation()
      })
    ]
  }, column.id);
}

export function VideoTableView({ items, previewItem, typeLabel, subtypeLabel, typeOptions, showDeleted, onPreview, onOpen, onFavorite, onDelete, onRestore, itemSize = "comfortable", bulkMode = false, isSelected, onBulkToggle, allSelected, onSelectAll, columns, onColumnResize, disableRowMotion = false, onCellSave }) {
  const size = ARCHIVE_TABLE_SIZE[itemSize] || ARCHIVE_TABLE_SIZE.comfortable;
  // §13.3 inline cell editing — one cell at a time ({ itemId, columnId }).
  const [editingCell, setEditingCell] = React.useState(null);
  const handleStartCellEdit = React.useCallback((itemId, columnId) => {
    setEditingCell({ itemId, columnId });
  }, []);
  const handleCancelCellEdit = React.useCallback(() => setEditingCell(null), []);
  const handleCommitCellEdit = React.useCallback((item, patch) => {
    setEditingCell(null);
    onCellSave?.(item, patch);
  }, [onCellSave]);
  const visibleColumns = (columns && columns.length ? columns : DEFAULT_TABLE_COLUMNS).filter((column) => column.visible !== false);
  const shouldDisableRowMotion = disableRowMotion || itemSize === "xs" || items.length > 48;
  const RowComponent = shouldDisableRowMotion ? "tr" : motion.tr;

  return jsx("div", {
    className: "va-card overflow-hidden rounded-2xl va-surface-muted border",
    dir: "rtl",
    children: jsx("div", {
      className: "overflow-x-auto",
      children: jsxs("table", {
        className: `${size.table} w-full text-right text-sm`,
        children: [
          jsx("thead", {
            className: "border-b border-white/10 bg-gray-950/45 text-xs text-gray-500",
            children: jsxs("tr", {
              children: [
                bulkMode && jsx("th", {
                  className: `${size.cell} w-10 font-medium`,
                  children: jsx(BulkCheckbox, { checked: !!allSelected, onToggle: () => onSelectAll?.(), label: allSelected ? "إلغاء الكل" : "تحديد الكل" })
                }),
                ...visibleColumns.map((column) => jsx(ResizableHeader, {
                  column,
                  label: COLUMN_LABELS[column.id] || column.id,
                  cellClass: size.cell,
                  onResize: onColumnResize
                }, column.id))
              ]
            })
          }),
          jsx("tbody", {
            className: "divide-y divide-white/5",
            children: items.map((item, index) => {
              const selectedRow = bulkMode && isSelected?.(item.id);
              const motionProps = shouldDisableRowMotion ? {} : {
                initial: { opacity: 0, y: 6 },
                animate: { opacity: 1, y: 0 },
                transition: { duration: 0.16, delay: Math.min(index, 10) * 0.02 }
              };
              return jsxs(RowComponent, {
                ...motionProps,
                className: `va-virtual-table-row ${selectedRow
                  ? "bg-[color-mix(in_srgb,var(--va-action)_14%,transparent)]"
                  : previewItem?.id === item.id ? "va-accent-bg-soft" : "hover:bg-white/[0.03]"}`,
                children: [
                  bulkMode && jsx("td", {
                    className: size.cell,
                    children: jsx(BulkCheckbox, { checked: !!selectedRow, onToggle: () => onBulkToggle?.(item.id), label: `تحديد ${item.title || "فيديو"}` })
                  }),
                  ...visibleColumns.map((column) => renderTableCell({
                    column, item, size, showDeleted, bulkMode,
                    onPreview, onOpen, onFavorite, onDelete, onRestore, onBulkToggle,
                    typeLabel, subtypeLabel, typeOptions,
                    editingCell,
                    onStartCellEdit: onCellSave ? handleStartCellEdit : undefined,
                    onCommitCellEdit: handleCommitCellEdit,
                    onCancelCellEdit: handleCancelCellEdit
                  }))
                ]
              }, item.id);
            })
          })
        ]
      })
    })
  });
}

export function PreviewPanel({
  item,
  typeLabel,
  subtypeLabel,
  typeDefinition,
  collections = [],
  projects = [],
  onOpen,
  onQuickEdit,
  onQuickTag,
  onAddToCollection,
  onOpenProjects
}) {
  if (!item) {
    return jsxs("aside", {
      className: "va-preview-panel hidden rounded-2xl border border-dashed border-white/10 bg-gray-950/35 p-5 text-center text-gray-500 xl:sticky xl:top-4 xl:block",
      children: [
        jsx(Video, { className: "mx-auto h-10 w-10" }),
        jsx("p", { className: "mt-3 text-sm font-medium text-gray-300", children: "اختر بطاقة للمعاينة" }),
        jsx("p", { className: "mt-1 text-xs leading-relaxed", children: "ستظهر المعاينة والإجراءات اليومية هنا بدون مغادرة نتائج الأرشيف." })
      ]
    });
  }

  const path = item.path || item.filePath || item.url || "";
  const descriptor = getMediaPreviewDescriptor(path, {
    runtimeProtocol: typeof window !== "undefined" ? window.location.protocol : ""
  });
  const source = descriptor.status === MEDIA_PREVIEW_STATUS.PLAYABLE ? descriptor.source : null;
  const file = getArchiveFileMeta(item);
  const completeness = computeCompleteness(item, typeDefinition);
  const tier = COMPLETENESS_TIERS[completeness.tier] || COMPLETENESS_TIERS.mid;
  const lastActivity = item.lastViewedAt || item.updatedAt || item.createdAt || "";
  const availableCollections = collections.filter((collection) => !collection.itemIds?.includes(item.id));
  const projectCount = projects.filter((project) => project.status !== "archived").length;

  const actionButton = (props) => jsxs("button", {
    type: "button",
    onClick: props.onClick,
    disabled: props.disabled,
    className: `${props.primary ? "va-primary-button text-white" : "border-white/10 bg-white/[0.035] text-gray-300 hover:bg-white/[0.06] hover:text-white"} inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45`,
    children: [props.icon, props.children]
  });

  return jsxs("aside", {
    className: "va-preview-panel fixed inset-x-2 bottom-2 z-30 max-h-[82vh] overflow-y-auto rounded-2xl border border-white/10 bg-gray-900/95 p-3 text-right shadow-2xl shadow-black/45 backdrop-blur-sm xl:sticky xl:top-4 xl:z-auto xl:h-fit xl:max-h-[calc(100vh-2rem)] xl:p-4",
    dir: "rtl",
    children: [
      jsx("div", {
        className: "overflow-hidden rounded-xl border border-white/10 bg-gray-950",
        children: source ? jsx("video", {
          className: "aspect-video w-full bg-black",
          src: source,
          controls: true,
          preload: "metadata"
        }) : jsxs("div", {
          className: "flex aspect-video flex-col items-center justify-center gap-2 px-4 text-center text-gray-500",
          children: [
            jsx(Video, { className: "h-9 w-9 text-gray-600" }),
            jsx("span", { className: "text-xs leading-5", children: PREVIEW_STATUS_LABELS[descriptor.status] || "لا توجد معاينة HTML5 لهذا المسار" })
          ]
        })
      }),
      jsxs("div", {
        className: "mt-3 flex items-start justify-between gap-3",
        children: [
          jsxs("div", {
            className: "min-w-0",
            children: [
              jsx("h3", { className: "line-clamp-2 text-base font-bold leading-relaxed text-white", children: item.title || "بدون عنوان" }),
              jsx("p", { className: "mt-0.5 text-xs text-gray-500", children: [typeLabel, subtypeLabel].filter(Boolean).join(" / ") || "غير مصنف" })
            ]
          }),
          jsx("span", {
            className: "shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold",
            style: { borderColor: `${tier.color}55`, color: tier.color, background: `${tier.color}18` },
            title: completeness.missing.length ? `ينقص: ${completeness.missing.join("، ")}` : "توصيف مكتمل",
            children: `${completeness.percent}%`
          })
        ]
      }),
      jsxs("div", {
        className: "mt-3 grid gap-2 sm:grid-cols-2",
        children: [
          jsxs("div", {
            className: "rounded-xl va-surface-muted border p-3",
            children: [
              jsxs("p", { className: "flex items-center gap-1.5 text-xs font-semibold text-gray-300", children: [jsx(Gauge, { className: "h-3.5 w-3.5 va-accent-text" }), "جودة التوصيف"] }),
              jsx("div", { className: "mt-2 h-1.5 overflow-hidden rounded-full bg-white/10", children: jsx("div", { className: "h-full rounded-full", style: { width: `${completeness.percent}%`, background: tier.color } }) }),
              jsx("p", { className: "mt-2 line-clamp-2 text-[11px] leading-5 text-gray-500", children: completeness.missing.length ? `ينقص: ${completeness.missing.slice(0, 3).join("، ")}` : "الحقول الأساسية مكتملة." })
            ]
          }),
          jsxs("div", {
            className: "rounded-xl va-surface-muted border p-3",
            children: [
              jsxs("p", { className: "flex items-center gap-1.5 text-xs font-semibold text-gray-300", children: [jsx(Activity, { className: "h-3.5 w-3.5 va-accent-text" }), "آخر نشاط"] }),
              jsx("p", { className: "mt-2 text-xs text-gray-500", children: lastActivity ? formatDateTime(lastActivity) : "لا يوجد نشاط مسجل" }),
              item.isFavorite && jsxs("p", { className: "mt-1 inline-flex items-center gap-1 text-[11px] text-amber-200", children: [jsx(Star, { className: "h-3 w-3 fill-current" }), "مفضلة"] })
            ]
          })
        ]
      }),
      (file.name || file.path) && jsxs("div", {
        className: "mt-3 va-surface-muted rounded-xl border p-3",
        children: [
          jsxs("div", { className: "flex items-center gap-2 text-sm font-semibold text-gray-200", children: [jsx(HardDrive, { className: "h-4 w-4 va-accent-text" }), jsx("span", { className: "min-w-0 truncate", dir: "auto", children: file.name || "ملف محلي" })] }),
          file.size > 0 && jsx("p", { className: "mt-1 text-xs text-gray-600", children: formatFileSize(file.size) }),
          file.path && jsx("p", { className: "mt-2 break-all text-left text-xs text-gray-600", dir: "ltr", children: file.path })
        ]
      }),
      item.notes && jsx("p", { className: "mt-3 line-clamp-3 rounded-xl va-surface-muted border p-3 text-sm leading-relaxed text-gray-400", dir: "auto", children: item.notes }),
      jsxs("div", {
        className: "mt-3",
        children: [
          jsxs("p", { className: "flex items-center gap-1.5 text-xs font-semibold text-gray-500", children: [jsx(Tags, { className: "h-3.5 w-3.5" }), "وسوم مختصرة"] }),
          item.tags?.length > 0 ? jsx("div", {
            className: "mt-2 flex flex-wrap gap-1.5",
            children: item.tags.slice(0, 8).map((tag) => jsx("span", {
              className: "va-chip rounded-full border border-white/5 bg-gray-950/45 px-2 py-0.5 text-xs text-gray-400",
              children: tag
            }, tag))
          }) : jsx("p", { className: "mt-2 text-xs text-gray-600", children: "لا توجد وسوم بعد." })
        ]
      }),
      jsxs("div", {
        className: "mt-4 grid gap-2 sm:grid-cols-2",
        children: [
          actionButton({ primary: true, onClick: onOpen, icon: jsx(FolderOpen, { className: "h-3.5 w-3.5" }), children: "فتح" }),
          actionButton({ onClick: onQuickEdit || onOpen, icon: jsx(PenLine, { className: "h-3.5 w-3.5" }), children: "تعديل سريع" }),
          actionButton({ onClick: () => onQuickTag?.(item), icon: jsx(Tags, { className: "h-3.5 w-3.5" }), children: "وسم سريع" })
        ]
      }),
      jsxs("div", {
        className: "mt-2 grid gap-2 sm:grid-cols-2",
        children: [
          jsxs("label", {
            className: "relative",
            children: [
              jsx("span", { className: "sr-only", children: "إضافة إلى مجموعة" }),
              jsxs("select", {
                defaultValue: "",
                disabled: !availableCollections.length,
                onChange: (event) => {
                  const collectionId = event.target.value;
                  if (collectionId) onAddToCollection?.(item, collectionId);
                  event.target.value = "";
                },
                className: "min-h-9 w-full appearance-none rounded-xl border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs font-semibold text-gray-300 outline-none disabled:opacity-45",
                children: [
                  jsx("option", { value: "", children: availableCollections.length ? "إضافة لمجموعة" : "لا توجد مجموعة متاحة" }),
                  ...availableCollections.map((collection) => jsx("option", { value: collection.id, children: collection.name || collection.id }, collection.id))
                ]
              })
            ]
          }),
          actionButton({
            onClick: onOpenProjects,
            disabled: !projectCount,
            icon: jsx(Plus, { className: "h-3.5 w-3.5" }),
            children: projectCount ? "إضافة لمشروع" : "أنشئ مشروعاً أولاً"
          })
        ]
      })
    ]
  });
}
