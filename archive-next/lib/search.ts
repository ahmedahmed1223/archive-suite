import { deriveRecordSourcePath, type ArchiveRecord } from "./archive-api";

// V15-SEARCH-001: a deterministic search-session key.
// The same inputs always produce the same key, so a saved search can be
// restored without ambiguity (the legacy code keyed off the live URL only,
// which could drift between mode/page permutations). Ordered, normalised,
// and free of transient fields (page, cursor) so two equivalent queries
// collapse to one session.
export type SearchSessionInput = {
  q?: string;
  store?: string;
  type?: string;
  tag?: string;
  mode?: "keyword" | "semantic" | "transcript";
  dateFrom?: string;
  dateTo?: string;
  descriptionState?: "" | "complete" | "incomplete";
};

export function resolveSearchSession(input: SearchSessionInput): string {
  const parts: Array<[string, string]> = [
    // "keyword" is the app default, so it carries no session-differentiating info.
    ["q", (input.q ?? "").trim().toLowerCase()],
    ["store", (input.store ?? "").trim().toLowerCase()],
    ["type", (input.type ?? "all").trim().toLowerCase()],
    ["tag", (input.tag ?? "").trim().toLowerCase()],
    ["from", (input.dateFrom ?? "").trim()],
    ["to", (input.dateTo ?? "").trim()],
    ["desc", (input.descriptionState ?? "").trim().toLowerCase()],
    ["mode", (input.mode ?? "keyword").toLowerCase()],
  ];
  const filtered = parts.filter(([, value]) => value !== "" && value !== "all");
  const modeEntry = filtered.find(([key]) => key === "mode");
  const others = filtered.filter(([key]) => key !== "mode");
  // mode only matters when it differs from the default; append last if present.
  const ordered = modeEntry && modeEntry[1] !== "keyword" ? [...others, modeEntry] : others;
  return ordered.map(([key, value]) => `${key}=${value}`).join("&");
}

export type ActiveSearchFilterLabels = {
  query: string;
  store: string;
  type: string;
  tag: string;
  mode: string;
  from: string;
  to: string;
  description: string;
};

export type ActiveSearchFilterHandlers = {
  onQuery: () => void;
  onStore: () => void;
  onType: () => void;
  onTag: () => void;
  onMode: () => void;
  onDateFrom: () => void;
  onDateTo: () => void;
  onDescription: () => void;
};

export type ActiveSearchFilter = {
  key: string;
  label: string;
  onRemove: () => void;
};

export type PreviewAccessibleSummary = {
  title: string;
  type: string;
  hasDescription: boolean;
  descriptionSnippet: string;
  updatedLabel: string;
};

/**
 * V15-SEARCH-004: derive a screen-reader-friendly summary of the currently
 * previewed search result. Pure, so it can be unit-tested and reused by the
 * preview rail's aria-live region without coupling to React state.
 */
export function describePreviewForScreenReader(
  record: { title?: string; type?: string; description?: string; updatedAt?: string; createdAt?: string } | null,
  copy: { untitled: string; noDescription: string; updatedLabel: string }
): PreviewAccessibleSummary | null {
  if (!record) return null;
  const description = record.description?.trim() ?? "";
  const ELLIPSIS = "…";
  const MAX = 160;
  const snippet = description.length > MAX
    ? `${description.slice(0, MAX - ELLIPSIS.length)}${ELLIPSIS}`
    : description;
  return {
    title: record.title?.trim() || copy.untitled,
    type: record.type?.trim() || "",
    hasDescription: description.length > 0,
    descriptionSnippet: snippet || copy.noDescription,
    updatedLabel: copy.updatedLabel,
  };
}

/**
 * V15-SEARCH-003: derive the visible active-filter chips from the live search
 * state. Pure + deterministic — only non-default constraints become chips, and
 * each chip carries the handler that clears just that one constraint.
 */
export function buildActiveSearchFilters(args: {
  query: string;
  store: string;
  typeFilter: string;
  tagFilter: string;
  searchMode: "keyword" | "semantic" | "transcript";
  dateFrom: string;
  dateTo: string;
  descriptionState: "" | "complete" | "incomplete";
  labels: ActiveSearchFilterLabels;
  handlers: ActiveSearchFilterHandlers;
}): ActiveSearchFilter[] {
  const filters: ActiveSearchFilter[] = [];
  const push = (key: string, label: string, onRemove: () => void) => {
    if (label.trim()) filters.push({ key, label, onRemove });
  };

  const { query, store, typeFilter, tagFilter, searchMode, dateFrom, dateTo, descriptionState, labels, handlers } = args;
  if (query.trim()) push("query", `${labels.query}: ${query.trim()}`, handlers.onQuery);
  if (store.trim()) push("store", `${labels.store}: ${store.trim()}`, handlers.onStore);
  if (typeFilter && typeFilter !== "all") push("type", `${labels.type}: ${typeFilter}`, handlers.onType);
  if (tagFilter.trim()) push("tag", `${labels.tag}: ${tagFilter.trim()}`, handlers.onTag);
  if (searchMode !== "keyword") push("mode", `${labels.mode}: ${searchMode}`, handlers.onMode);
  if (dateFrom.trim()) push("from", `${labels.from}: ${dateFrom.trim()}`, handlers.onDateFrom);
  if (dateTo.trim()) push("to", `${labels.to}: ${dateTo.trim()}`, handlers.onDateTo);
  if (descriptionState) push("description", `${labels.description}: ${descriptionState}`, handlers.onDescription);
  return filters;
}

export function buildSearchPlaybackHref(record: ArchiveRecord, timestampSeconds: number): string | null {
  const source = deriveRecordSourcePath(record);

  if (!source || !Number.isFinite(timestampSeconds) || timestampSeconds < 0) return null;

  const params = new URLSearchParams({
    path: source.sourcePath,
    recordId: record.id,
    at: String(timestampSeconds),
  });

  if (source.disk) params.set("disk", source.disk);

  return `/media/play?${params.toString()}`;
}
