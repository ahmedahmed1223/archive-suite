"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { DragEvent, FormEvent, MouseEvent as ReactMouseEvent } from "react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, Filter, FolderSearch, PanelRightOpen, Search, SlidersHorizontal } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { ArchiveRecordCard } from "./ArchiveRecordCard";
import { BulkMacroRecorder } from "./_components/BulkMacroRecorder";
import { selectedBulkMacroTargets } from "./_components/bulk-macro-helpers";
import DataTable from "@/components/ui/DataTable";
import DataViewSwitcher, { type DataViewOption } from "@/components/DataViewSwitcher";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { useCapability } from "@/components/RoleGate";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { createArchiveApiClient, type ArchiveRecord, type SavedSearch, type SearchFacets } from "@/lib/archive-api";
import { useAuthSession } from "@/lib/auth-session";
import { readPersistedViewState, writePersistedViewState } from "@/lib/persisted-view-state";
import { toastError, toastSuccess } from "@/lib/toast";
import { canRedo, canUndo, emptyUndoStack, pushUndo, redo, undo, type UndoStack } from "@/lib/undo-stack";
import { MOBILE_VIEWPORT_QUERY, matchesMediaQuery } from "@/lib/use-media-query";
import { isIncompleteRecord } from "@/lib/work-lists";
import { readWorkspacePreferences, updateWorkspacePreferences, WORKSPACE_PREFERENCES_STORAGE_KEY } from "@/lib/workspace-preferences";
import styles from "./archive.module.css";
import { Skeleton } from "@/components/ui/Skeleton";
import { movePinnedFilter, orderPinnedFilters } from "@/lib/pinned-filters";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useDisplaySettings } from "@/lib/display-settings-context";
import { formatDate as formatDisplayDate, DEFAULT_DISPLAY_SETTINGS, type DisplaySettings } from "@/lib/display-settings";
import type { AppLocale } from "@/lib/i18n/types";

// V1-732B: one entry per bulk-delete batch, so several consecutive deletes
// are each independently undoable/redoable via lib/undo-stack.ts, not just
// the single most recent one.
interface DeleteBatch {
  idsByStore: Map<string, string[]>;
  count: number;
}

// Workflow states mirrored from the legacy SPA's itemStatus state machine —
// the server-authoritative state machine. The Laravel search/records endpoints
// do not expose a status column or query param (verified against
// SearchController/RecordsController), so this is a client-side facet only:
// it reads `record.workflowStatus` when present, defaulting to "draft".
type WorkflowStatus = "draft" | "editing" | "review" | "approved" | "published" | "archived";

const WORKFLOW_STATES: WorkflowStatus[] = ["draft", "editing", "review", "approved", "published", "archived"];

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

export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function rectsIntersect(a: RectLike, b: RectLike): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

// Pure geometry for rubber-band drag-select (V1-745): given the drag
// rectangle and each visible card's bounding box, returns the ids under the
// rectangle. Additive mode (shift/ctrl/cmd held at drag start) unions the
// hits with the selection that existed before the drag began, instead of
// replacing it. Framework-free so it is directly unit-testable.
export function computeDragSelectedIds(
  selectionRect: RectLike,
  cardRects: Array<{ id: string; rect: RectLike }>,
  baseSelectedIds: string[],
  additive: boolean
): string[] {
  const hitIds = cardRects.filter((card) => rectsIntersect(selectionRect, card.rect)).map((card) => card.id);
  if (!additive) return hitIds;
  const merged = new Set(baseSelectedIds);
  hitIds.forEach((id) => merged.add(id));
  return Array.from(merged);
}

type ArchiveViewMode = "grid" | "gallery" | "compact" | "list" | "details" | "split";
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

// Value-only lists for module-scope validation (URL/localStorage restore
// functions below run outside the component and have no access to `t`);
// the translated label/shortLabel pairs are built inside the component from
// these values.
const VIEW_MODE_VALUES: ArchiveViewMode[] = ["grid", "gallery", "compact", "list", "details", "split"];
const ITEM_SIZE_VALUES: ArchiveItemSize[] = ["compact", "comfortable", "large"];
const SORT_FIELD_VALUES: ArchiveSortField[] = ["updatedAt", "createdAt", "title"];

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

// Mirrors UploadForm.tsx's suggestedType() so files dropped directly on the
// archive page get a sane default type without a metadata step.
function inferRecordTypeFromFile(file: File) {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.includes("pdf") || file.type.startsWith("text/")) return "document";
  return "file";
}

export function formatDate(value: string | undefined, notSpecifiedLabel: string, settings: DisplaySettings = DEFAULT_DISPLAY_SETTINGS, locale: AppLocale = "ar") {
  return formatDisplayDate(value, settings, locale, value || notSpecifiedLabel);
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
  if (VIEW_MODE_VALUES.includes(value as ArchiveViewMode)) {
    return value as ArchiveViewMode;
  }

  if (matchesMediaQuery(MOBILE_VIEWPORT_QUERY)) {
    return "list";
  }

  return "grid";
}

function getInitialItemSize(params: URLSearchParams): ArchiveItemSize {
  const value = params.get("size");
  return ITEM_SIZE_VALUES.includes(value as ArchiveItemSize) ? (value as ArchiveItemSize) : "compact";
}

function getInitialSortField(params: URLSearchParams): ArchiveSortField {
  const value = params.get("sort");
  return value === "createdAt" || value === "title" ? value : "updatedAt";
}

