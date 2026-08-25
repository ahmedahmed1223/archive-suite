/**
 * Pure search-session state. URL constraints are intentionally distinct from
 * local display preferences: only the former are shareable.
 */
export type SearchMode = "keyword" | "semantic" | "transcript";
export type SearchDescriptionState = "" | "complete" | "incomplete";
export type SearchView = "cards" | "list";
export type SearchDensity = "compact" | "comfortable" | "large";

export interface SearchSession {
  q: string;
  store: string;
  type: string;
  tag: string;
  mode: SearchMode;
  dateFrom: string;
  dateTo: string;
  descriptionState: SearchDescriptionState;
  view: SearchView;
  density: SearchDensity;
  previewId: string | null;
}

export type SearchSessionSource = Partial<SearchSession>;

export interface ResolveSearchSessionOptions {
  url?: string | URLSearchParams | null;
  /** A search the user deliberately selected, never a list of saved searches. */
  saved?: SearchSessionSource | null;
  persisted?: SearchSessionSource | null;
  defaults?: Partial<SearchSession>;
  isContextRecordingEnabled?: boolean;
}

const DEFAULT_SESSION: SearchSession = {
  q: "",
  store: "",
  type: "all",
  tag: "",
  mode: "keyword",
  dateFrom: "",
  dateTo: "",
  descriptionState: "",
  view: "cards",
  density: "comfortable",
  previewId: null,
};

const URL_KEYS = ["q", "store", "type", "tag", "mode", "dateFrom", "dateTo", "descriptionState"] as const;
const ACTIVE_FILTER_KEYS = ["q", "store", "type", "tag", "mode", "dateFrom", "dateTo", "descriptionState"] as const;

function cleanText(value: unknown, fallback: string, maxLength = 256): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed : fallback;
}

function cleanDate(value: unknown, fallback: string): string {
  const date = cleanText(value, fallback, 10);
  if (!date) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fallback;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? fallback : date;
}

function cleanSession(source: SearchSessionSource | null | undefined, defaults: SearchSession): SearchSession {
  const mode = source?.mode;
  const descriptionState = source?.descriptionState;
  const view = source?.view;
  const density = source?.density;
  const previewId = cleanText(source?.previewId, "", 256);
  return {
    q: cleanText(source?.q, defaults.q, 500),
    store: cleanText(source?.store, defaults.store),
    type: cleanText(source?.type, defaults.type),
    tag: cleanText(source?.tag, defaults.tag),
    mode: mode === "keyword" || mode === "semantic" || mode === "transcript" ? mode : defaults.mode,
    dateFrom: cleanDate(source?.dateFrom, defaults.dateFrom),
    dateTo: cleanDate(source?.dateTo, defaults.dateTo),
    descriptionState: descriptionState === "complete" || descriptionState === "incomplete" || descriptionState === ""
      ? descriptionState
      : defaults.descriptionState,
    view: view === "cards" || view === "list" ? view : defaults.view,
    density: density === "compact" || density === "comfortable" || density === "large" ? density : defaults.density,
    previewId: previewId || null,
  };
}

function urlParameters(url: ResolveSearchSessionOptions["url"]): URLSearchParams {
  if (url instanceof URLSearchParams) return url;
  if (typeof url !== "string") return new URLSearchParams();
  return new URLSearchParams(url.startsWith("?") ? url.slice(1) : url);
}

/** Returns a URL session only when it contains at least one valid known search parameter. */
function readUrlSession(url: ResolveSearchSessionOptions["url"], defaults: SearchSession): SearchSession | null {
  const params = urlParameters(url);
  const source: SearchSessionSource = {};
  let recognized = false;

  for (const key of URL_KEYS) {
    if (!params.has(key)) continue;
    const value = params.get(key) ?? "";
    const candidate = cleanSession({ [key]: value }, defaults);
    // An invalid value resolves to the default. Empty values are intentional
    // and valid; non-empty invalid values must not make the URL atomic.
    const valid = value.trim() === "" || candidate[key] !== defaults[key];
    if (!valid) continue;
    (source as Record<string, unknown>)[key] = candidate[key];
    recognized = true;
  }

  return recognized ? cleanSession(source, defaults) : null;
}

function shareableSession(source: SearchSessionSource | null | undefined): SearchSessionSource {
  const result: SearchSessionSource = {};
  for (const key of URL_KEYS) (result as Record<string, unknown>)[key] = source?.[key];
  return result;
}

/**
 * Resolves precisely one source. A recognized URL session is atomic, so it
 * never inherits stale fields from saved or persisted state.
 */
export function resolveSearchSession(options: ResolveSearchSessionOptions): SearchSession {
  const defaults = cleanSession(options.defaults, DEFAULT_SESSION);
  const url = readUrlSession(options.url, defaults);
  const fromSaved = options.saved ? cleanSession(shareableSession(options.saved), defaults) : null;
  const fromPersisted = options.persisted ? cleanSession(options.persisted, defaults) : null;
  const resolved = url ?? fromSaved ?? fromPersisted ?? defaults;

  if (options.isContextRecordingEnabled !== false) return resolved;

  // Display preferences carry no work content, so a user may keep them after
  // opting out. They are taken only from their own persisted record.
  const display = fromPersisted ?? resolved;
  return { ...clearSearchSessionForPersonalContext(resolved), view: display.view, density: display.density };
}

/** The constraints represented by active-filter chips, in UI order. */
export function searchSessionActiveFilters(session: SearchSession): Array<(typeof ACTIVE_FILTER_KEYS)[number]> {
  return ACTIVE_FILTER_KEYS.filter((key) => {
    const value = session[key];
    return key === "type" ? value !== "all" : key === "mode" ? value !== "keyword" : value !== "";
  });
}

/** Reset shareable search constraints and the result selection, retaining display preference. */
export function resetSearchSession(session: SearchSession): SearchSession {
  return { ...DEFAULT_SESSION, view: session.view, density: session.density };
}

/** Remove local personal context when the user opts out, without changing display preference. */
export function clearSearchSessionForPersonalContext(session: SearchSession): SearchSession {
  return resetSearchSession(session);
}
