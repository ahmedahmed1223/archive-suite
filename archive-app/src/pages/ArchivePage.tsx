import {
  Activity,
  CheckSquare,
  Copy,
  Eye,
  FolderOpen,
  Link2,
  PenLine,
  RotateCcw,
  SlidersHorizontal,
  Star,
  Trash2,
  Upload,
  Video
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import { appConfirm } from "../components/common/ConfirmDialog.js";
import { ContextMenu } from "../components/common/ContextMenu.jsx";
import { FloatingActionBar, MobileActionBar, MotionPage } from "../components/ui/index.js";
import {
  ArchiveFilterChips
} from "../features/archive/ArchiveToolbar.jsx";
import { ToolbarButton } from "../features/archive/ArchiveViews.jsx";
import { BulkActionBar } from "../features/archive/BulkActionBar.jsx";
import { FileArchiveWizard } from "../features/archive/FileArchiveWizard.jsx";
import { ImportFromUrlDialog } from "../features/import/ImportFromUrlDialog.jsx";
import { SavedViewsBar } from "../features/archive/SavedViewsBar.jsx";
import { BatchFixToolbar } from "../features/archive/BatchFixToolbar.jsx";
import { ArchivePageDetailedFilters } from "../features/archive/ArchivePageDetailedFilters.jsx";
import { ArchivePageHero } from "../features/archive/ArchivePageHero.jsx";
import { ArchivePageResults } from "../features/archive/ArchivePageResults.jsx";
import { useArchivePageState } from "../features/archive/useArchivePageState.js";
import { useTypeToJump } from "../features/archive/useTypeToJump.js";
import { STATE_META, WORKFLOW_STATES, getItemState } from "../features/archive/itemStatus.js";
import { getCloudToken } from "../bootstrap/cloudSession.js";
import { resolveBackendChoice } from "../bootstrap/backendChoice.js";
import { createMediaClient } from "../features/media/mediaClient.js";
import {
  canUseServerMediaTools,
  createMediaMetadataPatch,
  deriveMediaSourceKey,
  formatMediaJobStatus,
  mergeMediaJobs
} from "../features/media/viewModel.js";
import { reportError } from "../utils/errorReporting.js";
import { ContextualQuickAddBar } from "../components/workflow/ContextualQuickAddBar.jsx";
import { EntityFoldersPanel } from "../components/folders/EntityFoldersPanel.jsx";
import { SideEditPanel } from "../components/workflow/SideEditPanel.jsx";
import { isEditInSidePanelEnabled, resolveOpenTarget } from "../features/archive/resolveOpenTarget.js";

function MediaJobsBoard({ enabled, jobs, busy, onRefresh, onRetry }: any) {
  return jsxs("section", { className: "rounded-2xl va-surface-muted border p-4 text-right", dir: "rtl", children: [
    jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
      jsxs("h2", { className: "flex items-center gap-2 text-base font-bold text-[var(--va-text)]", children: [jsx(Activity, { className: "h-4 w-4 va-accent-text" }), "مهام الوسائط"] }),
      jsx("button", { type: "button", onClick: onRefresh, disabled: !enabled || busy, className: "rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] px-3 py-1.5 text-xs text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)] disabled:opacity-40", children: busy ? "جارٍ التحديث…" : "تحديث" })
    ] }),
    !enabled ? jsx("p", { className: "mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100", children: "تحتاج مهام الوسائط إلى خادم سحابي وتسجيل دخول بدور editor/admin." }) : null,
    jobs.length ? jsx("div", { className: "mt-3 grid gap-2 lg:grid-cols-2", children: jobs.slice(0, 6).map((job: any) => {
      const status = formatMediaJobStatus(job);
      return jsxs("article", { className: "rounded-xl va-surface-subtle border p-3", children: [
        jsxs("div", { className: "flex items-start justify-between gap-2", children: [
          jsxs("div", { className: "min-w-0", children: [
            jsx("p", { className: "truncate text-sm font-semibold text-[var(--va-text)]", children: job.type === "montage" ? "مونتاج" : "تحويل نسخة ويب" }),
            jsx("p", { dir: "ltr", className: "mt-0.5 truncate text-left font-[family-name:var(--va-font-mono)] text-[11px] text-[var(--va-text-muted)]", children: job.sourceKey || job.outputKey || job.id })
          ] }),
          jsx("span", { className: `shrink-0 text-xs ${status.tone}`, children: status.label })
        ] }),
        jsx("div", { className: "mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--va-surface-2)]", children: jsx("div", { className: "h-full rounded-full bg-[var(--va-action)]", style: { width: `${status.progress}%` } }) }),
        job.status === "error" ? jsxs("div", { className: "mt-2 flex items-center justify-between gap-2", children: [
          jsx("p", { className: "min-w-0 flex-1 truncate text-xs text-red-200", children: job.error || "فشلت المهمة" }),
          jsx("button", { type: "button", onClick: () => onRetry?.(job.id), className: "rounded-lg border border-red-500/30 px-2 py-1 text-[11px] text-red-100 hover:bg-red-500/10", children: "إعادة محاولة" })
        ] }) : null
      ] }, job.id);
    }) }) : enabled ? jsx("p", { className: "mt-3 text-sm text-[var(--va-text-muted)]", children: "لا توجد مهام وسائط حديثة." }) : null
  ] });
}