function getInitialStatus(params: URLSearchParams): WorkflowStatus | "all" {
  const value = params.get("status");
  return value && (WORKFLOW_STATES as string[]).includes(value) ? (value as WorkflowStatus) : "all";
}

function getInitialCompletion(params: URLSearchParams): boolean {
  return params.get("completion") === "incomplete";
}

function savedFilter(search: SavedSearch, key: string) {
  const value = search.filters?.[key];
  return typeof value === "string" ? value : "";
}

function isSavedArchiveView(search: SavedSearch) {
  return savedFilter(search, "viewKind") === "archive-view";
}

const ARCHIVE_VIEW_STATE_PAGE = "/archive";

interface ArchivePersistedViewState {
  sortField?: ArchiveSortField;
  sortDirection?: ArchiveSortDirection;
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
  const { locale, t } = useLocale();
  const listSeparator = locale === "en" ? ", " : "، ";
  const { settings: displaySettings } = useDisplaySettings();
  const workflowStatusLabels = t.pages.archiveList.workflowStatus;
  const sortLabels = t.pages.archiveList.sortFields;
  const viewOptions = useMemo<DataViewOption<ArchiveViewMode>[]>(
    () => VIEW_MODE_VALUES.map((value) => ({
      value,
      label: t.pages.archiveList.viewModes[value].label,
      shortLabel: t.pages.archiveList.viewModes[value].shortLabel
    })),
    [t]
  );
  const itemSizeOptions = useMemo<DataViewOption<ArchiveItemSize>[]>(
    () => ITEM_SIZE_VALUES.map((value) => ({ value, label: t.pages.archiveList.itemSizes[value] })),
    [t]
  );
  const dialogs = useConfirmDialog();
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = useMemo(() => createArchiveApiClient(), []);
  const { user, status: authStatus, accessToken } = useAuthSession();
  const userId = user?.id ?? null;
  const canCreateRecords = useCapability("records.create");
  const canEditRecords = useCapability("records.edit");
  const canBulkDelete = useCapability("records.bulkDelete");
  const hasRestoredViewState = useRef(false);

