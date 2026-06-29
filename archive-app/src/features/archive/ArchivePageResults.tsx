import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import { EmptyState } from "../../components/common/EmptyState.jsx";
import { UsageOnboardingPanel } from "../../components/onboarding/UsageOnboarding.jsx";
import { appPrompt } from "../../components/common/ConfirmDialog.js";
import { AddRelationDialog } from "../../components/relations/AddRelationDialog.jsx";
import { SkeletonBlock } from "../../components/ui/index.js";
import { formatNumber } from "../../utils/formatting.js";
import { parseVideoTags } from "../videos/viewModel.js";
import { computeCompleteness } from "./completeness.js";
import { getArchiveRenderViewMode } from "./viewModel.js";
import { useReorderDnd } from "./useReorderDnd.js";
import { useDndController } from "../dnd/dndController.js";
import { setDragCountBadge } from "../../components/dnd/DragPreview.jsx";
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

function ArchiveResultsSkeleton({ activeViewMode = "grid" }: any) {
  const renderViewMode = getArchiveRenderViewMode(activeViewMode);
  const isCompactRow = renderViewMode === "list" || renderViewMode === "table";
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
        {Array.from({ length: SKELETON_CARD_COUNT }).map((_: any, index: any) => (
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

function buildItemActionsFor(item: any, deps: any) {
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
    onContextMenu: (event: any) => {
      event.preventDefault();
      buildItemContextMenu(item, event);
    }
  };
}

function ArchiveGalleryView({ visibleItems, itemActions, kbFocusClass }: any) {
  return jsx("div", {
    className: "columns-1 gap-3 sm:columns-2 xl:columns-3 2xl:columns-4",
    role: "list",
    "aria-label": "معرض Masonry لعناصر الأرشيف",
    children: visibleItems.map((item: any, index: any) => jsx(AnimatedItem, {
      index,
      itemId: item.id,
      className: `mb-3 break-inside-avoid ${kbFocusClass(index)}`,
      "data-list-item": "",
      disableMotion: index >= 16,
      children: jsx(VideoCard, itemActions(item, index))
    }, item.id))
  });
}

function renderItemsForViewMode(deps: any) {
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
  const kbFocusClass = (index: any) =>
    kbFocusedIndex === index
      ? "ring-2 ring-emerald-500 ring-offset-1 ring-offset-gray-950 rounded-2xl"
      : "";

  const itemActions = (item: any, index: any) => {
    const base = buildItemActionsFor(item, deps);
    // Merge keyboard selection on top of bulk selection so keyboard-selected
    // items light up even when bulkMode is not yet active in the store.
    if (kbIsSelected && kbIsSelected(item.id)) {
      return { ...base, bulkSelected: true };
    }
    return base;
  };

  const renderViewMode = getArchiveRenderViewMode(activeViewMode);
  if (renderViewMode === "gallery") {
    return jsx(ArchiveGalleryView, {
      visibleItems,
      itemActions,
      kbFocusClass
    });
  }
  if (renderViewMode === "tiles") {
    return jsx("div", {
      className: "va-archive-tile-grid grid auto-rows-fr gap-2 sm:grid-cols-2 xl:grid-cols-3",
      children: visibleItems.map((item: any, index: any) => jsx(AnimatedItem, {
        index,
        itemId: item.id,
        className: kbFocusClass(index),
        "data-list-item": "",
        children: jsx(VideoTileItem, itemActions(item, index))
      }, item.id))
    });
  }
  if (renderViewMode === "list") {
    return jsx("div", {
      className: "space-y-3",
      children: visibleItems.map((item: any, index: any) => jsx(AnimatedItem, {
        index,
        itemId: item.id,
        className: kbFocusClass(index),
        "data-list-item": "",
        children: jsx(VideoListItem, itemActions(item, index))
      }, item.id))
    });
  }
  if (renderViewMode === "table") {
    return jsx(VideoTableView, {
      items: visibleItems,
      previewItem,
      typeLabel,
      subtypeLabel,
      typeOptions,
      showDeleted,
      itemSize: activeItemSize,
      bulkMode,
      isSelected: (id: any) => !!(isItemSelected?.(id) || kbIsSelected?.(id)),
      onBulkToggle: (id: any) => toggleBulkSelect?.(id),
      allSelected: allVisibleSelected,
      onSelectAll: toggleSelectAllVisible,
      columns: visibleTableColumns,
      onColumnResize: handleColumnResize,
      onPreview: (item: any) => setPreviewId(item.id),
      onOpen: openItem,
      onFavorite: (item: any) => toggleFavorite?.(item.id),
      onDelete: confirmDelete,
      onRestore: (item: any) => restoreVideoItem?.(item.id),
      // §13.3 inline cell editing — persists title/tags/type patches through
      // the store action (permission check + change history + IndexedDB).
      onCellSave: updateVideoItem ? async (item: any, patch: any) => {
        try {
          await updateVideoItem({ ...item, ...patch });
          showToast?.("تم حفظ التعديل", "success");
        } catch (error: any) {
          showToast?.(error?.message || "تعذر حفظ التعديل", "error");
        }
      } : undefined
    });
  }
  const explicitColumnsStyle = getGridStyleForColumns(gridColumns);
  const reorder = deps.reorder;
  // Drop indicator: a reorder gesture highlights the hovered target card so
  // the user sees exactly where the dragged item will land.
  const reorderClass = (item: any) => {
    if (!reorder) return "";
    if (reorder.dragId === item.id) return "opacity-50";
    if (reorder.overId === item.id) return "ring-2 ring-emerald-400 ring-offset-2 ring-offset-gray-950 rounded-2xl";
    return "";
  };
  const containerProps = reorder ? reorder.getContainerProps() : {};
  return jsx("div", {
    ref: gridContainerRef,
    className: explicitColumnsStyle
      ? "va-archive-grid grid auto-rows-fr gap-3"
      : `va-archive-grid auto-rows-fr ${(ARCHIVE_GRID_CLASSES as any)[activeItemSize] || ARCHIVE_GRID_CLASSES.comfortable}`,
    style: explicitColumnsStyle,
    onDragOver: (event: any) => { containerProps.onDragOver?.(event); deps.onLinkDragOver?.(event); },
    onDrop: (event: any) => {
      // Reorder claims the drop first; the link dialog only opens when no
      // reorder gesture is in flight (preserves the drag-to-link feature).
      const wasReordering = reorder?.isDragging;
      containerProps.onDrop?.(event);
      if (!wasReordering) deps.onLinkDrop?.(event);
    },
    children: visibleItems.map((item: any, index: any) => {
      const sourceProps = reorder ? reorder.getSourceProps(item) : {};
      return jsx(AnimatedItem, {
        index,
        itemId: item.id,
        className: `${kbFocusClass(index)} ${reorderClass(item)}`.trim(),
        "data-list-item": "",
        draggable: Boolean(reorder) || Boolean(deps.onLinkDragStart) || Boolean(deps.onCrossZoneDragStart),
        ...sourceProps,
        onDragStart: (e: any) => { sourceProps.onDragStart?.(e); deps.onCrossZoneDragStart?.(item, e); deps.onLinkDragStart?.(item, e); },
        onDragEnd: (e: any) => { sourceProps.onDragEnd?.(e); deps.onCrossZoneDragEnd?.(); },
        children: jsx(VideoCard, itemActions(item, index))
      }, item.id);
    })
  });
}

/**
 * The "main content" of the archive page: the result-count summary bar,
 * the view-mode-aware item grid/list/table, pagination, and the
 * right-side preview panel. Renders an EmptyState when filteredItems
 * is empty.
 */
export function ArchivePageResults(props: any) {
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
    setPreviewId,
    toggleBulkSelect,
    setBulkMode,
    virtualCollections,
    projects,
    addItemsToCollection,
    openProjects,
    updateVideoItem,
    showToast,
    undoLastActivity,
    addRelation,
    itemRelations = [],
    videoItems = [],
    reorderArchiveItems
  } = props;

  // §19.8 — reorder DnD (mouse + touch) for the grid view, persisted via the
  // page-state hook. Only enabled when a handler exists and we're not in the
  // table view (that view has its own column semantics).
  const reorderEnabled = Boolean(reorderArchiveItems)
    && activeViewMode !== "details"
    && !showDeleted;
  const reorder = useReorderDnd({ enabled: reorderEnabled, onReorder: reorderArchiveItems });

  // Ctrl+Z: undo the last undoable inline-edit when focus is not inside a text field.
  React.useEffect(() => {
    if (!undoLastActivity) return;
    function handleGlobalUndo(event: any) {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.key !== "z" && event.key !== "Z") return;
      const tag = (document.activeElement?.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || (document.activeElement as any)?.isContentEditable) return;
      event.preventDefault();
      undoLastActivity().then((result: any) => {
        if (result) showToast?.("تم التراجع عن آخر تعديل", "success");
      }).catch(() => {});
    }
    document.addEventListener("keydown", handleGlobalUndo);
    return () => document.removeEventListener("keydown", handleGlobalUndo);
  }, [undoLastActivity, showToast]);

  // Drag-to-link: drag one card onto another to open AddRelationDialog.
  // Uses a ref for the drag source to avoid re-renders mid-drag.
  const linkDragSourceRef = React.useRef(null);
  const [linkDialog, setLinkDialog] = React.useState<any>(null); // { sourceId, targetId } | null

  // Keyboard list navigation provides `selectedIds`, which the cross-zone drag
  // handler below reads — so this must be initialized first (avoids a TDZ
  // "Cannot access 'selectedIds' before initialization" on archive load).
  const handleKbActivate = React.useCallback((item: any) => openItem?.(item), [openItem]);
  const handleKbSelect = React.useCallback((id: any, selected: any) => {
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

  // §1892 — cross-zone drag: sets archive item IDs on DataTransfer so
  // DropZone targets (folders, collections) can receive them.
  const { startDrag: startCrossZoneDrag, clearDrag: clearCrossZoneDrag } = useDndController() ?? {};
  const handleCrossZoneDragStart = React.useCallback((item: any, event: any) => {
    const ids = selectedIds?.size > 0 ? [...selectedIds] : [item.id];
    setDragCountBadge(event, ids.length);
    startCrossZoneDrag?.(ids, event);
  }, [selectedIds, startCrossZoneDrag]);

  const handleLinkDragStart = React.useCallback((item: any, event: any) => {
    linkDragSourceRef.current = item.id;
    event.dataTransfer.setData("text/archive-link-id", item.id);
    event.dataTransfer.effectAllowed = "link";
  }, []);

  const handleLinkDragOver = React.useCallback((event: any) => {
    if (!linkDragSourceRef.current) return;
    const node = event.target.closest("[data-archive-item-id]");
    if (!node) return;
    const targetId = node.getAttribute("data-archive-item-id");
    if (targetId && targetId !== linkDragSourceRef.current) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "link";
    }
  }, []);

  const handleLinkDrop = React.useCallback((event: any) => {
    const sourceId = event.dataTransfer.getData("text/archive-link-id") || linkDragSourceRef.current;
    if (!sourceId) return;
    const node = event.target.closest("[data-archive-item-id]");
    const targetId = node?.getAttribute("data-archive-item-id");
    linkDragSourceRef.current = null;
    if (!targetId || targetId === sourceId) return;
    event.preventDefault();
    setLinkDialog({ sourceId, targetId } as any);
  }, []);

  const handleLinkDialogAdd = React.useCallback(async (relation: any) => {
    await addRelation?.(relation);
    showToast?.("تمت إضافة العلاقة", "success");
    setLinkDialog(null);
  }, [addRelation, showToast]);

  const typeOptions = React.useMemo(
    () => (contentTypes || [])
      .filter((type: any) => type.status !== "archived")
      .map((type: any) => ({ value: type.id, label: type.name || type.id })),
    [contentTypes]
  );

  // Virtual list — active on mobile (< 768 px) with > 20 items, or desktop > 50 items.
  // List view uses container-level scrolling (64 px rows) with sessionStorage scroll persistence.
  // Grid and other views fall back to window-level scrolling with a 200 px estimate.
  const renderViewModeForVirtual = getArchiveRenderViewMode(activeViewMode);
  const isListView = renderViewModeForVirtual === "list";
  const virtualEstimateSize = isListView ? 72 : 200;

  const {
    containerRef: virtualContainerRef,
    visibleItems: virtualItems,
    topSpacerHeight,
    bottomSpacerHeight,
    shouldVirtualize,
    totalCount,
    visibleCount,
  } = useVirtualList({
    items: visibleItems || [],
    estimateSize: virtualEstimateSize,
    overscan: 5,
    scrollKey: isListView ? "archive-scroll-pos" : undefined,
    containerScroll: isListView,
  });

  // Show the skeleton only on the *first* load: once data exists or
  // filters narrowed it to zero, the EmptyState below is the right
  // signal (loading would lie). videoItems vs filteredItems matters —
  // a fresh import that yields zero filtered hits is still "loaded".
  const showSkeleton = isLoading && filteredItems.length === 0 && !hasFilters && !showDeleted;
  const previewIndex = React.useMemo(
    () => (visibleItems || []).findIndex((item: any) => item.id === previewItem?.id),
    [previewItem?.id, visibleItems]
  );
  const canPreviewPrevious = previewIndex > 0;
  const canPreviewNext = previewIndex >= 0 && previewIndex < (visibleItems || []).length - 1;
  const previewPrevious = React.useCallback(() => {
    if (!canPreviewPrevious) return;
    setPreviewId?.(visibleItems[previewIndex - 1].id);
  }, [canPreviewPrevious, previewIndex, setPreviewId, visibleItems]);
  const previewNext = React.useCallback(() => {
    if (!canPreviewNext) return;
    setPreviewId?.(visibleItems[previewIndex + 1].id);
  }, [canPreviewNext, previewIndex, setPreviewId, visibleItems]);
  const viewSupportsVirtualization = activeViewMode !== "gallery";
  const renderedVisibleItems = viewSupportsVirtualization
    ? virtualItems.map(({ item }: any) => item)
    : visibleItems;

  return jsxs("section", {
    className: "grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]",
    children: [
      showSkeleton ? jsx(ArchiveResultsSkeleton, { activeViewMode }) :
      filteredItems.length === 0 ? jsxs("div", {
        className: "space-y-4",
        children: [
        // §1483 — first-run usage onboarding. Self-guards: only renders for a
        // genuinely empty, non-dismissed archive. Suppressed in trash and
        // filtered "no results" states so it never competes with those.
        !showDeleted && !hasFilters && jsx(UsageOnboardingPanel, {}),
        jsx("div", {
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
      })
        ]
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
                  (activeViewMode === "grid" || activeViewMode === "gallery" || activeViewMode === "compact") && jsx(GridDensitySlider, {
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
            children: jsx("div", {
              // List view uses a scrollable container so the virtual scroller tracks
              // the container's own scrollTop rather than window.scrollY. This keeps
              // the rest of the page fixed and lets the virtual window fire correctly.
              // For other views we fall back to the natural document flow.
              ref: virtualContainerRef,
              dir: "rtl",
              style: isListView
                ? { height: "calc(100vh - 200px)", overflowY: "auto" }
                : undefined,
              children: [
                viewSupportsVirtualization && topSpacerHeight > 0 && jsx("div", { style: { height: topSpacerHeight }, "aria-hidden": "true" }),
                renderItemsForViewMode({
                  ...props,
                  // Pass only the virtualized slice where the layout is linear; masonry needs the full page.
                  visibleItems: renderedVisibleItems,
                  typeOptions,
                  kbFocusedIndex: focusedIndex,
                  kbIsSelected: isSelected,
                  onCrossZoneDragStart: handleCrossZoneDragStart,
                  onCrossZoneDragEnd: clearCrossZoneDrag,
                  onLinkDragStart: addRelation ? handleLinkDragStart : undefined,
                  onLinkDragOver: addRelation ? handleLinkDragOver : undefined,
                  onLinkDrop: addRelation ? handleLinkDrop : undefined,
                  reorder: reorderEnabled ? reorder : null,
                }),
                viewSupportsVirtualization && bottomSpacerHeight > 0 && jsx("div", { style: { height: bottomSpacerHeight }, "aria-hidden": "true" }),
                viewSupportsVirtualization && shouldVirtualize && jsx("p", {
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
            className: "fixed start-1/2 z-40 -translate-x-1/2 flex items-center gap-3 rounded-full border border-gray-600 bg-gray-800/95 px-4 py-2 shadow-xl backdrop-blur-sm text-sm",
            style: { bottom: "var(--va-mobile-floating-bottom)" },
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
        canPreviewPrevious,
        canPreviewNext,
        onPreviewPrevious: previewPrevious,
        onPreviewNext: previewNext,
        onQuickTag: async (item: any) => {
          if (!item) return;
          const raw = await appPrompt("اكتب الوسوم مفصولة بفواصل. ستضاف إلى المادة الحالية فقط.", {
            title: "وسم سريع",
            confirmLabel: "إضافة الوسوم"
          });
          const tags = parseVideoTags(raw as any);
          if (!tags.length) return;
          await updateVideoItem?.({ ...item, tags: [...new Set([...(item.tags || []), ...tags])] });
          showToast?.("أُضيفت الوسوم للمادة", "success");
        },
        onAddToCollection: async (item: any, collectionId: any) => {
          if (!item || !collectionId) return;
          await addItemsToCollection?.(collectionId, [item.id]);
          showToast?.("أُضيفت المادة إلى المجموعة", "success");
        }
      }),
      linkDialog && jsx(AddRelationDialog, {
        isOpen: true,
        sourceItem: videoItems.find((item: any) => item.id === (linkDialog as any).sourceId) || null,
        initialTargetId: (linkDialog as any).targetId,
        allItems: videoItems,
        existingRelations: itemRelations.filter((relation: any) => relation.sourceId === (linkDialog as any).sourceId),
        onAdd: handleLinkDialogAdd,
        onClose: () => setLinkDialog(null)
      })
    ]
  });
}

export default ArchivePageResults;
