import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import { EmptyState } from "../../components/common/EmptyState.jsx";
import { appPrompt } from "../../components/common/ConfirmDialog.js";
import { SkeletonBlock } from "../../components/ui/index.js";
import { formatNumber } from "../../utils/formatting.js";
import { parseVideoTags } from "../videos/viewModel.js";
import { computeCompleteness } from "./completeness.js";
import {
  ARCHIVE_GRID_CLASSES,
  ARCHIVE_ITEM_SIZE_LABELS,
  AnimatedItem,
  ArchivePagination,
  GridDensitySlider,
  ItemSizeSlider,
  PreviewPanel,
  VideoCard,
  VideoListItem,
  VideoTableView,
  VideoTileItem,
  ViewModeSwitch,
  getGridStyleForColumns
} from "./ArchiveViews.jsx";

// Skeleton placeholder that mimics the archive grid until the first
// loadAllData() resolves. Without it the UI flashed an empty-state with
// "الأرشيف فارغ" on every cold start — visually indistinguishable from a
// real empty database. Sized for grid/list view widths.
const SKELETON_CARD_COUNT = 8;

function ArchiveResultsSkeleton({ activeViewMode = "grid" }) {
  const isCompactRow = activeViewMode === "list" || activeViewMode === "table";
  const wrapperClass = isCompactRow
    ? "space-y-2"
    : "grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  return (
    <div
      className="va-card rounded-2xl border border-white/10 va-surface-muted p-4"
      role="status"
      aria-live="polite"
      aria-label="جارٍ تحميل عناصر الأرشيف"
    >
      <div className={wrapperClass}>
        {Array.from({ length: SKELETON_CARD_COUNT }).map((_, index) => (
          isCompactRow ? (
            <SkeletonBlock key={index} className="h-14 w-full" />
          ) : (
            <div key={index} className="space-y-2">
              <SkeletonBlock className="h-32 w-full" />
              <SkeletonBlock className="h-3.5 w-3/4" />
              <SkeletonBlock className="h-3 w-1/2" />
            </div>
          )
        ))}
      </div>
      <span className="sr-only">تحميل…</span>
    </div>
  );
}

function buildItemActionsFor(item, deps) {
  const {
    typeLabel,
    subtypeLabel,
    previewItem,
    showDeleted,
    activeItemSize,
    bulkMode,
    selectedIdSet,
    toggleBulkSelect,
    setPreviewId,
    openItem,
    toggleFavorite,
    confirmDelete,
    restoreVideoItem,
    buildItemContextMenu
  } = deps;
  return {
    item,
    typeLabel: typeLabel(item),
    subtypeLabel: subtypeLabel(item),
    completeness: computeCompleteness(item, deps.typeById?.get?.(item.type)),
    selected: previewItem?.id === item.id,
    showDeleted,
    itemSize: activeItemSize,
    bulkMode,
    bulkSelected: selectedIdSet.has(item.id),
    onBulkToggle: () => toggleBulkSelect?.(item.id),
    onPreview: () => setPreviewId(item.id),
    onOpen: () => openItem(item),
    onFavorite: () => toggleFavorite?.(item.id),
    onDelete: () => confirmDelete(item),
    onRestore: () => restoreVideoItem?.(item.id),
    onContextMenu: (event) => {
      event.preventDefault();
      buildItemContextMenu(item, event);
    }
  };
}

function renderItemsForViewMode(deps) {
  const {
    activeViewMode,
    visibleItems,
    previewItem,
    typeLabel,
    subtypeLabel,
    showDeleted,
    activeItemSize,
    bulkMode,
    isItemSelected,
    toggleBulkSelect,
    allVisibleSelected,
    toggleSelectAllVisible,
    visibleTableColumns,
    handleColumnResize,
    setPreviewId,
    openItem,
    toggleFavorite,
    confirmDelete,
    restoreVideoItem,
    gridContainerRef,
    gridColumns
  } = deps;

  const itemActions = (item) => buildItemActionsFor(item, deps);

  if (activeViewMode === "tiles") {
    return jsx("div", {
      className: "va-archive-tile-grid grid auto-rows-fr gap-2 sm:grid-cols-2 xl:grid-cols-3",
      children: visibleItems.map((item, index) => jsx(AnimatedItem, {
        index,
        itemId: item.id,
        children: jsx(VideoTileItem, itemActions(item))
      }, item.id))
    });
  }
  if (activeViewMode === "list") {
    return jsx("div", {
      className: "space-y-3",
      children: visibleItems.map((item, index) => jsx(AnimatedItem, {
        index,
        itemId: item.id,
        children: jsx(VideoListItem, itemActions(item))
      }, item.id))
    });
  }
  if (activeViewMode === "table") {
    return jsx(VideoTableView, {
      items: visibleItems,
      previewItem,
      typeLabel,
      subtypeLabel,
      showDeleted,
      itemSize: activeItemSize,
      bulkMode,
      isSelected: isItemSelected,
      onBulkToggle: (id) => toggleBulkSelect?.(id),
      allSelected: allVisibleSelected,
      onSelectAll: toggleSelectAllVisible,
      columns: visibleTableColumns,
      onColumnResize: handleColumnResize,
      onPreview: (item) => setPreviewId(item.id),
      onOpen: openItem,
      onFavorite: (item) => toggleFavorite?.(item.id),
      onDelete: confirmDelete,
      onRestore: (item) => restoreVideoItem?.(item.id)
    });
  }
  const explicitColumnsStyle = getGridStyleForColumns(gridColumns);
  return jsx("div", {
    ref: gridContainerRef,
    className: explicitColumnsStyle
      ? "va-archive-grid grid auto-rows-fr gap-3"
      : `va-archive-grid auto-rows-fr ${ARCHIVE_GRID_CLASSES[activeItemSize] || ARCHIVE_GRID_CLASSES.comfortable}`,
    style: explicitColumnsStyle,
    children: visibleItems.map((item, index) => jsx(AnimatedItem, {
      index,
      itemId: item.id,
      children: jsx(VideoCard, itemActions(item))
    }, item.id))
  });
}

