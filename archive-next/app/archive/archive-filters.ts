// Pure, framework-free helpers for the archive list page: workflow-status
// derivation, Arabic-aware search normalization, sort/format helpers, and
// URL/localStorage restore for view mode, item size, sort, and saved views.
// Kept outside the component so they're directly unit-testable without
// mounting the page - see archive-filters.test.ts.

import type { ArchiveRecord, SavedSearch } from "@/lib/archive-api";
import { formatDate as formatDisplayDate, DEFAULT_DISPLAY_SETTINGS, type DisplaySettings } from "@/lib/display-settings";
import type { AppLocale } from "@/lib/i18n/types";
import { MOBILE_VIEWPORT_QUERY, matchesMediaQuery } from "@/lib/use-media-query";

// Workflow states mirrored from the legacy SPA's itemStatus state machine —
// the server-authoritative state machine. The Laravel search/records endpoints
// do not expose a status column or query param (verified against
// SearchController/RecordsController), so this is a client-side facet only:
// it reads `record.workflowStatus` when present, defaulting to "draft".
export type WorkflowStatus = "draft" | "editing" | "review" | "approved" | "published" | "archived";

export const WORKFLOW_STATES: WorkflowStatus[] = ["draft", "editing", "review", "approved", "published", "archived"];

export function getRecordWorkflowStatus(record: ArchiveRecord): WorkflowStatus {
  const value = record.workflowStatus;
  return typeof value === "string" && (WORKFLOW_STATES as string[]).includes(value)
    ? (value as WorkflowStatus)
    : "draft";
}

export type ArchiveViewMode = "grid" | "gallery" | "compact" | "list" | "details" | "split";
export type ArchiveItemSize = "compact" | "comfortable" | "large";
export type ArchiveSortField = "updatedAt" | "createdAt" | "title";
export type ArchiveSortDirection = "asc" | "desc";

export interface SavedArchiveView {
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
export const VIEW_MODE_VALUES: ArchiveViewMode[] = ["grid", "gallery", "compact", "list", "details", "split"];
export const ITEM_SIZE_VALUES: ArchiveItemSize[] = ["compact", "comfortable", "large"];
export const SORT_FIELD_VALUES: ArchiveSortField[] = ["updatedAt", "createdAt", "title"];

export function normalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .trim();
}

export function getRecordSearchText(record: ArchiveRecord) {
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
export function inferRecordTypeFromFile(file: File) {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.includes("pdf") || file.type.startsWith("text/")) return "document";
  return "file";
}

export function formatDate(value: string | undefined, notSpecifiedLabel: string, settings: DisplaySettings = DEFAULT_DISPLAY_SETTINGS, locale: AppLocale = "ar") {
  return formatDisplayDate(value, settings, locale, value || notSpecifiedLabel);
}

export function getRecordTime(record: ArchiveRecord, field: Exclude<ArchiveSortField, "title">) {
  const value = field === "createdAt" ? record.createdAt : record.updatedAt;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

export function getUniqueValues(records: ArchiveRecord[], key: "store" | "type") {
  return Array.from(new Set(records.map((record) => record[key]).filter((value): value is string => Boolean(value)))).sort((a, b) =>
    a.localeCompare(b, "ar")
  );
}

export function getInitialViewMode(params: URLSearchParams): ArchiveViewMode {
  const value = params.get("view");
  if (VIEW_MODE_VALUES.includes(value as ArchiveViewMode)) {
    return value as ArchiveViewMode;
  }

  if (matchesMediaQuery(MOBILE_VIEWPORT_QUERY)) {
    return "list";
  }

  return "grid";
}

export function getInitialItemSize(params: URLSearchParams): ArchiveItemSize {
  const value = params.get("size");
  return ITEM_SIZE_VALUES.includes(value as ArchiveItemSize) ? (value as ArchiveItemSize) : "compact";
}

export function getInitialSortField(params: URLSearchParams): ArchiveSortField {
  const value = params.get("sort");
  return value === "createdAt" || value === "title" ? value : "updatedAt";
}

export function getInitialStatus(params: URLSearchParams): WorkflowStatus | "all" {
  const value = params.get("status");
  return value && (WORKFLOW_STATES as string[]).includes(value) ? (value as WorkflowStatus) : "all";
}

export function getInitialCompletion(params: URLSearchParams): boolean {
  return params.get("completion") === "incomplete";
}

export function savedFilter(search: SavedSearch, key: string) {
  const value = search.filters?.[key];
  return typeof value === "string" ? value : "";
}

export function isSavedArchiveView(search: SavedSearch) {
  return savedFilter(search, "viewKind") === "archive-view";
}

export const ARCHIVE_VIEW_STATE_PAGE = "/archive";

export interface ArchivePersistedViewState {
  sortField?: ArchiveSortField;
  sortDirection?: ArchiveSortDirection;
}

export function savedArchiveViewFromSearch(search: SavedSearch): SavedArchiveView {
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
