import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import { EmptyState } from "../../components/common/EmptyState.jsx";
import { appPrompt } from "../../components/common/ConfirmDialog.js";
import { SkeletonBlock } from "../../components/ui/index.js";
import { formatNumber } from "../../utils/formatting.js";
import { parseVideoTags } from "../videos/viewModel.js";
import { computeCompleteness } from "./completeness.js";
import { useKeyboardListNav } from "../../hooks/useKeyboardListNav.js";
import { useVirtualList } from "../../hooks/useVirtualList.js";
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
    typeOptions,
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
    updateVideoItem,
    showToast,
    gridContainerRef,
    gridColumns,
    // Keyboard nav state — provided when rendered inside the keyboard container
    kbFocusedIndex,
    kbIsSelected
  } = deps;

  // Returns a class that visually highlights the keyboard-focused item with
  // an emerald ring so the user always knows where keyboard focus sits.
  const kbFocusClass = (index) =>
    kbFocusedIndex === index
      ? "ring-2 ring-emerald-500 ring-offset-1 ring-offset-gray-950 rounded-2xl"
      : "";

  const itemActions = (item, index) => {
    const base = buildItemActionsFor(item, deps);
    // Merge keyboard selection on top of bulk selection so keyboard-selected
    // items light up even when bulkMode is not yet active in the store.
    if (kbIsSelected && kbIsSelected(item.id)) {
      return { ...base, bulkSelected: true };
    }
    return base;
  };

  if (activeViewMode === "tiles") {
    return jsx("div", {
      className: "va-archive-tile-grid grid auto-rows-fr gap-2 sm:grid-cols-2 xl:grid-cols-3",
      children: visibleItems.map((item, index) => jsx(AnimatedItem, {
        index,
        itemId: item.id,
        className: kbFocusClass(index),
        "data-list-item": "",
        children: jsx(VideoTileItem, itemActions(item, index))
      }, item.id))
    });
  }
  if (activeViewMode === "list") {
    return jsx("div", {
      className: "space-y-3",
      children: visibleItems.map((item, index) => jsx(AnimatedItem, {
        index,
        itemId: item.id,
        className: kbFocusClass(index),
        "data-list-item": "",
        children: jsx(VideoListItem, itemActions(item, index))
      }, item.id))
    });
  }
  if (activeViewMode === "table") {
    return jsx(VideoTableView, {
      items: visibleItems,
      previewItem,
      typeLabel,
      subtypeLabel,
      typeOptions,
      showDeleted,
      itemSize: activeItemSize,
      bulkMode,
      isSelected: (id) => !!(isItemSelected?.(id) || kbIsSelected?.(id)),
      onBulkToggle: (id) => toggleBulkSelect?.(id),
      allSelected: allVisibleSelected,
      onSelectAll: toggleSelectAllVisible,
      columns: visibleTableColumns,
      onColumnResize: handleColumnResize,
      onPreview: (item) => setPreviewId(item.id),
      onOpen: openItem,
      onFavorite: (item) => toggleFavorite?.(item.id),
      onDelete: confirmDelete,
      onRestore: (item) => restoreVideoItem?.(item.id),
      // §13.3 inline cell editing — persists title/tags/type patches through
      // the store action (permission check + change history + IndexedDB).
      onCellSave: updateVideoItem ? async (item, patch) => {
        try {
          await updateVideoItem({ ...item, ...patch });
          showToast?.("تم حفظ التعديل", "success");
        } catch (error) {
          showToast?.(error?.message || "تعذر حفظ التعديل", "error");
        }
      } : undefined
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
      className: kbFocusClass(index),
      "data-list-item": "",
      children: jsx(VideoCard, itemActions(item, index))
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
    contentTypes,
    openItem,
    toggleBulkSelect,
    setBulkMode,
    virtualCollections,
    projects,
    addItemsToCollection,
    openProjects,
    updateVideoItem,
    showToast
  } = props;

  const typeOptions = React.useMemo(
    () => (contentTypes || [])
      .filter((type) => type.status !== "archived")
      .map((type) => ({ value: type.id, label: type.name || type.id })),
    [contentTypes]
  );

  const handleKbActivate = React.useCallback((item) => openItem?.(item), [openItem]);
  const handleKbSelect = React.useCallback((id, selected) => {
    // Enter bulk mode the first time a keyboard selection is made
    if (selected) setBulkMode?.(true);
    toggleBulkSelect?.(id);
  }, [setBulkMode, toggleBulkSelect]);

  const { containerRef, onKeyDown, isFocused, isSelected, toggleSelect, selectedIds, clearSelection, focusedIndex } = useKeyboardListNav({
    items: visibleItems || [],
    onActivate: handleKbActivate,
    onSelect: handleKbSelect,
    multiSelect: true,
  });

  // Virtual list — only active on mobile (< 768 px) with > 20 items.
  // itemHeight 120 px matches a standard archive card height in list/grid view.
  const {
    containerRef: virtualContainerRef,
    visibleItems: virtualItems,
    topSpacerHeight,
    bottomSpacerHeight,
    shouldVirtualize,
    totalCount,
    visibleCount,
  } = useVirtualList({ items: visibleItems || [], itemHeight: 120 });

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
          jsx("div", {
            ref: containerRef,
            onKeyDown,
            tabIndex: 0,
            role: "listbox",
            "aria-multiselectable": "true",
            "aria-label": "قائمة العناصر المؤرشفة",
            className: "outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 rounded-2xl",
            children: jsxs("div", {
              ref: virtualContainerRef,
              children: [
                topSpacerHeight > 0 && jsx("div", { style: { height: topSpacerHeight }, "aria-hidden": "true" }),
                renderItemsForViewMode({
                  ...props,
                  // Pass only the virtualized slice of items on mobile; full list elsewhere
                  visibleItems: virtualItems.map(({ item }) => item),
                  typeOptions,
                  kbFocusedIndex: focusedIndex,
                  kbIsSelected: isSelected,
                }),
                bottomSpacerHeight > 0 && jsx("div", { style: { height: bottomSpacerHeight }, "aria-hidden": "true" }),
                shouldVirtualize && jsx("p", {
                  className: "text-xs text-gray-600 text-center py-1",
                  "aria-live": "polite",
                  children: `عرض ${visibleCount} من ${totalCount} عنصر`,
                }),
              ]
            })
          }),
          jsx(ArchivePagination, {
            currentPage,
            totalPages,
            onPageChange: goToPage
          }),
          selectedIds.size > 0 && jsx("div", {
            className: "fixed bottom-20 left-1/2 z-40 -translate-x-1/2 flex items-center gap-3 rounded-full border border-gray-600 bg-gray-800/95 px-4 py-2 shadow-xl backdrop-blur-sm text-sm",
            dir: "rtl",
            role: "status",
            "aria-live": "polite",
            children: jsxs("span", {
              className: "flex items-center gap-3 text-white",
              children: [
                jsxs("span", { className: "font-semibold", children: [selectedIds.size, " محدد"] }),
                jsx("button", {
                  type: "button",
                  onClick: clearSelection,
                  className: "rounded-full border border-white/20 px-3 py-0.5 text-xs text-gray-300 hover:bg-white/10 hover:text-white",
                  children: "إلغاء"
                })
              ]
            })
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