/**
 * The "main content" of the archive page: the result-count summary bar,
 * the view-mode-aware item grid/list/table, pagination, and the
 * right-side preview panel. Renders an EmptyState when filteredItems
 * is empty.
 */
export function ArchivePageResults(props) {
  const {
    isLoading = false,
    filteredItems,
    visibleItems,
    rangeText,
    currentPage,
    totalPages,
    activeViewMode,
    activeItemSize,
    activeGridRows,
    activePageSize,
    gridColumns,
    gridColumnCount,
    changeGridColumns,
    changeViewMode,
    changeItemSize,
    hasFilters,
    showDeleted,
    goToPage,
    openAdd,
    resetFilters,
    previewItem,
    typeLabel,
    subtypeLabel,
    typeById,
    openItem,
    virtualCollections,
    projects,
    addItemsToCollection,
    openProjects,
    updateVideoItem,
    showToast
  } = props;

  // Show the skeleton only on the *first* load: once data exists or
  // filters narrowed it to zero, the EmptyState below is the right
  // signal (loading would lie). videoItems vs filteredItems matters —
  // a fresh import that yields zero filtered hits is still "loaded".
  const showSkeleton = isLoading && filteredItems.length === 0 && !hasFilters && !showDeleted;

  return jsxs("section", {
    className: "grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]",
    children: [
      showSkeleton ? jsx(ArchiveResultsSkeleton, { activeViewMode }) :
      filteredItems.length === 0 ? jsx("div", {
        className: "va-card rounded-2xl border border-dashed border-white/10 bg-gray-950/35",
        children: jsx(EmptyState, {
          type: showDeleted ? "trash" : "archive",
          title: showDeleted ? "سلة المحذوفات فارغة" : hasFilters ? "لا توجد نتائج مطابقة" : "الأرشيف فارغ",
          description: showDeleted
            ? "لا توجد عناصر محذوفة حالياً."
            : hasFilters
              ? "جرّب مسح الفلاتر أو كلمة بحث أقصر."
              : "ابدأ بإضافة فيديو أو استيراد بيانات من جهازك.",
          actionLabel: !showDeleted ? "إضافة فيديو" : undefined,
          onAction: !showDeleted ? openAdd : undefined,
          secondaryActionLabel: hasFilters ? "مسح الفلاتر" : undefined,
          onSecondaryAction: hasFilters ? resetFilters : undefined
        })
      }) : jsxs("div", {
        className: "space-y-4",
        children: [
          jsxs("div", {
            className: "va-control-surface hidden flex-wrap items-center justify-between gap-3 va-surface-muted rounded-xl border px-3 py-1.5 text-xs md:flex",
            children: [
              jsxs("p", {
                className: "min-w-0 text-gray-300",
                children: [
                  jsx("span", { className: "font-semibold text-white", children: rangeText }),
                  totalPages > 1 && jsx("span", { className: "text-gray-500", children: ` · صفحة ${formatNumber(currentPage)}/${formatNumber(totalPages)}` })
                ]
              }),
              jsxs("div", {
                className: "flex shrink-0 flex-wrap items-center justify-end gap-2",
                children: [
                  jsx(ItemSizeSlider, { value: activeItemSize, onChange: changeItemSize }),
                  (activeViewMode === "grid" || activeViewMode === "tiles") && jsx(GridDensitySlider, {
                    gridColumns,
                    gridColumnCount,
                    onChange: changeGridColumns
                  }),
                  jsx(ViewModeSwitch, { value: activeViewMode, onChange: changeViewMode })
                ]
              })
            ]
          }),
          renderItemsForViewMode(props),
          jsx(ArchivePagination, {
            currentPage,
            totalPages,
            onPageChange: goToPage
          })
        ]
      }),
      jsx(PreviewPanel, {
        item: previewItem,
        typeLabel: previewItem ? typeLabel(previewItem) : "",
        subtypeLabel: previewItem ? subtypeLabel(previewItem) : "",
        typeDefinition: previewItem ? typeById?.get?.(previewItem.type) : null,
        collections: virtualCollections,
        projects,
        onOpen: () => previewItem && openItem(previewItem),
        onQuickEdit: () => previewItem && openItem(previewItem),
        onOpenProjects: openProjects,
        onQuickTag: async (item) => {
          if (!item) return;
          const raw = await appPrompt("اكتب الوسوم مفصولة بفواصل. ستضاف إلى المادة الحالية فقط.", {
            title: "وسم سريع",
            confirmLabel: "إضافة الوسوم"
          });
          const tags = parseVideoTags(raw);
          if (!tags.length) return;
          await updateVideoItem?.({ ...item, tags: [...new Set([...(item.tags || []), ...tags])] });
          showToast?.("أُضيفت الوسوم للمادة", "success");
        },
        onAddToCollection: async (item, collectionId) => {
          if (!item || !collectionId) return;
          await addItemsToCollection?.(collectionId, [item.id]);
          showToast?.("أُضيفت المادة إلى المجموعة", "success");
        }
      })
    ]
  });
}

export default ArchivePageResults;
