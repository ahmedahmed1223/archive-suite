"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { FormEvent } from "react";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Filter, FolderSearch, PanelRightOpen, Search, SlidersHorizontal } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { ArchiveRecordCard } from "./ArchiveRecordCard";
import DataTable from "@/components/ui/DataTable";
import DataViewSwitcher, { type DataViewOption } from "@/components/DataViewSwitcher";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { createArchiveApiClient, type ArchiveRecord, type SavedSearch, type SearchFacets } from "@/lib/archive-api";
import { toastError, toastSuccess } from "@/lib/toast";
import { MOBILE_VIEWPORT_QUERY, matchesMediaQuery } from "@/lib/use-media-query";
import { readWorkspacePreferences, updateWorkspacePreferences, WORKSPACE_PREFERENCES_STORAGE_KEY } from "@/lib/workspace-preferences";
import styles from "./archive.module.css";
import { Skeleton } from "@/components/ui/Skeleton";

// Workflow states mirrored from the legacy SPA's itemStatus state machine —
// the server-authoritative state machine. The Laravel search/records endpoints
// do not expose a status column or query param (verified against
// SearchController/RecordsController), so this is a client-side facet only:
// it reads `record.workflowStatus` when present, defaulting to "draft".
type WorkflowStatus = "draft" | "editing" | "review" | "approved" | "published" | "archived";

const WORKFLOW_STATES: WorkflowStatus[] = ["draft", "editing", "review", "approved", "published", "archived"];

const workflowStatusLabels: Record<WorkflowStatus, string> = {
  draft: "مسودة",
  editing: "تحرير",
  review: "قيد المراجعة",
  approved: "معتمد",
  published: "منشور",
  archived: "مؤرشف"
};

function getRecordWorkflowStatus(record: ArchiveRecord): WorkflowStatus {
  const value = record.workflowStatus;
  return typeof value === "string" && (WORKFLOW_STATES as string[]).includes(value)
    ? (value as WorkflowStatus)
    : "draft";
}

type ArchiveState =
  | { status: "loading" }
  | { status: "ready"; records: ArchiveRecord[]; facets?: SearchFacets }
  | { status: "error"; message: string };

export interface SelectClickModifiers {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export interface GridSelectionResult {
  selectedIds: string[];
  anchorId: string;
}

// Pure selection logic for click/shift+click/ctrl+click on grid rows and
// cards. Kept framework-free so it is directly unit-testable without
// mounting the page.
export function resolveGridSelectionClick(
  visibleIds: string[],
  currentSelected: string[],
  anchorId: string | null,
  targetId: string,
  modifiers: SelectClickModifiers
): GridSelectionResult {
  if (modifiers.shiftKey && anchorId) {
    const fromIndex = visibleIds.indexOf(anchorId);
    const toIndex = visibleIds.indexOf(targetId);
    if (fromIndex !== -1 && toIndex !== -1) {
      const start = Math.min(fromIndex, toIndex);
      const end = Math.max(fromIndex, toIndex);
      return { selectedIds: visibleIds.slice(start, end + 1), anchorId };
    }
  }

  if (modifiers.ctrlKey || modifiers.metaKey) {
    const nextSelected = currentSelected.includes(targetId)
      ? currentSelected.filter((id) => id !== targetId)
      : [...currentSelected, targetId];
    return { selectedIds: nextSelected, anchorId: targetId };
  }

  return { selectedIds: [targetId], anchorId: targetId };
}

type ArchiveViewMode = "grid" | "gallery" | "compact" | "list" | "details";
export type ArchiveItemSize = "compact" | "comfortable" | "large";
type ArchiveSortField = "updatedAt" | "createdAt" | "title";
type ArchiveSortDirection = "asc" | "desc";

interface SavedArchiveView {
  id: string;
  name: string;
  query: string;
  store: string;
  type: string;
  status: WorkflowStatus | "all";
  viewMode: ArchiveViewMode;
  itemSize: ArchiveItemSize;
  sortField: ArchiveSortField;
  sortDirection: ArchiveSortDirection;
}

const viewOptions: DataViewOption<ArchiveViewMode>[] = [
  { value: "grid", label: "شبكة", shortLabel: "شبكة" },
  { value: "gallery", label: "معرض", shortLabel: "معرض" },
  { value: "compact", label: "مضغوط", shortLabel: "مضغوط" },
  { value: "list", label: "قائمة", shortLabel: "قائمة" },
  { value: "details", label: "تفاصيل", shortLabel: "جدول" }
];

const itemSizeOptions: DataViewOption<ArchiveItemSize>[] = [
  { value: "compact", label: "مضغوط" },
  { value: "comfortable", label: "مريح" },
  { value: "large", label: "كبير" }
];

const sortLabels: Record<ArchiveSortField, string> = {
  updatedAt: "آخر تحديث",
  createdAt: "تاريخ الإنشاء",
  title: "العنوان"
};

function normalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .trim();
}

