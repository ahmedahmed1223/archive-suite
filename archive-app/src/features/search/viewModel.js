import {
  getFilteredArchiveItems,
  normalizeArchiveItemSize,
  normalizeArchivePage,
  normalizeArchivePageSize
} from "../archive/viewModel.js";
import { itemHasDescriptionGap } from "../archive/completeness.js";
import { parseTimestampSegments } from "../archive/timestampLinks.js";
import { normalizeArabicSearchText } from "../../utils/formatting.js";

const SEARCH_VIEW_MODES = new Set(["grid", "list"]);

export function normalizeSearchViewMode(viewMode = "list") {
  return SEARCH_VIEW_MODES.has(viewMode) ? viewMode : "list";
}

export function parseSearchRouteParams(params = new URLSearchParams()) {
  const state = {
    query: params.get("q") || "",
    type: params.get("type") || "all",
    subtype: params.get("subtype") || "all",
    favoritesOnly: params.get("favorites") === "1",
    dateFrom: params.get("from") || "",
    dateTo: params.get("to") || "",
    page: normalizeArchivePage(params.get("page") || 1),
    pageSize: normalizeArchivePageSize(params.get("per") || 24)
  };
  if (params.has("missing")) state.missingFieldsOnly = params.get("missing") === "1";
  if (params.has("view")) state.viewMode = normalizeSearchViewMode(params.get("view") || "list");
  if (params.has("size")) state.itemSize = normalizeArchiveItemSize(params.get("size") || "compact");
  return state;
}

export function createSearchRouteParams({
  query = "",
  type = "all",
  subtype = "all",
  favoritesOnly = false,
  missingFieldsOnly = false,
  dateFrom = "",
  dateTo = "",
  page = 1,
  pageSize = 24,
  viewMode = "list",
  itemSize = "compact"
} = {}) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (type && type !== "all") params.set("type", type);
  if (subtype && subtype !== "all") params.set("subtype", subtype);
  if (favoritesOnly) params.set("favorites", "1");
  if (missingFieldsOnly) params.set("missing", "1");
  if (dateFrom) params.set("from", dateFrom);
  if (dateTo) params.set("to", dateTo);
  const normalizedViewMode = normalizeSearchViewMode(viewMode);
  if (normalizedViewMode !== "list") params.set("view", normalizedViewMode);
  const normalizedItemSize = normalizeArchiveItemSize(itemSize);
  if (normalizedItemSize !== "compact") params.set("size", normalizedItemSize);
  const normalizedPage = normalizeArchivePage(page);
  if (normalizedPage > 1) params.set("page", String(normalizedPage));
  const normalizedPageSize = normalizeArchivePageSize(pageSize);
  if (normalizedPageSize !== 24) params.set("per", String(normalizedPageSize));
  return params;
}

function getTranscriptCandidates(item = {}) {
  const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
  return [
    item.transcription,
    item.transcript,
    metadata.transcription,
    metadata.transcript,
    metadata.transcriptText,
    metadata.ai?.transcription,
    metadata.media?.transcription
  ].filter((value) => typeof value === "string" && value.trim());
}

function secondsToLabel(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = value % 60;
  const pad = (part) => String(part).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function normalizeTranscriptSegment(segment = {}, index = 0) {
  const text = String(segment.text || segment.value || segment.transcript || "").trim();
  if (!text) return null;
  const rawSeconds = segment.start ?? segment.startSec ?? segment.seconds ?? segment.time;
  const seconds = Number.isFinite(Number(rawSeconds)) ? Number(rawSeconds) : null;
  return {
    index,
    text,
    seconds,
    timecode: seconds === null ? "" : secondsToLabel(seconds)
  };
}

export function getTranscriptSegments(item = {}) {
  const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
  const arrayCandidates = [
    item.segments,
    item.transcriptSegments,
    metadata.segments,
    metadata.transcriptSegments,
    metadata.media?.segments,
    metadata.ai?.segments
  ].filter(Array.isArray);
  const normalized = arrayCandidates.flatMap((segments) => segments.map(normalizeTranscriptSegment).filter(Boolean));
  if (normalized.length) return normalized;

  return getTranscriptCandidates(item).flatMap((text) => String(text).split(/\n+/).map((line, index) => {
    const parts = parseTimestampSegments(line);
    const time = parts.find((part) => part.type === "time");
    const clean = parts.map((part) => part.type === "text" ? part.value : "").join(" ").replace(/\s+/g, " ").trim() || line.trim();
    return normalizeTranscriptSegment({ text: clean, seconds: time?.seconds }, index);
  }).filter(Boolean));
}

function createSnippetText(text = "", query = "") {
  const source = String(text || "").replace(/\s+/g, " ").trim();
  if (source.length <= 180) return source;
  const lowerSource = source.toLocaleLowerCase("ar");
  const lowerQuery = String(query || "").toLocaleLowerCase("ar").trim();
  const index = lowerQuery ? lowerSource.indexOf(lowerQuery) : -1;
  const start = Math.max(0, (index >= 0 ? index : 0) - 70);
  const end = Math.min(source.length, start + 180);
  return `${start > 0 ? "…" : ""}${source.slice(start, end)}${end < source.length ? "…" : ""}`;
}

export function getTranscriptSnippets(item = {}, query = "", { limit = 3 } = {}) {
  const normalizedQuery = normalizeArabicSearchText(query);
  if (!normalizedQuery) return [];
  return getTranscriptSegments(item)
    .filter((segment) => normalizeArabicSearchText(segment.text).includes(normalizedQuery))
    .slice(0, limit)
    .map((segment) => ({
      ...segment,
      text: createSnippetText(segment.text, query)
    }));
}

export function getSearchResults({
  videoItems = [],
  query = "",
  type = "all",
  subtype = "all",
  favoritesOnly = false,
  missingFieldsOnly = false,
  dateFrom = "",
  dateTo = ""
} = {}) {
  const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
  const toTime = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;

  return getFilteredArchiveItems({
    videoItems,
    filterType: type,
    filterSubtype: subtype,
    searchQuery: query,
    showFavoritesOnly: favoritesOnly,
    sortField: "updatedAt",
    sortDirection: "desc",
    showDeleted: false
  }).filter((item) => {
    if (missingFieldsOnly && !itemHasDescriptionGap(item)) return false;
    const itemTime = new Date(item.createdAt || item.updatedAt || 0).getTime();
    if (fromTime && itemTime < fromTime) return false;
    if (toTime && itemTime > toTime) return false;
    return true;
  }).map((item) => query.trim() ? {
    ...item,
    transcriptSnippets: getTranscriptSnippets(item, query)
  } : item);
}

export function getSearchActiveFilterCount({
  query = "",
  type = "all",
  subtype = "all",
  favoritesOnly = false,
  missingFieldsOnly = false,
  dateFrom = "",
  dateTo = ""
} = {}) {
  return [
    query.trim(),
    type && type !== "all",
    subtype && subtype !== "all",
    favoritesOnly,
    missingFieldsOnly,
    dateFrom,
    dateTo
  ].filter(Boolean).length;
}