  const [state, setState] = useState<ArchiveState>({ status: "loading" });
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [store, setStore] = useState(() => searchParams.get("store") || "all");
  const [type, setType] = useState(() => searchParams.get("type") || "all");
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | "all">(() => getInitialStatus(searchParams));
  const [incompleteOnly, setIncompleteOnly] = useState(() => getInitialCompletion(searchParams));
  const [viewMode, setViewMode] = useState<ArchiveViewMode>(() => getInitialViewMode(searchParams));
  const [itemSize, setItemSize] = useState<ArchiveItemSize>(() => getInitialItemSize(searchParams));
  const [sortField, setSortField] = useState<ArchiveSortField>(() => getInitialSortField(searchParams));
  const [sortDirection, setSortDirection] = useState<ArchiveSortDirection>(() => searchParams.get("dir") === "asc" ? "asc" : "desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [savedViews, setSavedViews] = useState<SavedArchiveView[]>([]);
  const [pinnedViewOrder, setPinnedViewOrder] = useState<string[]>([]);
  const [savedViewStatus, setSavedViewStatus] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [deleteStack, setDeleteStack] = useState<UndoStack<DeleteBatch>>(emptyUndoStack);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [dragSelectRect, setDragSelectRect] = useState<RectLike | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragSelectStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragSelectBaseRef = useRef<string[]>([]);
  const dragSelectAdditiveRef = useRef(false);

  const pinnedOrderKey = `archive.pinned-filters.order:${userId ?? "anonymous"}`;
  const orderedSavedViews = useMemo(() => orderPinnedFilters(savedViews, pinnedViewOrder), [pinnedViewOrder, savedViews]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(pinnedOrderKey) || "[]");
      setPinnedViewOrder(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
    } catch {
      setPinnedViewOrder([]);
    }
  }, [pinnedOrderKey]);

  const reorderPinnedView = (id: string, offset: -1 | 1) => {
    const completeOrder = orderedSavedViews.map((view) => view.id);
    const next = movePinnedFilter(completeOrder, id, offset);
    setPinnedViewOrder(next);
    window.localStorage.setItem(pinnedOrderKey, JSON.stringify(next));
  };

  useEffect(() => {
    if (searchParams.toString()) return;
    try {
      const saved = readWorkspacePreferences(window.localStorage.getItem(WORKSPACE_PREFERENCES_STORAGE_KEY)).routes["/archive"];
      if (!saved) return;
      if (saved.view && VIEW_MODE_VALUES.includes(saved.view as ArchiveViewMode)) setViewMode(saved.view as ArchiveViewMode);
      if (saved.density && ITEM_SIZE_VALUES.includes(saved.density as ArchiveItemSize)) setItemSize(saved.density);
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

  // Per-user sort/filter/view persistence (V1-752). Runs once the auth
  // session resolves so the storage key is scoped to the right user; URL
  // params still win over anything restored here.
  useEffect(() => {
    if (authStatus === "loading" || hasRestoredViewState.current) return;
    hasRestoredViewState.current = true;
    if (searchParams.toString()) return;
    const saved = readPersistedViewState<ArchivePersistedViewState>(userId, ARCHIVE_VIEW_STATE_PAGE);
    if (saved.sortField && (SORT_FIELD_VALUES as string[]).includes(saved.sortField)) setSortField(saved.sortField);
    if (saved.sortDirection === "asc" || saved.sortDirection === "desc") setSortDirection(saved.sortDirection);
  }, [authStatus, searchParams, userId]);

  useEffect(() => {
    if (authStatus === "loading") return;
    writePersistedViewState<ArchivePersistedViewState>(userId, ARCHIVE_VIEW_STATE_PAGE, { sortField, sortDirection });
  }, [authStatus, sortDirection, sortField, userId]);

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
      setSavedViewStatus(response.error || t.pages.archiveList.savedViewLoadError);
      return;
    }

    setSavedViews(response.searches.filter(isSavedArchiveView).map(savedArchiveViewFromSearch));
    setSavedViewStatus("");
  }, [api, t]);

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
    if (incompleteOnly) params.set("completion", "incomplete");
    if (viewMode !== "grid") params.set("view", viewMode);
    if (itemSize !== "compact") params.set("size", itemSize);
    if (sortField !== "updatedAt") params.set("sort", sortField);
    if (sortDirection !== "desc") params.set("dir", sortDirection);

    const next = params.toString();
    router.replace(next ? `/archive?${next}` : "/archive", { scroll: false });
  }, [incompleteOnly, itemSize, query, router, sortDirection, sortField, store, type, viewMode, workflowStatus]);

  const records = useMemo(() => (state.status === "ready" ? state.records : []), [state]);
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
      if (incompleteOnly && !isIncompleteRecord(record)) return false;
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
  }, [incompleteOnly, query, records, sortDirection, sortField, store, type, workflowStatus]);

  const incompleteCount = useMemo(() => records.filter(isIncompleteRecord).length, [records]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedMacroTargets = useMemo(() => selectedBulkMacroTargets(records, selectedIds), [records, selectedIds]);
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
    incompleteOnly,
    sortField !== "updatedAt",
    sortDirection !== "desc"
  ].filter(Boolean).length;

  const handleSearch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await loadRecords(query, store, type, workflowStatus);
  };

  // Uploads one dropped file and creates its archive record, mirroring
  // UploadForm.tsx's uploadOne()/buildArchiveRecord() (quick-mode shape: no
  // wizard metadata, title falls back to the uploaded file name).
  const uploadDroppedFile = async (file: File) => {
    const auth = accessToken ? { accessToken } : undefined;
    const uploaded = await api.uploadFile(file, undefined, auth);
    if (!uploaded.ok) {
      return { status: "error" as const, fileName: file.name, message: uploaded.error };
    }

    const record: ArchiveRecord = {
      ...uploaded.record,
      uid: uploaded.record.uid || uploaded.record.id,
      title: uploaded.record.fileName || file.name,
      type: inferRecordTypeFromFile(file),
      tags: [],
      metadata: {
        originalFileName: file.name,
        mimeType: file.type || undefined,
        fileSize: file.size,
        checksum: uploaded.record.checksum,
        filePath: uploaded.record.filePath,
        source: "archive-drop"
      },
      updatedAt: new Date().toISOString()
    };

    const saved = await api.bulkRecords({ store: "archive-items", records: [record] }, auth);
    if (!saved.ok) {
      return { status: "error" as const, fileName: file.name, message: saved.error };
    }

    return { status: "success" as const, fileName: file.name };
  };

  // Lets an operator drop files anywhere on the archive page to add them,
  // not just on /uploads (V1-716). Only reacts to OS file drags
  // (dataTransfer.types includes "Files") so it never intercepts a future
  // in-page drag interaction on the cards themselves.
  const handleArchiveDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!canCreateRecords) return;
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setIsDraggingFile(true);
  };

  const handleArchiveDragLeave = () => setIsDraggingFile(false);

  const handleArchiveDrop = async (event: DragEvent<HTMLDivElement>) => {
    if (!canCreateRecords) return;
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setIsDraggingFile(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length === 0) return;

    // ponytail: uploads run in parallel with no concurrency cap; add a
    // batch limit if operators start dropping large batches of large files.
    const results = await Promise.all(files.map(uploadDroppedFile));
    const succeeded = results.filter((result) => result.status === "success").length;
    const failed = results.filter((result) => result.status === "error");

    if (succeeded > 0) {
      toastSuccess(succeeded === 1 ? t.pages.archiveList.uploadSuccessOne : t.pages.archiveList.uploadSuccessMany.replace("{count}", String(succeeded)));
      await loadRecords(query);
    }
    if (failed.length > 0) {
      toastError(failed.map((result) => `${result.fileName}: ${result.message}`).join(listSeparator));
    }
  };

  // Click sets a new anchor and selects only that record; shift+click selects
  // the contiguous range (in current visual order) between the anchor and the
  // clicked record; ctrl/cmd+click toggles the clicked record without
  // disturbing the rest of the selection.
  const handleSelectClick = useCallback((recordId: string, modifiers: SelectClickModifiers) => {
    const { selectedIds: nextSelected, anchorId: nextAnchor } = resolveGridSelectionClick(
      visibleRecords.map((record) => record.id),
      selectedIds,
      selectionAnchorId,
      recordId,
      modifiers
    );
    setSelectedIds(nextSelected);
    setSelectionAnchorId(nextAnchor);
  }, [visibleRecords, selectedIds, selectionAnchorId]);

  // V1-745: rubber-band drag-select. Starts only on a mousedown over empty
  // surface space (not on a card, so plain/shift/ctrl clicks on cards keep
  // working via handleSelectClick above), and only in card-based views —
  // "details" is a DataTable with its own row selection, out of scope here.
  const DRAG_SELECT_THRESHOLD_PX = 4;

  const handleSurfaceMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (viewMode === "details" || viewMode === "split" || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-record-id]")) return;
    event.preventDefault();
    dragSelectStartRef.current = { x: event.clientX, y: event.clientY };
    dragSelectBaseRef.current = selectedIds;
    dragSelectAdditiveRef.current = event.shiftKey || event.ctrlKey || event.metaKey;
    setIsDragSelecting(true);
  };

  useEffect(() => {
    if (!isDragSelecting) return;

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      const start = dragSelectStartRef.current;
      if (!start) return;
      const rect: RectLike = {
        left: Math.min(start.x, event.clientX),
        top: Math.min(start.y, event.clientY),
        right: Math.max(start.x, event.clientX),
        bottom: Math.max(start.y, event.clientY)
      };
      setDragSelectRect(rect);

      if (rect.right - rect.left < DRAG_SELECT_THRESHOLD_PX && rect.bottom - rect.top < DRAG_SELECT_THRESHOLD_PX) return;

      const surface = surfaceRef.current;
      if (!surface) return;
      const cardRects = Array.from(surface.querySelectorAll<HTMLElement>("[data-record-id]")).map((el) => ({
        id: el.dataset.recordId as string,
        rect: el.getBoundingClientRect()
      }));
      setSelectedIds(computeDragSelectedIds(rect, cardRects, dragSelectBaseRef.current, dragSelectAdditiveRef.current));
      setSelectionAnchorId(null);
    };

    const handleMouseUp = () => {
      dragSelectStartRef.current = null;
      setDragSelectRect(null);
      setIsDragSelecting(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragSelecting]);

  const showDragSelectRect = dragSelectRect
    ? dragSelectRect.right - dragSelectRect.left >= DRAG_SELECT_THRESHOLD_PX || dragSelectRect.bottom - dragSelectRect.top >= DRAG_SELECT_THRESHOLD_PX
    : false;

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds((current) => {
      const allVisibleSelected = visibleRecords.length > 0 && visibleRecords.every((record) => current.includes(record.id));
      return allVisibleSelected ? [] : visibleRecords.map((record) => record.id);
    });
  }, [visibleRecords]);
  const archiveColumns = useMemo<Array<ColumnDef<ArchiveRecord, unknown>>>(
    () => [
      {
        id: "select",
        header: () => (
          <input
            type="checkbox"
            aria-label={t.pages.archiveList.selectAllVisible}
            checked={visibleRecords.length > 0 && visibleRecords.every((record) => selectedIdSet.has(record.id))}
            onChange={toggleSelectAllVisible}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={t.pages.archiveList.selectRecord.replace("{title}", row.original.title || t.pages.archiveList.fallbackRecordLabel)}
            checked={selectedIdSet.has(row.original.id)}
            onClick={(e) => {
              handleSelectClick(row.original.id, {
                shiftKey: e.shiftKey,
                ctrlKey: e.ctrlKey || (selectedIdSet.has(row.original.id) && !e.shiftKey && !e.metaKey),
                metaKey: e.metaKey
              });
            }}
            onChange={() => {}}
          />
        ),
        enableSorting: false
      },
      {
        accessorKey: "title",
        header: t.pages.archiveList.sortFields.title,
        cell: ({ row }) => (
          <a
            className="text-accent"
            href={`/archive/${encodeURIComponent(row.original.id)}`}
            onMouseEnter={() => setPreviewId(row.original.id)}
          >
            {row.original.title || t.pages.archiveList.untitled}
          </a>
        )
      },
      {
        accessorKey: "store",
        header: t.pages.archiveList.storeLabel,
        cell: ({ row }) => row.original.store || t.pages.archiveList.notSpecified
      },
      {
        accessorKey: "type",
        header: t.pages.archiveList.typeLabel,
        cell: ({ row }) => row.original.type || t.pages.archiveList.notSpecified
      },
      {
        id: "updated",
        header: t.pages.archiveList.sortFields.updatedAt,
        accessorFn: (record) => record.updatedAt || record.createdAt || "",
        cell: ({ row }) => formatDate(row.original.updatedAt || row.original.createdAt, t.pages.archiveList.notSpecified, displaySettings, locale)
      },
      {
        id: "actions",
        header: t.pages.archiveList.columnAction,
        cell: ({ row }) => (
          <button type="button" className="badge" onClick={() => setPreviewId(row.original.id)}>
            {t.pages.archiveList.preview}
          </button>
        ),
        enableSorting: false
      }
    ],
    [selectedIdSet, visibleRecords, handleSelectClick, toggleSelectAllVisible, t, displaySettings, locale]
  );

  const resetFilters = () => {
    setQuery("");
    setStore("all");
    setType("all");
    setWorkflowStatus("all");
    setIncompleteOnly(false);
    setSortField("updatedAt");
    setSortDirection("desc");
    setSelectedIds([]);
    setPreviewId(null);
  };

  const saveCurrentView = async () => {
    const name = await dialogs.prompt({ title: t.pages.archiveList.saveViewDialogTitle, message: t.pages.archiveList.saveViewDialogMessage });
    if (!name?.trim()) return;

    setSavedViewStatus(t.pages.archiveList.savingView);
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
      const message = response.error || t.pages.archiveList.saveViewError;
      setSavedViewStatus(message);
      toastError(message);
      return;
    }

    await refreshSavedViews();
    setSavedViewStatus(t.pages.archiveList.saveViewSuccess);
    toastSuccess(t.pages.archiveList.saveViewSuccess);
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
      setSavedViewStatus(response.error || t.pages.archiveList.removeViewError);
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
      setBulkFeedback({ kind: "error", message: error instanceof Error ? error.message : t.pages.archiveList.bulkActionGenericError });
      await loadRecords(query);
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkAddTag = async () => {
    const tag = await dialogs.prompt({ title: t.pages.archiveList.addTagLabel, message: t.pages.archiveList.addTagDialogMessage });
    if (!tag?.trim()) return;
    const trimmedTag = tag.trim();
    await applyBulkPatch(
      (record) => ({ ...record, tags: Array.from(new Set([...(record.tags || []), trimmedTag])) }),
      t.pages.archiveList.addTagSuccess.replace("{tag}", trimmedTag).replace("{count}", String(selectedIds.length))
    );
  };

  const bulkSetType = async () => {
    const nextType = await dialogs.prompt({ title: t.pages.archiveList.setTypeDialogTitle, message: t.pages.archiveList.setTypeDialogMessage });
    if (!nextType?.trim()) return;
    const trimmedType = nextType.trim();
    await applyBulkPatch(
      (record) => ({ ...record, type: trimmedType }),
      t.pages.archiveList.setTypeSuccess.replace("{type}", trimmedType).replace("{count}", String(selectedIds.length))
    );
  };

  // V1-732B: a toast's onAction closure is created once and outlives the
  // render that created it, so reading `deleteStack` directly inside it
  // would see a stale value once another batch is pushed/undone in the
  // meantime (see hooks.md's stale-closure trap) - a ref kept in sync always
  // reads the latest stack instead.
  const deleteStackRef = useRef(deleteStack);
  useEffect(() => {
    deleteStackRef.current = deleteStack;
  }, [deleteStack]);

  async function restoreDeleteBatch(idsByStore: Map<string, string[]>): Promise<boolean> {
    const auth = accessToken ? { accessToken } : undefined;
    for (const [storeKey, storeIds] of idsByStore) {
      const restored = await api.restoreTrash({ store: storeKey, ids: storeIds }, auth);
      if (!restored.ok) {
        toastError(restored.error || t.pages.archiveList.undoRestoreError);
        return false;
      }
    }
    return true;
  }

  async function handleUndoDelete() {
    const result = undo(deleteStackRef.current);
    if (!result) return;
    const ok = await restoreDeleteBatch(result.entry.idsByStore);
    if (ok) {
      toastSuccess(t.pages.archiveList.undoRestoreSuccess);
      setDeleteStack(result.stack);
      await loadRecords(query);
    }
  }

  async function handleRedoDelete() {
    const result = redo(deleteStackRef.current);
    if (!result) return;
    for (const [storeKey, storeIds] of result.entry.idsByStore) {
      const response = await api.bulkDeleteRecords({ store: storeKey, ids: storeIds });
      if (!response.ok) {
        toastError(response.error || t.pages.archiveList.redoDeleteError);
        return;
      }
    }
    toastSuccess(t.pages.archiveList.redoDeleteSuccess.replace("{count}", String(result.entry.count)));
    setDeleteStack(result.stack);
    await loadRecords(query);
  }

  const bulkDelete = async () => {
    if (selectedIds.length === 0 || bulkBusy) return;
    const selectedRecords = records.filter((record) => selectedIdSet.has(record.id));
    if (selectedRecords.length === 0) return;

    const confirmed = await dialogs.confirm({
      title: t.pages.archiveList.deleteDialogTitle,
      message: t.pages.archiveList.deleteDialogMessage.replace("{count}", String(selectedRecords.length)),
      confirmLabel: t.pages.archiveList.deleteConfirmLabel,
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
          setBulkFeedback({ kind: "error", message: response.error || t.pages.archiveList.bulkDeleteGenericError });
          await loadRecords(query);
          return;
        }

        deletedCount += response.count;
        failedUids.push(...response.results.filter((result) => !result.deleted).map((result) => result.uid));
      }

      if (failedUids.length > 0) {
        const message = t.pages.archiveList.bulkDeletePartialFailure
          .replace("{deleted}", String(deletedCount))
          .replace("{failed}", String(failedUids.length))
          .replace("{uids}", failedUids.join(listSeparator));
        setBulkFeedback({ kind: "error", message });
        toastError(message);
      } else {
        setBulkFeedback({ kind: "success", message: t.pages.archiveList.bulkDeleteSuccess.replace("{count}", String(deletedCount)) });
        // V1-732B: push onto the real undo stack instead of only wiring a
        // one-shot toast action, so several consecutive delete batches stay
        // independently undoable/redoable (undo-stack.ts, same as kanban).
        setDeleteStack((stack) => pushUndo(stack, { idsByStore, count: deletedCount }));
        toastSuccess(`${t.pages.archiveList.bulkDeleteSuccess.replace("{count}", String(deletedCount))}.`, {
          label: t.pages.archiveList.undoAction,
          onAction: () => void handleUndoDelete()
        });
      }

      setSelectedIds([]);
      await loadRecords(query);
    } catch (error) {
      setBulkFeedback({ kind: "error", message: error instanceof Error ? error.message : t.pages.archiveList.bulkDeleteGenericError });
      await loadRecords(query);
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkSetStatus = async (nextStatus: WorkflowStatus) => {
    await applyBulkPatch(
      (record) => ({ ...record, workflowStatus: nextStatus }),
      t.pages.archiveList.setStatusSuccess.replace("{status}", workflowStatusLabels[nextStatus]).replace("{count}", String(selectedIds.length))
    );
  };

  const handleRenameRecord = async (recordId: string, newTitle: string) => {
    if (state.status !== "ready") return;
    const target = state.records.find((record) => record.id === recordId);
    if (!target) return;
    const previousRecords = state.records;
    const updated: ArchiveRecord = { ...target, title: newTitle, updatedAt: new Date().toISOString() };

    // Optimistic update; rolled back below on failure.
    setState((current) => current.status === "ready"
      ? { status: "ready", records: current.records.map((record) => (record.id === recordId ? updated : record)) }
      : current);

    try {
      const response = await api.bulkRecords({ store: target.store || "archive-items", records: [updated] });
      if (!response.ok) {
        setState((current) => current.status === "ready" ? { status: "ready", records: previousRecords } : current);
        toastError(response.error || t.pages.archiveList.renameError);
        return;
      }
      toastSuccess(t.pages.archiveList.renameSuccess);
    } catch (error) {
      setState((current) => current.status === "ready" ? { status: "ready", records: previousRecords } : current);
      toastError(error instanceof Error ? error.message : t.pages.archiveList.renameError);
    }
  };

  const renderRecordCard = (record: ArchiveRecord) => (
    <ArchiveRecordCard
      key={record.id}
      record={record}
      itemSize={itemSize}
      isSelected={selectedIdSet.has(record.id)}
      canEdit={canEditRecords}
      onSelectClick={handleSelectClick}
      onPreview={setPreviewId}
      onRename={handleRenameRecord}
    />
  );

  // V1-776: the detail content is identical whether it renders in the
  // always-present sibling `.record-preview-rail` (grid/gallery/compact/list
  // views) or nested inside the split view's own two-pane layout below —
  // extracted once so neither path can drift from the other.
  const renderPreviewDetailContent = () => (
    previewRecord ? (
      <>
        <div className="panel-section-header">
          <span className="badge"><PanelRightOpen aria-hidden="true" size={14} /> {t.pages.archiveList.preview}</span>
          <h2>{previewRecord.title || t.pages.archiveList.untitled}</h2>
        </div>
        <p>{previewRecord.description || t.pages.archiveList.noDescription}</p>
        <div className="kv-grid">
          <div className="kv-item">
            <strong>{t.pages.archiveList.storeLabel}</strong>
            <span>{previewRecord.store || t.pages.archiveList.notSpecified}</span>
          </div>
          <div className="kv-item">
            <strong>{t.pages.archiveList.typeLabel}</strong>
            <span>{previewRecord.type || t.pages.archiveList.notSpecified}</span>
          </div>
          <div className="kv-item">
            <strong>{t.pages.archiveList.kvCreated}</strong>
            <span>{formatDate(previewRecord.createdAt, t.pages.archiveList.notSpecified, displaySettings, locale)}</span>
          </div>
          <div className="kv-item">
            <strong>{t.pages.archiveList.kvUpdated}</strong>
            <span>{formatDate(previewRecord.updatedAt, t.pages.archiveList.notSpecified, displaySettings, locale)}</span>
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
          <a className="button button-primary" href={`/archive/${encodeURIComponent(previewRecord.id)}`}>{t.pages.archiveList.openDetails}</a>
          <a className="button button-secondary" href={`/search?q=${encodeURIComponent(previewRecord.title || "")}`}>{t.pages.archiveList.similarSearch}</a>
        </div>
      </>
    ) : (
      <EmptyState title={t.pages.archiveList.noPreviewTitle} description={t.pages.archiveList.noPreviewDescription} />
    )
  );

  // V1-776: compact clickable row for the split view's list pane — lighter
  // than ArchiveRecordCard (no per-card selection checkbox/context menu),
  // just enough to pick which record the persistent detail pane shows.
  const renderSplitListRow = (record: ArchiveRecord) => (
    <button
      key={record.id}
      type="button"
      className="split-list-row"
      data-active={previewRecord?.id === record.id ? "true" : "false"}
      data-record-id={record.id}
      onClick={() => setPreviewId(record.id)}
    >
      <span className="split-list-row__title">{record.title || t.pages.archiveList.untitled}</span>
      <span className="split-list-row__meta">
        {record.store ? <span className="badge">{record.store}</span> : null}
        {record.type ? <span className="badge">{record.type}</span> : null}
        <time className="created-at">{formatDate(record.updatedAt || record.createdAt, t.pages.archiveList.notSpecified, displaySettings, locale)}</time>
      </span>
    </button>
  );

  return (
    <AppShell subtitle={t.pageTitles.recordsCenter} contentClassName="archive-content" tipsPage="archive">
    <div
      className={styles.archiveDropzone}
      data-testid="archive-drop-zone"
      onDragOver={handleArchiveDragOver}
      onDragLeave={handleArchiveDragLeave}
      onDrop={handleArchiveDrop}
    >
      {isDraggingFile && (
        <div className={styles.dropOverlay}>
          <span>{t.pages.archiveList.dropOverlay}</span>
        </div>
      )}
      <PageToolbar
        icon={<Archive size={24} strokeWidth={2} />}
        eyebrow={<span className="badge">{t.pages.archiveList.eyebrow}</span>}
        title={t.pages.archiveList.pageTitle}
        description={t.pages.archiveList.pageDescription}
        meta={(
          <>
            <span className="badge">{t.pages.archiveList.resultsCount.replace("{count}", String(visibleRecords.length))}</span>
            <span className="badge">{t.pages.archiveList.activeFiltersCount.replace("{count}", String(activeFilterCount))}</span>
            <span className="badge">{t.pages.archiveList.selectedCount.replace("{count}", String(selectedIds.length))}</span>
          </>
        )}
        actions={(
          <>
            {canCreateRecords ? (
              <>
                <a className="button button-primary" href="/uploads">{t.pages.archiveList.addToArchive}</a>
                <a className="button button-secondary" href="/files">{t.pages.archiveList.importFiles}</a>
              </>
            ) : null}
            <button type="button" className="button button-secondary" onClick={() => void saveCurrentView()}>{t.pages.archiveList.saveView}</button>
          </>
        )}
      >
        <form className="archive-toolbar-grid command-filter-grid" onSubmit={handleSearch}>
          <label>
            <span><Search aria-hidden="true" size={14} /> {t.pages.archiveList.searchLabel}</span>
            <input
              type="search"
              placeholder={t.pages.archiveList.searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="search-input"
            />
          </label>
          <label>
            <span><FolderSearch aria-hidden="true" size={14} /> {t.pages.archiveList.storeLabel}</span>
            <select value={store} onChange={(e) => setStore(e.target.value)}>
              <option value="all">{t.pages.archiveList.allStores}</option>
              {storeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span><Filter aria-hidden="true" size={14} /> {t.pages.archiveList.typeLabel}</span>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">{t.pages.archiveList.allTypes}</option>
              {typeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span><SlidersHorizontal aria-hidden="true" size={14} /> {t.pages.archiveList.sortLabel}</span>
            <select value={sortField} onChange={(e) => setSortField(e.target.value as ArchiveSortField)}>
              {Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>{t.pages.archiveList.directionLabel}</span>
            <select value={sortDirection} onChange={(e) => setSortDirection(e.target.value as ArchiveSortDirection)}>
              <option value="desc">{t.pages.archiveList.newestFirst}</option>
              <option value="asc">{t.pages.archiveList.oldestFirst}</option>
            </select>
          </label>
          <div className="archive-toolbar-actions">
            <button type="submit" className="button button-primary">{t.pages.archiveList.refresh}</button>
            <button type="button" className="button button-secondary" onClick={resetFilters}>{t.pages.archiveList.reset}</button>
          </div>
        </form>
        <div className="archive-toolbar-row" role="group" aria-label={t.pages.archiveList.workflowFilterGroupLabel}>
          <button
            type="button"
            className={`badge ${styles.filterChip}`}
            data-active={workflowStatus === "all" ? "true" : "false"}
            onClick={() => setWorkflowStatus("all")}
          >
            {t.pages.archiveList.allStatusChip.replace("{count}", String(records.length))}
          </button>
          {WORKFLOW_STATES.filter((s) => statusCounts[s] > 0).map((s) => (
            <button
              key={s}
              type="button"
              className={`badge ${styles.filterChip}`}
              data-active={workflowStatus === s ? "true" : "false"}
              onClick={() => setWorkflowStatus(workflowStatus === s ? "all" : s)}
            >
              {t.pages.archiveList.statusChip.replace("{label}", workflowStatusLabels[s]).replace("{count}", String(statusCounts[s]))}
            </button>
          ))}
          {incompleteCount > 0 || incompleteOnly ? (
            <button
              type="button"
              className={`badge ${styles.filterChip}`}
              data-active={incompleteOnly ? "true" : "false"}
              aria-pressed={incompleteOnly}
              onClick={() => setIncompleteOnly(!incompleteOnly)}
            >
              {t.pages.archiveList.incompleteChip.replace("{count}", String(incompleteCount))}
            </button>
          ) : null}
        </div>
        <div className="archive-toolbar-row">
          <DataViewSwitcher value={viewMode} options={viewOptions} onChange={setViewMode} />
          <DataViewSwitcher value={itemSize} options={itemSizeOptions} onChange={setItemSize} label={t.pages.archiveList.densityLabel} />
          {savedViews.length > 0 ? (
            <div className="saved-views-strip" aria-label={t.pages.archiveList.savedViewsLabel}>
              {orderedSavedViews.map((view, index) => (
                <span key={view.id} className="saved-view-chip">
                  <button type="button" onClick={() => applySavedView(view)}>{view.name}</button>
                  <button type="button" disabled={index === 0} aria-label={t.pages.archiveList.moveUp.replace("{name}", view.name)} onClick={() => reorderPinnedView(view.id, -1)}>↑</button>
                  <button type="button" disabled={index === orderedSavedViews.length - 1} aria-label={t.pages.archiveList.moveDown.replace("{name}", view.name)} onClick={() => reorderPinnedView(view.id, 1)}>↓</button>
                  <button type="button" aria-label={t.pages.archiveList.removeView.replace("{name}", view.name)} onClick={() => void removeSavedView(view.id)}>×</button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {savedViewStatus ? <p className="form-status">{savedViewStatus}</p> : null}
      </PageToolbar>

      {selectedIds.length > 0 ? (
        <>
        <div className={`bulk-action-bar ${bulkBusy ? styles.bulkBarBusy : ""}`} role="status">
          <strong>{t.pages.archiveList.bulkSelectedCount.replace("{count}", String(selectedIds.length))}</strong>
          <div className="button-row">
            <button type="button" className="button button-secondary" onClick={toggleSelectAllVisible}>{t.pages.archiveList.selectVisible}</button>
            {canEditRecords ? (
              <>
                <button type="button" className="button button-secondary" onClick={bulkAddTag} disabled={bulkBusy}>{t.pages.archiveList.addTagLabel}</button>
                <button type="button" className="button button-secondary" onClick={bulkSetType} disabled={bulkBusy}>{t.pages.archiveList.bulkSetTypeButton}</button>
                <label className="archive-toolbar-actions" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                  <span className="helper-text">{t.pages.archiveList.bulkSetStatusLabel}</span>
                  <select
                    disabled={bulkBusy}
                    defaultValue=""
                    onChange={(e) => {
                      const nextStatus = e.target.value as WorkflowStatus;
                      e.target.value = "";
                      if (nextStatus) void bulkSetStatus(nextStatus);
                    }}
                  >
                    <option value="" disabled>{t.pages.archiveList.chooseStatusOption}</option>
                    {WORKFLOW_STATES.map((s) => (
                      <option key={s} value={s}>{workflowStatusLabels[s]}</option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
            <a className="button button-secondary" href={`/archive/${encodeURIComponent(selectedIds[0])}`}>{t.pages.archiveList.openFirst}</a>
            <button type="button" className="button button-secondary" onClick={() => setSelectedIds([])}>{t.pages.archiveList.clearSelection}</button>
            {canBulkDelete ? (
              <button type="button" className="button button-danger" onClick={() => void bulkDelete()} disabled={bulkBusy}>
                {t.pages.archiveList.deleteSelected.replace("{count}", String(selectedIds.length))}
              </button>
            ) : null}
          </div>
        </div>
        {canEditRecords ? <BulkMacroRecorder api={api} targets={selectedMacroTargets} accessToken={accessToken ?? undefined} /> : null}
        </>
      ) : null}

      {bulkFeedback ? (
        <div className={`state-banner ${bulkFeedback.kind === "success" ? "state-banner-success" : "state-banner-error"}`} role="status">
          <strong>{bulkFeedback.kind === "success" ? t.pages.archiveList.bulkSuccessTitle : t.pages.archiveList.bulkErrorTitle}</strong>
          <span className="helper-text">{bulkFeedback.message}</span>
        </div>
      ) : null}

      {canUndo(deleteStack) || canRedo(deleteStack) ? (
        <div className="button-row">
          <button
            type="button"
            className="button button-secondary button-sm"
            disabled={!canUndo(deleteStack) || bulkBusy}
            onClick={() => void handleUndoDelete()}
          >
            {t.pages.archiveList.undoDeleteLabel}{deleteStack.past.length > 0 ? ` (${deleteStack.past.length})` : ""}
          </button>
          <button
            type="button"
            className="button button-secondary button-sm"
            disabled={!canRedo(deleteStack) || bulkBusy}
            onClick={() => void handleRedoDelete()}
          >
            {t.pages.archiveList.redoDeleteLabel}{deleteStack.future.length > 0 ? ` (${deleteStack.future.length})` : ""}
          </button>
        </div>
      ) : null}

      {state.status === "loading" ? (
        <div className="panel panel-compact" aria-live="polite" role="status">
          <Skeleton label={t.pages.archiveList.loadingRecords} />
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{t.pages.archiveList.loadRecordsError}</strong>
          <span className="helper-text">{state.message}</span>
        </div>
      ) : null}

        {state.status === "ready" ? (
        visibleRecords.length === 0 ? (
          <EmptyState
            icon={<PanelRightOpen size={22} />}
            title={t.pages.archiveList.emptyResultsTitle}
            description={t.pages.archiveList.emptyResultsDescription}
            actions={<button type="button" className="button button-secondary" onClick={resetFilters}>{t.pages.archiveList.resetFiltersButton}</button>}
          />
        ) : (
          <section className="archive-workspace" data-view={viewMode} aria-label={t.pages.archiveList.resultsSectionLabel}>
            {showDragSelectRect && dragSelectRect ? (
              <div
                className={styles.dragSelectionRect}
                style={{
                  left: dragSelectRect.left,
                  top: dragSelectRect.top,
                  width: dragSelectRect.right - dragSelectRect.left,
                  height: dragSelectRect.bottom - dragSelectRect.top
                }}
              />
            ) : null}
            <div
              ref={surfaceRef}
              className="records-surface"
              data-view={viewMode}
              data-size={itemSize}
              role={viewMode === "details" || viewMode === "split" ? undefined : "list"}
              onMouseDown={handleSurfaceMouseDown}
            >
              {viewMode === "details" ? (
                <DataTable
                  ariaLabel={t.pages.archiveList.tableAriaLabel}
                  columns={archiveColumns}
                  data={visibleRecords}
                  emptyMessage={t.pages.archiveList.emptyResultsTitle}
                  getRowId={(record) => record.id}
                  tableClassName="archive-table"
                  virtualized={visibleRecords.length > 60}
                  columnVisibilityStorageKey="archive"
                />
              ) : viewMode === "split" ? (
                <>
                  <div className="split-list-pane" role="list" aria-label={t.pages.archiveList.recordListLabel}>
                    {visibleRecords.map(renderSplitListRow)}
                  </div>
                  <aside className="record-preview-rail split-detail-pane" aria-label={t.pages.archiveList.recordDetailsLabel}>
                    {renderPreviewDetailContent()}
                  </aside>
                </>
              ) : (
                visibleRecords.map(renderRecordCard)
              )}
            </div>

            {viewMode !== "split" ? (
              <aside className="record-preview-rail" aria-label={t.pages.archiveList.recordPreviewLabel}>
                {renderPreviewDetailContent()}
              </aside>
            ) : null}
          </section>
        )
      ) : null}
    </div>
    </AppShell>
  );
}

export default function ArchivePage() {
  const { t } = useLocale();
  return (
    <Suspense fallback={(
      <AppShell subtitle={t.pageTitles.recordsCenter} contentClassName="archive-content">
        <div className="panel panel-compact" role="status">
          <p className="form-status">{t.pages.archiveList.preparingArchive}</p>
        </div>
      </AppShell>
    )}>
      <ArchivePageContent />
    </Suspense>
  );
}