const STATUS_COLOR_MAP = {
  draft:     "border-[var(--va-border-soft)] text-[var(--va-text-muted)]",
  editing:   "border-blue-500/30 text-blue-400",
  review:    "border-amber-500/30 text-amber-400",
  approved:  "border-[var(--va-status-success)]/30 text-[var(--va-status-success)]",
  published: "border-green-500/30 text-green-400",
  archived:  "border-zinc-500/30 text-[var(--va-text-muted)]"
};

function WorkflowPipelineBar({ videoItems, filterStatus, setFilterStatus }: any) {
  const counts = React.useMemo(() => {
    const map = { all: 0 };
    WORKFLOW_STATES.forEach((s: any) => { (map as any)[s] = 0; });
    videoItems.filter((i: any) => !i.isDeleted).forEach((i: any) => {
      const s = getItemState(i);
      map.all = (map.all || 0) + 1;
      if ((map as any)[s] !== undefined) (map as any)[s]++;
    });
    return map;
  }, [videoItems]);

  if (counts.all === 0) return null;

  return jsx("div", {
    className: "flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1",
    role: "group",
    "aria-label": "تصفية حسب حالة سير العمل",
    children: [
      jsx("button", {
        key: "all",
        type: "button",
        onClick: () => setFilterStatus("all"),
        className: `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filterStatus === "all" ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "border-[var(--va-border-soft)] text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)]"}`,
        children: `الكل · ${counts.all}`
      }),
      ...WORKFLOW_STATES.filter((s: any) => (counts as any)[s] > 0).map((s: any) => jsx("button", {
        type: "button",
        onClick: () => setFilterStatus(filterStatus === s ? "all" : s),
        className: `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filterStatus === s ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : `${(STATUS_COLOR_MAP as any)[s]} hover:bg-[var(--va-surface-2)]`}`,
        children: `${(STATE_META as any)[s]?.label || s} · ${(counts as any)[s]}`
      }, s))
    ]
  });
}