function getRecordSearchText(record: ArchiveRecord) {
  const metadata = record.metadata && typeof record.metadata === "object"
    ? Object.values(record.metadata).join(" ")
    : "";

  return normalizeText([
    record.title,
    record.description,
    record.store,
    record.type,
    record.subtype,
    (record.tags || []).join(" "),
    metadata
  ].join(" "));
}

export function formatDate(value?: string) {
  if (!value) return "غير محدد";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ar-SA");
}

function getRecordTime(record: ArchiveRecord, field: Exclude<ArchiveSortField, "title">) {
  const value = field === "createdAt" ? record.createdAt : record.updatedAt;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function getUniqueValues(records: ArchiveRecord[], key: "store" | "type") {
  return Array.from(new Set(records.map((record) => record[key]).filter((value): value is string => Boolean(value)))).sort((a, b) =>
    a.localeCompare(b, "ar")
  );
}

function getInitialViewMode(params: URLSearchParams): ArchiveViewMode {
  const value = params.get("view");
  if (viewOptions.some((option) => option.value === value)) {
    return value as ArchiveViewMode;
  }

  if (matchesMediaQuery(MOBILE_VIEWPORT_QUERY)) {
    return "list";
  }

  return "grid";
}

function getInitialItemSize(params: URLSearchParams): ArchiveItemSize {
  const value = params.get("size");
  return itemSizeOptions.some((option) => option.value === value) ? (value as ArchiveItemSize) : "compact";
}

function getInitialSortField(params: URLSearchParams): ArchiveSortField {
  const value = params.get("sort");
  return value === "createdAt" || value === "title" ? value : "updatedAt";
}

function getInitialStatus(params: URLSearchParams): WorkflowStatus | "all" {
  const value = params.get("status");
  return value && (WORKFLOW_STATES as string[]).includes(value) ? (value as WorkflowStatus) : "all";
}

function savedFilter(search: SavedSearch, key: string) {
  const value = search.filters?.[key];
  return typeof value === "string" ? value : "";
}

function isSavedArchiveView(search: SavedSearch) {
  return savedFilter(search, "viewKind") === "archive-view";
}

function savedArchiveViewFromSearch(search: SavedSearch): SavedArchiveView {
  return {
    id: search.id,
    name: search.name,
    query: search.query || "",
    store: savedFilter(search, "store") || "all",
    type: savedFilter(search, "type") || "all",
    status: (savedFilter(search, "status") as WorkflowStatus | "all") || "all",
    viewMode: (savedFilter(search, "viewMode") as ArchiveViewMode) || "grid",
    itemSize: (savedFilter(search, "itemSize") as ArchiveItemSize) || "compact",
    sortField: (savedFilter(search, "sortField") as ArchiveSortField) || "updatedAt",
    sortDirection: (savedFilter(search, "sortDirection") as ArchiveSortDirection) || "desc"
  };
}

function ArchivePageContent() {
  const dialogs = useConfirmDialog();
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = useMemo(() => createArchiveApiClient(), []);

  const [state, setState] = useState<ArchiveState>({ status: "loading" });
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [store, setStore] = useState(() => searchParams.get("store") || "all");
  const [type, setType] = useState(() => searchParams.get("type") || "all");
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | "all">(() => getInitialStatus(searchParams));
  const [viewMode, setViewMode] = useState<ArchiveViewMode>(() => getInitialViewMode(searchParams));
  const [itemSize, setItemSize] = useState<ArchiveItemSize>(() => getInitialItemSize(searchParams));
  const [sortField, setSortField] = useState<ArchiveSortField>(() => getInitialSortField(searchParams));
  const [sortDirection, setSortDirection] = useState<ArchiveSortDirection>(() => searchParams.get("dir") === "asc" ? "asc" : "desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [savedViews, setSavedViews] = useState<SavedArchiveView[]>([]);
  const [savedViewStatus, setSavedViewStatus] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (searchParams.toString()) return;
    try {
      const saved = readWorkspacePreferences(window.localStorage.getItem(WORKSPACE_PREFERENCES_STORAGE_KEY)).routes["/archive"];
      if (!saved) return;
      if (saved.view && viewOptions.some((option) => option.value === saved.view)) setViewMode(saved.view as ArchiveViewMode);
      if (saved.density && itemSizeOptions.some((option) => option.value === saved.density)) setItemSize(saved.density);
      if (saved.previewId) setPreviewId(saved.previewId);
      setQuery(saved.filters?.q || "");
      setStore(saved.filters?.store || "all");
      setType(saved.filters?.type || "all");
      setWorkflowStatus((saved.filters?.status as WorkflowStatus | "all") || "all");
    } catch {
      // Local preferences must never block archive loading.
    }
    // Restore once; URL parameters remain the explicit shareable state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const current = readWorkspacePreferences(window.localStorage.getItem(WORKSPACE_PREFERENCES_STORAGE_KEY));
      const next = updateWorkspacePreferences(current, "/archive", {
        view: viewMode,
        density: itemSize,
        previewId: previewId || undefined,
        filters: { q: query, store, type, status: workflowStatus }
      });
      window.localStorage.setItem(WORKSPACE_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage can be unavailable in private or restricted browser contexts.
    }
  }, [itemSize, previewId, query, store, type, viewMode, workflowStatus]);

  const refreshSavedViews = useCallback(async () => {
    const response = await api.savedSearches();
    if (!response.ok) {
      setSavedViewStatus(response.error || "تعذر تحميل العروض المحفوظة.");
      return;
    }

    setSavedViews(response.searches.filter(isSavedArchiveView).map(savedArchiveViewFromSearch));
    setSavedViewStatus("");
  }, [api]);

  const loadRecords = useCallback(async (
    q: string,
    activeStore: string = store,
    activeType: string = type,
    activeStatus: WorkflowStatus | "all" = workflowStatus
  ) => {
    setState({ status: "loading" });
    const response = await api.search({
      q,
      store: activeStore !== "all" ? activeStore : undefined,
      type: activeType !== "all" ? activeType : undefined,
      status: activeStatus !== "all" ? activeStatus : undefined,
      limit: 100
    });

    if (!response.ok) {
      setState({ status: "error", message: response.error });
      return;
    }

    setState({
      status: "ready",
      records: response.records,
      facets: response.facets
    });
  }, [api, store, type, workflowStatus]);

  useEffect(() => {
    void refreshSavedViews();
    void loadRecords(searchParams.get("q") || "", store, type, workflowStatus);
  }, [loadRecords, refreshSavedViews, searchParams, store, type, workflowStatus]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (store !== "all") params.set("store", store);
    if (type !== "all") params.set("type", type);
    if (workflowStatus !== "all") params.set("status", workflowStatus);
    if (viewMode !== "grid") params.set("view", viewMode);
    if (itemSize !== "compact") params.set("size", itemSize);
    if (sortField !== "updatedAt") params.set("sort", sortField);
    if (sortDirection !== "desc") params.set("dir", sortDirection);

    const next = params.toString();
    router.replace(next ? `/archive?${next}` : "/archive", { scroll: false });
  }, [itemSize, query, router, sortDirection, sortField, store, type, viewMode, workflowStatus]);

  const records = state.status === "ready" ? state.records : [];
  const facets = state.status === "ready" ? state.facets : undefined;
  const storeOptions = useMemo(() => facets?.stores?.map((item) => item.value) ?? getUniqueValues(records, "store"), [facets?.stores, records]);
  const typeOptions = useMemo(() => facets?.types?.map((item) => item.value) ?? getUniqueValues(records, "type"), [facets?.types, records]);

  const statusCounts = useMemo(() => {
    const counts: Record<WorkflowStatus, number> = { draft: 0, editing: 0, review: 0, approved: 0, published: 0, archived: 0 };
    records.forEach((record) => {
      counts[getRecordWorkflowStatus(record)] += 1;
    });
    return counts;
  }, [records]);

  const visibleRecords = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    const filtered = records.filter((record) => {
      if (store !== "all" && record.store !== store) return false;
      if (type !== "all" && record.type !== type) return false;
      if (workflowStatus !== "all" && getRecordWorkflowStatus(record) !== workflowStatus) return false;
      if (!normalizedQuery) return true;
      return getRecordSearchText(record).includes(normalizedQuery);
    });

    return filtered.sort((a, b) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;
      if (sortField === "title") {
        return a.title.localeCompare(b.title, "ar") * multiplier;
      }

      return (getRecordTime(a, sortField) - getRecordTime(b, sortField)) * multiplier;
    });
  }, [query, records, sortDirection, sortField, store, type, workflowStatus]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const previewRecord = useMemo(() => {
    if (previewId) {
      return visibleRecords.find((record) => record.id === previewId) || visibleRecords[0] || null;
    }

    return visibleRecords.find((record) => selectedIdSet.has(record.id)) || visibleRecords[0] || null;
  }, [previewId, selectedIdSet, visibleRecords]);

  const activeFilterCount = [
    query.trim(),
    store !== "all",
    type !== "all",
    workflowStatus !== "all",
    sortField !== "updatedAt",
    sortDirection !== "desc"
  ].filter(Boolean).length;

  const handleSearch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await loadRecords(query, store, type, workflowStatus);
  };

  // Click sets a new anchor and selects only that record; shift+click selects
  // the contiguous range (in current visual order) between the anchor and the
  // clicked record; ctrl/cmd+click toggles the clicked record without
  // disturbing the rest of the selection.
  const handleSelectClick = (recordId: string, modifiers: SelectClickModifiers) => {
    const { selectedIds: nextSelected, anchorId: nextAnchor } = resolveGridSelectionClick(
      visibleRecords.map((record) => record.id),
      selectedIds,
      selectionAnchorId,
      recordId,
      modifiers
    );
    setSelectedIds(nextSelected);
    setSelectionAnchorId(nextAnchor);
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((current) => {
      const allVisibleSelected = visibleRecords.length > 0 && visibleRecords.every((record) => current.includes(record.id));
      return allVisibleSelected ? [] : visibleRecords.map((record) => record.id);
    });
  };
  const archiveColumns = useMemo<Array<ColumnDef<ArchiveRecord, unknown>>>(
    () => [
      {
        id: "select",
        header: () => (
          <input
            type="checkbox"
            aria-label="تحديد كل النتائج الظاهرة"
            checked={visibleRecords.length > 0 && visibleRecords.every((record) => selectedIdSet.has(record.id))}
            onChange={toggleSelectAllVisible}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`تحديد ${row.original.title || "السجل"}`}
            checked={selectedIdSet.has(row.original.id)}
            onClick={(e) => {
              e.preventDefault();
              handleSelectClick(row.original.id, e);
            }}
            onChange={() => {}}
          />
        ),
        enableSorting: false
      },
      {
        accessorKey: "title",
        header: "العنوان",
        cell: ({ row }) => (
          <a
            className="text-accent"
            href={`/archive/${encodeURIComponent(row.original.id)}`}
            onMouseEnter={() => setPreviewId(row.original.id)}
          >
            {row.original.title || "بدون عنوان"}
          </a>
        )
      },
      {
        accessorKey: "store",
        header: "المخزن",
        cell: ({ row }) => row.original.store || "غير محدد"
      },
      {
        accessorKey: "type",
        header: "النوع",
        cell: ({ row }) => row.original.type || "غير محدد"
      },
      {
        id: "updated",
        header: "آخر تحديث",
        accessorFn: (record) => record.updatedAt || record.createdAt || "",
        cell: ({ row }) => formatDate(row.original.updatedAt || row.original.createdAt)
      },
      {
        id: "actions",
        header: "إجراء",
        cell: ({ row }) => (
          <button type="button" className="badge" onClick={() => setPreviewId(row.original.id)}>
            معاينة
          </button>
        ),
        enableSorting: false
      }
    ],
    [selectedIdSet, visibleRecords]
  );

  const resetFilters = () => {
    setQuery("");
    setStore("all");
    setType("all");
    setWorkflowStatus("all");
    setSortField("updatedAt");
    setSortDirection("desc");
    setSelectedIds([]);
    setPreviewId(null);
  };

  const saveCurrentView = async () => {
    const name = await dialogs.prompt({ title: "حفظ العرض", message: "اسم العرض المحفوظ" });
    if (!name?.trim()) return;

    setSavedViewStatus("جار حفظ العرض...");
    const response = await api.createSavedSearch({
      name: name.trim(),
      query: query || undefined,
      filters: {
        viewKind: "archive-view",
        store,
        type,
        status: workflowStatus,
        viewMode,
        itemSize,
        sortField,
        sortDirection
      }
    });

    if (!response.ok) {
      const message = response.error || "تعذر حفظ العرض.";
      setSavedViewStatus(message);
      toastError(message);
      return;
    }

    await refreshSavedViews();
    setSavedViewStatus("تم حفظ العرض.");
    toastSuccess("تم حفظ العرض.");
  };

  const applySavedView = (view: SavedArchiveView) => {
    setQuery(view.query);
    setStore(view.store);
    setType(view.type);
    setWorkflowStatus(view.status ?? "all");
    setViewMode(view.viewMode);
    setItemSize(view.itemSize);
    setSortField(view.sortField);
    setSortDirection(view.sortDirection);
    setSelectedIds([]);
    void loadRecords(view.query, view.store, view.type, view.status);
  };

  const removeSavedView = async (viewId: string) => {
    const response = await api.deleteSavedSearch(viewId);
    if (!response.ok) {
      setSavedViewStatus(response.error || "تعذر حذف العرض.");
      return;
    }

    await refreshSavedViews();
  };

  // Bulk edits mutate the selected records client-side, then upsert via
  // POST /records/bulk (updateOrInsert keyed on uid/id — see RecordsController::bulk).
  const applyBulkPatch = async (patch: (record: ArchiveRecord) => ArchiveRecord, successMessage: string) => {
    if (selectedIds.length === 0 || bulkBusy) return;
    const selectedRecords = records.filter((record) => selectedIdSet.has(record.id));
    if (selectedRecords.length === 0) return;

    const byStore = new Map<string, ArchiveRecord[]>();
    for (const record of selectedRecords) {
      const storeKey = record.store || "default";
      const patched = patch(record);
      byStore.set(storeKey, [...(byStore.get(storeKey) || []), patched]);
    }

    setBulkBusy(true);
    setBulkFeedback(null);

    // Optimistic UI: reflect the patch immediately in local state.
    const patchedById = new Map(selectedRecords.map((record) => [record.id, patch(record)]));
    setState((current) => current.status === "ready"
      ? { status: "ready", records: current.records.map((record) => patchedById.get(record.id) || record) }
      : current);

    try {
      for (const [storeKey, storeRecords] of byStore) {
        const response = await api.bulkRecords({ store: storeKey, records: storeRecords });
        if (!response.ok) {
          setBulkFeedback({ kind: "error", message: response.error });
          await loadRecords(query);
          return;
        }
      }
      setBulkFeedback({ kind: "success", message: successMessage });
      await loadRecords(query);
    } catch (error) {
      setBulkFeedback({ kind: "error", message: error instanceof Error ? error.message : "تعذر تنفيذ الإجراء الجماعي" });
      await loadRecords(query);
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkAddTag = async () => {
    const tag = await dialogs.prompt({ title: "إضافة وسم", message: "أضف وسمًا للسجلات المحددة" });
    if (!tag?.trim()) return;
    const trimmedTag = tag.trim();
    await applyBulkPatch(
      (record) => ({ ...record, tags: Array.from(new Set([...(record.tags || []), trimmedTag])) }),
      `تمت إضافة الوسم "${trimmedTag}" إلى ${selectedIds.length} سجل`
    );
  };

  const bulkSetType = async () => {
    const nextType = await dialogs.prompt({ title: "تغيير النوع", message: "النوع الجديد للسجلات المحددة" });
    if (!nextType?.trim()) return;
    const trimmedType = nextType.trim();
    await applyBulkPatch(
      (record) => ({ ...record, type: trimmedType }),
      `تم تعيين النوع "${trimmedType}" لـ ${selectedIds.length} سجل`
    );
  };

  const bulkDelete = async () => {
    if (selectedIds.length === 0 || bulkBusy) return;
    const selectedRecords = records.filter((record) => selectedIdSet.has(record.id));
    if (selectedRecords.length === 0) return;

    const confirmed = await dialogs.confirm({
      title: "حذف نهائي",
      message: `تحذير: سيتم حذف ${selectedRecords.length} سجل نهائيًا من الأرشيف ولا يمكن التراجع عن هذا الإجراء. هل أنت متأكد من المتابعة؟`,
      confirmLabel: "حذف نهائيًا",
      destructive: true
    });
    if (!confirmed) return;

    const idsByStore = new Map<string, string[]>();
    for (const record of selectedRecords) {
      const storeKey = record.store || "default";
      idsByStore.set(storeKey, [...(idsByStore.get(storeKey) || []), record.id]);
    }

    setBulkBusy(true);
    setBulkFeedback(null);

    try {
      let deletedCount = 0;
      const failedUids: string[] = [];

      for (const [storeKey, storeIds] of idsByStore) {
        const response = await api.bulkDeleteRecords({ store: storeKey, ids: storeIds });
        if (!response.ok) {
          setBulkFeedback({ kind: "error", message: response.error || "تعذر تنفيذ الحذف الجماعي" });
          await loadRecords(query);
          return;
        }

        deletedCount += response.count;
        failedUids.push(...response.results.filter((result) => !result.deleted).map((result) => result.uid));
      }

      if (failedUids.length > 0) {
        const message = `تم حذف ${deletedCount} سجل، وتعذر حذف ${failedUids.length}: ${failedUids.join("، ")}`;
        setBulkFeedback({ kind: "error", message });
        toastError(message);
      } else {
        setBulkFeedback({ kind: "success", message: `تم حذف ${deletedCount} سجل نهائيًا` });
        toastSuccess(`تم حذف ${deletedCount} سجل نهائيًا.`);
      }

      setSelectedIds([]);
      await loadRecords(query);
    } catch (error) {
      setBulkFeedback({ kind: "error", message: error instanceof Error ? error.message : "تعذر تنفيذ الحذف الجماعي" });
      await loadRecords(query);
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkSetStatus = async (nextStatus: WorkflowStatus) => {
    await applyBulkPatch(
      (record) => ({ ...record, workflowStatus: nextStatus }),
      `تم تعيين الحالة "${workflowStatusLabels[nextStatus]}" لـ ${selectedIds.length} سجل`
    );
  };

  const renderRecordCard = (record: ArchiveRecord) => (
    <ArchiveRecordCard
      key={record.id}
      record={record}
      itemSize={itemSize}
      isSelected={selectedIdSet.has(record.id)}
      onSelectClick={handleSelectClick}
      onPreview={setPreviewId}
    />
  );

  return (
    <AppShell subtitle="مركز السجلات" contentClassName="archive-content" tipsPage="archive">
      <PageToolbar
        icon={<Archive size={24} strokeWidth={2} />}
        eyebrow={<span className="badge">Archive Workspace</span>}
        title="الأرشيف"
        description="سطح عمل موحد للبحث والتصفية والمعاينة والإجراءات الجماعية على السجلات."
        meta={(
          <>
            <span className="badge">{visibleRecords.length} نتيجة</span>
            <span className="badge">{activeFilterCount} فلتر نشط</span>
            <span className="badge">{selectedIds.length} محدد</span>
          </>
        )}
        actions={(
          <>
            <a className="button button-primary" href="/uploads">إضافة للأرشيف</a>
            <a className="button button-secondary" href="/files">استيراد ملفات</a>
            <button type="button" className="button button-secondary" onClick={() => void saveCurrentView()}>حفظ العرض</button>
          </>
        )}
      >
        <form className="archive-toolbar-grid command-filter-grid" onSubmit={handleSearch}>
          <label>
            <span><Search aria-hidden="true" size={14} /> بحث</span>
            <input
              type="search"
              placeholder="العنوان، الوسوم، الوصف، metadata..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="search-input"
            />
          </label>
          <label>
            <span><FolderSearch aria-hidden="true" size={14} /> المخزن</span>
            <select value={store} onChange={(e) => setStore(e.target.value)}>
              <option value="all">كل المخازن</option>
              {storeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span><Filter aria-hidden="true" size={14} /> النوع</span>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">كل الأنواع</option>
              {typeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span><SlidersHorizontal aria-hidden="true" size={14} /> الفرز</span>
            <select value={sortField} onChange={(e) => setSortField(e.target.value as ArchiveSortField)}>
              {Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>الاتجاه</span>
            <select value={sortDirection} onChange={(e) => setSortDirection(e.target.value as ArchiveSortDirection)}>
              <option value="desc">الأحدث أولاً</option>
              <option value="asc">الأقدم أولاً</option>
            </select>
          </label>
          <div className="archive-toolbar-actions">
            <button type="submit" className="button button-primary">تحديث</button>
            <button type="button" className="button button-secondary" onClick={resetFilters}>تصفير</button>
          </div>
        </form>
        <div className="archive-toolbar-row" role="group" aria-label="تصفية حسب حالة سير العمل">
          <button
            type="button"
            className={`badge ${styles.filterChip}`}
            data-active={workflowStatus === "all" ? "true" : "false"}
            onClick={() => setWorkflowStatus("all")}
          >
            الكل · {records.length}
          </button>
          {WORKFLOW_STATES.filter((s) => statusCounts[s] > 0).map((s) => (
            <button
              key={s}
              type="button"
              className={`badge ${styles.filterChip}`}
              data-active={workflowStatus === s ? "true" : "false"}
              onClick={() => setWorkflowStatus(workflowStatus === s ? "all" : s)}
            >
              {workflowStatusLabels[s]} · {statusCounts[s]}
            </button>
          ))}
        </div>
        <div className="archive-toolbar-row">
          <DataViewSwitcher value={viewMode} options={viewOptions} onChange={setViewMode} />
          <DataViewSwitcher value={itemSize} options={itemSizeOptions} onChange={setItemSize} label="كثافة العناصر" />
          {savedViews.length > 0 ? (
            <div className="saved-views-strip" aria-label="العروض المحفوظة">
              {savedViews.map((view) => (
                <span key={view.id} className="saved-view-chip">
                  <button type="button" onClick={() => applySavedView(view)}>{view.name}</button>
                  <button type="button" aria-label={`حذف ${view.name}`} onClick={() => void removeSavedView(view.id)}>×</button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {savedViewStatus ? <p className="form-status">{savedViewStatus}</p> : null}
      </PageToolbar>

      {selectedIds.length > 0 ? (
        <div className={`bulk-action-bar ${bulkBusy ? styles.bulkBarBusy : ""}`} role="status">
          <strong>{selectedIds.length} سجل محدد</strong>
          <div className="button-row">
            <button type="button" className="button button-secondary" onClick={toggleSelectAllVisible}>تحديد الظاهر</button>
            <button type="button" className="button button-secondary" onClick={bulkAddTag} disabled={bulkBusy}>إضافة وسم</button>
            <button type="button" className="button button-secondary" onClick={bulkSetType} disabled={bulkBusy}>تعيين النوع</button>
            <label className="archive-toolbar-actions" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
              <span className="helper-text">تعيين الحالة</span>
              <select
                disabled={bulkBusy}
                defaultValue=""
                onChange={(e) => {
                  const nextStatus = e.target.value as WorkflowStatus;
                  e.target.value = "";
                  if (nextStatus) void bulkSetStatus(nextStatus);
                }}
              >
                <option value="" disabled>اختر حالة...</option>
                {WORKFLOW_STATES.map((s) => (
                  <option key={s} value={s}>{workflowStatusLabels[s]}</option>
                ))}
              </select>
            </label>
            <a className="button button-secondary" href={`/archive/${encodeURIComponent(selectedIds[0])}`}>فتح الأول</a>
            <button type="button" className="button button-secondary" onClick={() => setSelectedIds([])}>إلغاء التحديد</button>
            <button type="button" className="button button-danger" onClick={() => void bulkDelete()} disabled={bulkBusy}>
              حذف المحدد ({selectedIds.length})
            </button>
          </div>
        </div>
      ) : null}

      {bulkFeedback ? (
        <div className={`state-banner ${bulkFeedback.kind === "success" ? "state-banner-success" : "state-banner-error"}`} role="status">
          <strong>{bulkFeedback.kind === "success" ? "تم تنفيذ الإجراء الجماعي" : "تعذر تنفيذ الإجراء الجماعي"}</strong>
          <span className="helper-text">{bulkFeedback.message}</span>
        </div>
      ) : null}

      {state.status === "loading" ? (
        <div className="panel panel-compact" aria-live="polite" role="status">
          <Skeleton label="جار تحميل السجلات..." />
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل السجلات</strong>
          <span className="helper-text">{state.message}</span>
        </div>
      ) : null}

        {state.status === "ready" ? (
        visibleRecords.length === 0 ? (
          <EmptyState
            icon={<PanelRightOpen size={22} />}
            title="لا توجد سجلات مطابقة."
            description="خفف الفلاتر أو اترك البحث فارغاً لعرض أحدث السجلات من الخادم."
            actions={<button type="button" className="button button-secondary" onClick={resetFilters}>تصفير الفلاتر</button>}
          />
        ) : (
          <section className="archive-workspace" data-view={viewMode} aria-label="نتائج الأرشيف">
            <div className="records-surface" data-view={viewMode} data-size={itemSize} role={viewMode === "details" ? undefined : "list"}>
              {viewMode === "details" ? (
                <DataTable
                  ariaLabel="جدول نتائج الأرشيف"
                  columns={archiveColumns}
                  data={visibleRecords}
                  emptyMessage="لا توجد سجلات مطابقة."
                  getRowId={(record) => record.id}
                  tableClassName="archive-table"
                  virtualized={visibleRecords.length > 60}
                />
              ) : (
                visibleRecords.map(renderRecordCard)
              )}
            </div>

            <aside className="record-preview-rail" aria-label="معاينة السجل">
              {previewRecord ? (
                <>
                  <div className="panel-section-header">
                    <span className="badge"><PanelRightOpen aria-hidden="true" size={14} /> معاينة</span>
                    <h2>{previewRecord.title || "بدون عنوان"}</h2>
                  </div>
                  <p>{previewRecord.description || "لا يوجد وصف محفوظ لهذا السجل بعد."}</p>
                  <div className="kv-grid">
                    <div className="kv-item">
                      <strong>المخزن</strong>
                      <span>{previewRecord.store || "غير محدد"}</span>
                    </div>
                    <div className="kv-item">
                      <strong>النوع</strong>
                      <span>{previewRecord.type || "غير محدد"}</span>
                    </div>
                    <div className="kv-item">
                      <strong>الإنشاء</strong>
                      <span>{formatDate(previewRecord.createdAt)}</span>
                    </div>
                    <div className="kv-item">
                      <strong>التحديث</strong>
                      <span>{formatDate(previewRecord.updatedAt)}</span>
                    </div>
                  </div>
                  {previewRecord.tags && previewRecord.tags.length > 0 ? (
                    <div className="tags">
                      {previewRecord.tags.map((tag) => <span key={tag} className="tag">{tag}</span>)}
                    </div>
                  ) : null}
                  {previewRecord.metadata && Object.keys(previewRecord.metadata).length > 0 ? (
                    <pre className="token-preview">{JSON.stringify(previewRecord.metadata, null, 2)}</pre>
                  ) : null}
                  <div className="button-row">
                    <a className="button button-primary" href={`/archive/${encodeURIComponent(previewRecord.id)}`}>فتح التفاصيل</a>
                    <a className="button button-secondary" href={`/search?q=${encodeURIComponent(previewRecord.title || "")}`}>بحث مشابه</a>
                  </div>
                </>
              ) : (
                <EmptyState title="لا توجد معاينة." description="اختر سجلاً من النتائج لعرض تفاصيله السريعة هنا." />
              )}
            </aside>
          </section>
        )
      ) : null}
    </AppShell>
  );
}

export default function ArchivePage() {
  return (
    <Suspense fallback={(
      <AppShell subtitle="مركز السجلات" contentClassName="archive-content">
        <div className="panel panel-compact" role="status">
          <p className="form-status">جار تجهيز الأرشيف...</p>
        </div>
      </AppShell>
    )}>
      <ArchivePageContent />
    </Suspense>
  );
}