export function ArchivePage() {
  const state = useArchivePageState();
  const {
    videoItems, contentTypes, virtualCollections, showToast, showNotification, currentUser, storeSelectedItems,
    addVideoItem, updateVideoItem, toggleFavorite, restoreVideoItem,
    clearSelection, bulkDeleteItems, bulkRestoreItems, bulkAddTags, bulkMoveToCollection, bulkSetType, bulkSetProject,
    projects, undoLastActivity,
    filterType, filterSubtype, filterStatus, setFilterType, setFilterSubtype, setFilterStatus,
    localSearch, setLocalSearch, showDeleted, showFavoritesOnly,
    resetFilters, activeTopMode,
    setBulkMode,
    visibleItems, visibleIds, typeById, typeCounts, subtypes,
    setPreviewId, allVisibleSelected, toggleSelectAllVisible,
    bulkMode, exitBulkMode,
    showFileImportWizard, setShowFileImportWizard,
    contextMenu, setContextMenu,
    savedViews, currentFiltersForSave, applySavedView, saveCurrentView, removeView, canSaveCurrentView,
    openAdd, openItem, openImport, confirmDelete, confirmEmptyTrash,
    settings
  } = state;
  const [mediaJobs, setMediaJobs] = React.useState<any[]>([]);
  const [mediaBusy, setMediaBusy] = React.useState(false);
  const [showImportFromUrl, setShowImportFromUrl] = React.useState(false);
  const [sideEditItem, setSideEditItem] = React.useState(null);
  // §19.9 — the dedicated detail/edit page is the default everywhere. The
  // slide-in SideEditPanel is demoted to an opt-in secondary affordance gated
  // behind settings.ui.editInSidePanel (default false).
  const editInSidePanel = isEditInSidePanelEnabled(settings);
  const startEdit = React.useCallback((item: any) => {
    if (resolveOpenTarget({ action: "edit", editInSidePanel }) === "sidePanel") {
      setSideEditItem(item);
    } else {
      openItem(item);
    }
  }, [editInSidePanel, openItem]);
  const backendChoice = resolveBackendChoice();
  const mediaToolsEnabled = canUseServerMediaTools({ backend: backendChoice.backend, token: getCloudToken(), role: currentUser?.role });
  const mediaClient = React.useMemo(() => {
    if (!mediaToolsEnabled) return null;
    return createMediaClient({ baseUrl: backendChoice.url, getToken: getCloudToken });
  }, [backendChoice.url, mediaToolsEnabled]);

  const refreshMediaJobs = React.useCallback(async () => {
    if (!mediaClient) return;
    setMediaBusy(true);
    try {
      setMediaJobs(mergeMediaJobs(await mediaClient.listJobs() as any) as any);
    } catch (error: any) {
      reportError(showNotification, error, { context: "جلب مهام الوسائط" });
    } finally {
      setMediaBusy(false);
    }
  }, [mediaClient, showNotification]);

  React.useEffect(() => { refreshMediaJobs(); }, [refreshMediaJobs]);

  const saveMediaPatch = React.useCallback(async (item: any, patch: any) => {
    const metadata = {
      ...(item.metadata || {}),
      ...(patch.metadata || {}),
      media: {
        ...(item.metadata?.media || {}),
        ...(patch.metadata?.media || {})
      }
    };
    await updateVideoItem?.({
      ...item,
      ...patch,
      metadata,
      version: (item.version || 1) + 1
    });
  }, [updateVideoItem]);

  const bulkPrepareMedia = React.useCallback(async () => {
    if (!mediaClient) {
      showToast?.("أدوات ffmpeg تحتاج خادمًا سحابيًا ودور editor/admin.", "warning");
      return;
    }
    const selected = videoItems.filter((item: any) => storeSelectedItems.includes(item.id) && !item.isDeleted);
    if (!selected.length) return;
    setMediaBusy(true);
    let queued = 0;
    let skipped = 0;
    try {
      for (const item of selected) {
        const key = deriveMediaSourceKey(item);
        if (!key) {
          skipped += 1;
          continue;
        }
        if (!item.metadata?.media?.thumbnailKey) {
          try {
            const thumb = await mediaClient.thumbnail(key, { width: 640 });
            await saveMediaPatch(item, createMediaMetadataPatch({ probe: item.metadata?.media || {}, thumbnailKey: (thumb as any).outputKey }));
          } catch {
            skipped += 1;
          }
        }
        const result = await mediaClient.transcode(key, { height: 720, durationSec: item.metadata?.media?.durationSec || item.duration || 0 });
        if ((result as any)?.job) setMediaJobs((current: any) => mergeMediaJobs([(result as any).job, ...current]));
        queued += 1;
      }
      showNotification?.(`أُرسلت ${queued} مهمة وسائط إلى الطابور${skipped ? `، وتخطينا ${skipped} عنصر` : ""}.`, {
        type: queued ? "success" : "warning",
        category: "export",
        title: "مهام ffmpeg"
      });
      await refreshMediaJobs();
    } catch (error: any) {
      reportError(showNotification, error, { context: "تجهيز الوسائط المحددة" });
    } finally {
      setMediaBusy(false);
    }
  }, [mediaClient, refreshMediaJobs, saveMediaPatch, showNotification, showToast, storeSelectedItems, videoItems]);

  const retryMediaJob = React.useCallback(async (jobId: any) => {
    if (!mediaClient) return;
    setMediaBusy(true);
    try {
      await mediaClient.retryJob(jobId);
      await refreshMediaJobs();
    } finally {
      setMediaBusy(false);
    }
  }, [mediaClient, refreshMediaJobs]);

  // Type-to-jump — Windows Explorer-style. Find the first visible item
  // whose normalized title starts with what the user types and scroll
  // it into view via the data-archive-item-id attribute.
  useTypeToJump({
    items: visibleItems,
    enabled: !bulkMode && !contextMenu,
    onMatch: (item: any) => {
      setPreviewId(item.id);
      const node = typeof document !== "undefined"
        ? document.querySelector(`[data-archive-item-id="${item.id}"]`)
        : null;
      node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });

  const buildItemContextMenu = React.useCallback((item: any, event: any) => {
    const items = [];
    items.push({ id: "preview", label: "معاينة", icon: Eye, onSelect: () => setPreviewId(item.id) });
    items.push({ id: "open", label: "فتح التفاصيل", icon: FolderOpen, kbd: "Enter", onSelect: () => openItem(item) });
    if (!showDeleted) {
      items.push({ type: "separator" });
      items.push({ id: "favorite", label: item.isFavorite ? "إزالة من المفضلة" : "إضافة للمفضلة", icon: Star, onSelect: () => toggleFavorite?.(item.id) });
      // §19.9 — default edit opens the dedicated detail/edit page. The slide-in
      // side panel is only offered as an explicit secondary action, and only
      // when the user has opted into it.
      items.push({ id: "edit", label: "تعديل", icon: PenLine, onSelect: () => startEdit(item) });
      if (editInSidePanel) {
        items.push({ id: "quick-edit-side", label: "تعديل سريع جانبي", icon: PenLine, onSelect: () => { setSideEditItem(item); setContextMenu(null); } });
      }
    }
    if (item.path) {
      items.push({
        id: "copy-path",
        label: "نسخ المسار",
        icon: Copy,
        onSelect: async () => {
          try {
            await navigator.clipboard?.writeText(item.path);
            showToast?.("تم نسخ المسار", "success");
          } catch (error: any) {
            showToast?.(error?.message || "تعذر النسخ", "error");
          }
        }
      });
    }
    items.push({ type: "separator" });
    if (showDeleted) {
      items.push({ id: "restore", label: "استعادة", icon: RotateCcw, onSelect: () => restoreVideoItem?.(item.id) });
    } else {
      items.push({ id: "delete", label: "نقل لسلة المحذوفات", icon: Trash2, danger: true, kbd: "Del", onSelect: () => confirmDelete(item) });
    }
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      heading: item.title || "بدون عنوان",
      title: `إجراءات: ${item.title || "العنصر"}`,
      items
    } as any);
  }, [confirmDelete, editInSidePanel, openItem, restoreVideoItem, setContextMenu, setPreviewId, showDeleted, showToast, startEdit, toggleFavorite]);

  return jsxs(MotionPage, {
    className: "space-y-6 p-4 sm:p-6 pb-24",
    children: [
      jsx(ArchivePageHero, { ...state, openImport, openAdd, confirmEmptyTrash }),
      videoItems.length > 0 && jsx(EntityFoldersPanel, {
        scope: "archive",
        entityType: "archive-item",
        entities: videoItems.filter((item: any) => !item.isDeleted),
        title: "مجلدات الأرشيف",
        description: "اجمع مواد الأرشيف داخل مجلدات يدوية مستقلة عن النوع والوسوم والمجموعات.",
        getEntityLabel: (item: any) => item.title || item.id,
        getEntityMeta: (item: any) => (typeById.get(item.type) as any)?.name || "غير مصنف"
      }),
      jsx(ContextualQuickAddBar, { contentTypes }),
      jsx(SideEditPanel, {
        item: sideEditItem,
        contentTypes,
        onSave: updateVideoItem,
        onClose: () => setSideEditItem(null)
      }),
      jsx(FileArchiveWizard, {
        open: showFileImportWizard,
        onOpenChange: setShowFileImportWizard,
        contentTypes,
        videoItems,
        addVideoItem,
        showToast
      }),
      jsx(ImportFromUrlDialog, {
        open: showImportFromUrl,
        onOpenChange: setShowImportFromUrl,
        addVideoItem,
        showToast
      }),
      jsx(ContextMenu, { menu: contextMenu, onClose: () => setContextMenu(null) }),
      jsx(BulkActionBar, {
        selectedCount: storeSelectedItems.length,
        totalVisible: visibleIds.length,
        allSelected: allVisibleSelected,
        showRestore: showDeleted,
        collections: virtualCollections,
        onSelectAll: toggleSelectAllVisible,
        onClear: exitBulkMode,
        onDelete: async () => {
          if (!storeSelectedItems.length) return;
          const confirmed = await appConfirm(`حذف ${storeSelectedItems.length} عنصر إلى سلة المحذوفات؟`, {
            title: "حذف متعدد",
            kind: "warning",
            confirmLabel: "حذف"
          });
          if (!confirmed) return;
          await bulkDeleteItems?.([...storeSelectedItems]);
        },
        onRestore: async () => {
          if (!storeSelectedItems.length) return;
          await bulkRestoreItems?.([...storeSelectedItems]);
        },
        onAddTags: async (tags: any) => {
          if (!storeSelectedItems.length || !tags?.length) return;
          await bulkAddTags?.([...storeSelectedItems], tags);
        },
        onMoveToCollection: async (collectionId: any) => {
          if (!collectionId) {
            showToast?.("أنشئ مجموعة أولاً من صفحة المجموعات.", "warning");
            return;
          }
          if (!storeSelectedItems.length) return;
          await bulkMoveToCollection?.([...storeSelectedItems], collectionId);
        },
        onSetType: async (typeId: any) => {
          if (!storeSelectedItems.length || !typeId) return;
          await bulkSetType?.([...storeSelectedItems], typeId);
        },
        onSetProject: async (projectId: any) => {
          if (!storeSelectedItems.length) return;
          await bulkSetProject?.([...storeSelectedItems], projectId);
        },
        contentTypes,
        projects,
        onMediaTranscode: bulkPrepareMedia,
        busy: mediaBusy
      }),
      activeTopMode === "detailed" && jsx(ArchivePageDetailedFilters, { ...state }),
      jsx(WorkflowPipelineBar, { videoItems, filterStatus, setFilterStatus }),
      jsx(ArchiveFilterChips, {
        searchQuery: localSearch,
        filterTypeLabel: filterType !== "all" ? (typeById.get(filterType) as any)?.name || filterType : null,
        filterSubtypeLabel: filterSubtype !== "all" ? (typeById.get(filterType) as any)?.subtypes?.find((sub: any) => sub.id === filterSubtype)?.name || filterSubtype : null,
        filterStatusLabel: filterStatus !== "all" ? (STATE_META as any)[filterStatus]?.label || filterStatus : null,
        showFavoritesOnly, showDeleted,
        onClearSearch: () => setLocalSearch(""),
        onClearType: () => { setFilterType?.("all"); setFilterSubtype?.("all"); },
        onClearSubtype: () => setFilterSubtype?.("all"),
        onClearStatus: () => setFilterStatus("all"),
        onClearFavorites: () => state.setShowFavoritesOnly(false),
        onClearDeleted: () => state.setShowDeleted(false),
        onResetAll: resetFilters
      }),
      jsx(SavedViewsBar, {
        views: savedViews,
        currentFilters: currentFiltersForSave,
        canSave: canSaveCurrentView,
        onApply: applySavedView,
        onSave: saveCurrentView,
        onRemove: removeView
      }),
      storeSelectedItems.length > 0 && jsx(BatchFixToolbar, {
        selectedItems: storeSelectedItems,
        videoItems,
        contentTypes,
        updateVideoItem,
        showToast,
        onClear: exitBulkMode
      }),
      jsx(MediaJobsBoard, {
        enabled: mediaToolsEnabled,
        jobs: mediaJobs,
        busy: mediaBusy,
        onRefresh: refreshMediaJobs,
        onRetry: retryMediaJob
      }),
      jsx(ArchivePageResults, { ...state, buildItemContextMenu }),
      !state.previewItem && jsx(MobileActionBar, {
        label: "إجراءات الأرشيف",
        actions: [
          { id: "filters", label: "فلاتر", icon: SlidersHorizontal, active: activeTopMode === "detailed", onClick: () => state.changeTopMode?.(activeTopMode === "detailed" ? "quick" : "detailed") },
          { id: "add", label: "إضافة", icon: Video, primary: true, onClick: openAdd },
          { id: "select", label: bulkMode ? "إنهاء" : "تحديد", icon: CheckSquare, active: bulkMode, onClick: () => setBulkMode?.((value: any) => !value) },
          { id: "import", label: "استيراد", icon: Upload, onClick: openImport }
        ]
      }),
      jsxs(FloatingActionBar, {
        className: "archive-desktop-floating-actions",
        children: [
          jsx(ToolbarButton, { onClick: openImport, icon: jsx(Upload, { className: "h-4 w-4" }), children: "استيراد ملفات" }, "import"),
          jsx(ToolbarButton, { onClick: () => setShowImportFromUrl(true), icon: jsx(Link2, { className: "h-4 w-4" }), children: "استيراد من روابط" }, "import-url"),
          jsxs("button", {
            type: "button",
            onClick: openAdd,
            className: "btn btn-primary gap-2",
            children: [jsx(Video, { className: "h-4 w-4" }), "إضافة فيديو"]
          }, "add")
        ]
      })
    ]
  });
}

ArchivePage.pageId = "archive";
ArchivePage.migrationStatus = "native";

export default ArchivePage;
