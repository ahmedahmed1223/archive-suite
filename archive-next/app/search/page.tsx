"use client";

import type { FormEvent } from "react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import DataViewSwitcher, { type DataViewOption } from "@/components/DataViewSwitcher";
import EmptyState from "@/components/EmptyState";
import AsyncStateSurface from "@/components/AsyncStateSurface";
import DisclosureToolbar from "@/components/DisclosureToolbar";
import PageToolbar from "@/components/PageToolbar";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import SearchAutocomplete from "@/components/SearchAutocomplete";
import SearchFilterBuilder from "@/components/SearchFilterBuilder";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { createArchiveApiClient, type ArchiveRecord, type ArchiveSuggestion, type SavedSearch, type SearchFacetBucket, type SearchFacets, type SuggestionFeedbackValue } from "@/lib/archive-api";
import { useAuthSession } from "@/lib/auth-session";
import { deriveLocalSearchEnrichment } from "@/lib/local-enrichment";
import { buildSearchPlaybackHref, buildActiveSearchFilters, resolveSearchSession as serializeSearchSession, describePreviewForScreenReader } from "@/lib/search";
import ActiveFilterBar from "@/components/ActiveFilterBar";
import { resolveSearchSession, resetSearchSession } from "@/lib/search-session";
import { clearRecentSearches, listRecentSearches, recordRecentSearch } from "@/lib/recent-searches";
import { readPersistedViewState, writePersistedViewState } from "@/lib/persisted-view-state";
import { deriveWorkspaceResultCount, readUserWorkspacePreferences, updateWorkspacePreferences, workspacePreferencesStorageKey } from "@/lib/workspace-preferences";
import { isContextRecordingEnabled } from "@/lib/personal-context";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useDisplaySettings } from "@/lib/display-settings-context";
import { formatDate as formatDisplayDate } from "@/lib/display-settings";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; records: ArchiveRecord[]; total: number; cursor: string | null; facets?: SearchFacets }
  | { status: "error"; message: string };

type SearchViewMode = "cards" | "list";
type SearchMode = "keyword" | "semantic" | "transcript";

function formatDate(value: string | undefined, settings: import("@/lib/display-settings").DisplaySettings, locale: import("@/lib/i18n/types").AppLocale) {
  if (!value) return "-";
  return formatDisplayDate(value, settings, locale, value);
}

function formatPlaybackTime(seconds: number) {
  const rounded = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(rounded / 60);
  const remaining = String(rounded % 60).padStart(2, "0");
  return `${minutes}:${remaining}`;
}

function uniqueTypes(records: ArchiveRecord[]) {
  return Array.from(new Set(records.map((record) => record.type).filter((type): type is string => Boolean(type)))).sort((a, b) =>
    a.localeCompare(b, "ar")
  );
}

function hasTag(record: ArchiveRecord, tag: string) {
  if (!tag) return true;
  return (record.tags || []).some((value) => value.trim().toLowerCase() === tag.trim().toLowerCase());
}

function savedFilter(search: SavedSearch, key: string) {
  const value = search.filters?.[key];
  return typeof value === "string" ? value : "";
}

function isSearchWorkbenchItem(search: SavedSearch) {
  return savedFilter(search, "viewKind") !== "archive-view";
}

const SEARCH_VIEW_STATE_PAGE = "/search";

interface SearchPersistedViewState {
  typeFilter?: string;
  tagFilter?: string;
  viewMode?: SearchViewMode;
}

function facetLabel(items: SearchFacetBucket[] | undefined, value: string) {
  return items?.find((item) => item.value === value || item.label === value)?.label || value;
}

export default function SearchPage() {
  const { t } = useLocale();
  const copy = t.pages.search;
  return (
    <Suspense fallback={(
      <AppShell subtitle={copy.title}>
        <div className="panel panel-compact">
          <Skeleton label={copy.loading} />
        </div>
      </AppShell>
    )}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const { locale, t } = useLocale();
  const { settings: displaySettings } = useDisplaySettings();
  const searchCopy = t.pages.searchResults;
  const pageTitle = searchCopy.title;
  const searchViewOptions: DataViewOption<SearchViewMode>[] = useMemo(() => [
    { value: "cards", label: searchCopy.viewCards },
    { value: "list", label: searchCopy.viewList }
  ], [searchCopy.viewCards, searchCopy.viewList]);
  const dialogs = useConfirmDialog();
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = useMemo(() => createArchiveApiClient(), []);
  const fetchSearchSuggestions = useCallback(async (term: string) => {
    const recent = listRecentSearches(term);
    const response = await api.searchSuggestions({ q: term });
    const remote = response.ok ? response.suggestions : [];
    return [...recent, ...remote.filter((item) => !recent.some((entry) => entry.value === item.value))].slice(0, 8);
  }, [api]);
  const { user, status: authStatus } = useAuthSession();
  const userId = user?.id ?? null;

  const initialQuery = searchParams.get("q") || "";
  const initialStore = searchParams.get("store") || "";
  const initialPage = parseInt(searchParams.get("page") || "1", 10);
  const initialPageSize = parseInt(searchParams.get("limit") || "20", 10);
  const initialType = searchParams.get("type") || "all";
  const initialTag = searchParams.get("tag") || "";
  const initialMode: SearchMode = searchParams.get("mode") === "semantic"
    ? "semantic"
    : searchParams.get("mode") === "transcript"
      ? "transcript"
      : "keyword";

  const [query, setQuery] = useState(initialQuery);
  const [store, setStore] = useState(initialStore);
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [tagFilter, setTagFilter] = useState(initialTag);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [descriptionState, setDescriptionState] = useState<"" | "complete" | "incomplete">("");
  const [searchMode, setSearchMode] = useState<SearchMode>(initialMode);
  const [viewMode, setViewMode] = useState<SearchViewMode>("cards");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [pageSize] = useState(initialPageSize);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [allRecords, setAllRecords] = useState<ArchiveRecord[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [recentSearches, setRecentSearches] = useState(() => listRecentSearches());
  const [savedStatus, setSavedStatus] = useState("");
  const [suggestions, setSuggestions] = useState<ArchiveSuggestion[]>([]);
  const hasCompletedWorkspacePreferenceRestore = useRef(false);
  // V3-PERF-005: a later search() call can resolve before an earlier one
  // (out-of-order network responses). Each call stamps this ref with its own
  // id before awaiting; a response only gets applied if it's still the most
  // recent call, so a stale result can never overwrite a newer one.
  const searchRequestIdRef = useRef(0);

  // Per-user filter/view persistence (V1-752); URL params still win on load.
  useEffect(() => {
    if (authStatus === "loading" || !userId) return;
    writePersistedViewState<SearchPersistedViewState>(userId, SEARCH_VIEW_STATE_PAGE, { typeFilter, tagFilter, viewMode });
  }, [authStatus, tagFilter, typeFilter, userId, viewMode]);

  useEffect(() => {
    if (!userId || !isContextRecordingEnabled() || !hasCompletedWorkspacePreferenceRestore.current) return;
    try {
      const current = readUserWorkspacePreferences(window.localStorage, userId);
      const next = updateWorkspacePreferences(current, "/search", {
        view: viewMode,
        previewId: previewId || undefined,
        filters: { q: query, store, type: typeFilter, tag: tagFilter, page: String(currentPage) }
      });
      window.localStorage.setItem(workspacePreferencesStorageKey(userId), JSON.stringify(next));
    } catch {
      // Local preferences are optional.
    }
  }, [currentPage, previewId, query, store, tagFilter, typeFilter, userId, viewMode]);

  const updateParams = useCallback(
    (q: string, s: string, page: number, type: string, tag: string, mode: SearchMode = searchMode) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (s) params.set("store", s);
      if (type !== "all") params.set("type", type);
      if (tag) params.set("tag", tag);
      if (mode !== "keyword") params.set("mode", mode);
      if (page > 1) params.set("page", String(page));
      if (pageSize !== 20) params.set("limit", String(pageSize));

      const queryString = params.toString();
      router.replace(queryString ? `/search?${queryString}` : "/search", { scroll: false });
    },
    [router, pageSize, searchMode]
  );

  const refreshSavedSearches = useCallback(async () => {
    const response = await api.savedSearches();
    if (!response.ok) {
      setSavedStatus(response.error || searchCopy.loadSavedSearchesError);
      return;
    }

    setSavedSearches(response.searches.filter(isSearchWorkbenchItem));
    setSavedStatus("");
  }, [api, searchCopy.loadSavedSearchesError]);

  const search = useCallback(
    async (q: string, s: string, page: number = 1, type: string = typeFilter, tag: string = tagFilter, mode: SearchMode = searchMode) => {
      if (!q.trim() && !s && type === "all" && !tag && page === 1) {
        // Bump the id too: an earlier in-flight call must not overwrite this
        // idle reset once it resolves.
        ++searchRequestIdRef.current;
        setState({ status: "idle" });
        setAllRecords([]);
        return;
      }

      const requestId = ++searchRequestIdRef.current;
      setState({ status: "loading" });
      const response = await api.search({
        q,
        store: s,
        type: type !== "all" ? type : undefined,
        tag,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        descriptionState: descriptionState || undefined,
        limit: 100,
        mode
      });

      // A newer search() call started (and possibly already resolved) while
      // this one was in flight -- its result is stale, drop it so it can't
      // clobber fresher state.
      if (searchRequestIdRef.current !== requestId) return;

      if (!response.ok) {
        setState({ status: "error", message: response.error });
        return;
      }

      setAllRecords(response.records);
      recordRecentSearch(q);
      setRecentSearches(listRecentSearches());
      setState({
        status: "ready",
        records: response.records,
        total: response.facets?.total ?? response.records.length,
        cursor: response.nextCursor ?? null,
        facets: response.facets
      });
      const suggestionsResponse = await api.suggestions({ context: "search" });
      if (searchRequestIdRef.current !== requestId) return;
      setSuggestions(suggestionsResponse.ok ? suggestionsResponse.suggestions : []);
      updateParams(q, s, page, type, tag, mode);
    },
    [api, dateFrom, dateTo, descriptionState, searchMode, tagFilter, typeFilter, updateParams]
  );

  useEffect(() => {
    if (authStatus === "loading" || hasCompletedWorkspacePreferenceRestore.current) return;
    try {
      const contextEnabled = isContextRecordingEnabled();
      const saved = contextEnabled && userId
        ? readUserWorkspacePreferences(window.localStorage, userId).routes["/search"]
        : undefined;
      const perUser = userId ? readPersistedViewState<SearchPersistedViewState>(userId, SEARCH_VIEW_STATE_PAGE) : {};
      const session = resolveSearchSession({
        url: searchParams.toString(),
        persisted: {
          q: saved?.filters?.q,
          store: saved?.filters?.store,
          type: perUser.typeFilter || saved?.filters?.type,
          tag: perUser.tagFilter || saved?.filters?.tag,
          view: perUser.viewMode || (saved?.view === "cards" || saved?.view === "list" ? saved.view : undefined),
          previewId: saved?.previewId,
        },
        isContextRecordingEnabled: contextEnabled,
      });
      setQuery(session.q);
      setStore(session.store);
      setTypeFilter(session.type);
      setTagFilter(session.tag);
      setDateFrom(session.dateFrom);
      setDateTo(session.dateTo);
      setDescriptionState(session.descriptionState);
      setSearchMode(session.mode);
      setViewMode(session.view);
      setPreviewId(session.previewId);
      if (session.q || session.store || session.type !== "all" || session.tag) {
        void search(session.q, session.store, 1, session.type, session.tag, session.mode);
      }
    } catch {
      // Local preferences are optional.
    } finally {
      hasCompletedWorkspacePreferenceRestore.current = true;
    }
  }, [authStatus, search, searchParams, userId]);

  useEffect(() => {
    void refreshSavedSearches();
    setRecentSearches(listRecentSearches());
    if (initialQuery || initialStore || initialType !== "all" || initialTag) {
      void search(initialQuery, initialStore, initialPage, initialType, initialTag);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restores from URL/local state once on mount; search is redefined every render and would retrigger this
  }, []);

  const facets = state.status === "ready" ? state.facets : undefined;
  const typeOptions = useMemo(
    () => facets?.types?.map((item) => item.value) ?? uniqueTypes(allRecords),
    [allRecords, facets?.types]
  );
  const tagOptions = facets?.tags ?? [];

  const filteredRecords = useMemo(() => {
    if (state.status !== "ready") return [];
    return allRecords.filter((record) => {
      if (typeFilter !== "all" && record.type !== typeFilter) return false;
      if (!hasTag(record, tagFilter)) return false;
      return true;
    });
  }, [allRecords, state.status, tagFilter, typeFilter]);

  const visibleRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredRecords.length / pageSize)), [filteredRecords.length, pageSize]);
  const resultCount = useMemo(() => deriveWorkspaceResultCount({
    total: state.status === "ready" ? state.total : 0,
    filtered: filteredRecords.length,
    page: currentPage,
    pageSize
  }, locale), [currentPage, filteredRecords.length, pageSize, state, locale]);
  const previewRecord = useMemo(() => {
    if (previewId) return filteredRecords.find((record) => record.id === previewId) || filteredRecords[0] || null;
    return filteredRecords[0] || null;
  }, [filteredRecords, previewId]);
  // V15-SEARCH-004: a screen-reader summary of the previewed result, announced
  // via the aside's aria-live region.
  const previewSummary = useMemo(
    () => describePreviewForScreenReader(previewRecord, {
      untitled: searchCopy.untitled,
      noDescription: searchCopy.noDescription,
      updatedLabel: searchCopy.updatedLabel,
    }),
    [previewRecord, searchCopy.untitled, searchCopy.noDescription, searchCopy.updatedLabel]
  );
  const localEnrichment = useMemo(
    () => deriveLocalSearchEnrichment(filteredRecords, query, locale),
    [filteredRecords, locale, query]
  );

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.currentTarget.querySelector<HTMLInputElement>("[role=\"combobox\"]")?.blur();
    setCurrentPage(1);
    await search(query, store, 1, typeFilter, tagFilter, searchMode);
  };

  const handlePageChange = (newPage: number) => {
    const clamped = Math.max(1, Math.min(newPage, totalPages));
    setCurrentPage(clamped);
    updateParams(query, store, clamped, typeFilter, tagFilter, searchMode);
  };

  const saveCurrentSearch = async () => {
    if (!query.trim() && !store && typeFilter === "all" && !tagFilter) return;
    const name = await dialogs.prompt({
      title: searchCopy.savePromptTitle,
      message: searchCopy.savePromptMessage,
      defaultValue: query.trim() || searchCopy.savePromptDefault
    });
    if (!name?.trim()) return;

    setSavedStatus(searchCopy.savingStatus);
    // V15-SEARCH-001: a deterministic session key so two equivalent queries
    // collapse to one saved search and can be restored unambiguously.
    const sessionKey = serializeSearchSession({
      q: query, store, type: typeFilter, tag: tagFilter, mode: searchMode,
      dateFrom, dateTo, descriptionState,
    });
    const response = await api.createSavedSearch({
      name: name.trim(),
      query: query || undefined,
      filters: {
        viewKind: "search",
        store,
        type: typeFilter,
        tag: tagFilter,
        session: sessionKey || undefined,
      }
    });

    if (!response.ok) {
      setSavedStatus(response.error || searchCopy.saveError);
      return;
    }

    await refreshSavedSearches();
    setSavedStatus(searchCopy.saveSuccess);
  };

  const applySavedSearch = async (saved: SavedSearch) => {
    const nextQuery = saved.query || "";
    const nextStore = savedFilter(saved, "store");
    const nextType = savedFilter(saved, "type") || "all";
    const nextTag = savedFilter(saved, "tag");
    setQuery(nextQuery);
    setStore(nextStore);
    setTypeFilter(nextType);
    setTagFilter(nextTag);
    setCurrentPage(1);
    await search(nextQuery, nextStore, 1, nextType, nextTag, searchMode);
  };

  const removeSavedSearch = async (saved: { id: string; name: string }) => {
    const confirmed = await dialogs.confirm({
      title: searchCopy.deleteDialog.title,
      message: searchCopy.deleteDialog.message.replace("{name}", saved.name),
      confirmLabel: searchCopy.deleteDialog.confirm,
      destructive: true
    });
    if (!confirmed) return;
    const response = await api.deleteSavedSearch(saved.id);
    if (!response.ok) {
      setSavedStatus(response.error || searchCopy.deleteError);
      return;
    }
    await refreshSavedSearches();
  };

  const runRecentSearch = (value: string) => {
    setQuery(value);
    setCurrentPage(1);
    void search(value, store, 1, typeFilter, tagFilter, searchMode);
  };

  const clearSearchHistory = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  const handleSuggestionFeedback = async (suggestion: ArchiveSuggestion, value: SuggestionFeedbackValue) => {
    const response = await api.submitSuggestionFeedback(suggestion.key, { value, context: "search" });
    if (!response.ok) throw new Error(response.error || searchCopy.suggestionFeedbackError);
    if (value === "dismissed") setSuggestions((current) => current.filter((item) => item.key !== suggestion.key));
  };

  const resetSearch = () => {
    const reset = resetSearchSession({
      q: query, store, type: typeFilter, tag: tagFilter, mode: searchMode,
      dateFrom, dateTo, descriptionState, view: viewMode, density: "comfortable", previewId,
    });
    setQuery(reset.q);
    setStore(reset.store);
    setTypeFilter(reset.type);
    setTagFilter(reset.tag);
    setDateFrom(reset.dateFrom);
    setDateTo(reset.dateTo);
    setDescriptionState(reset.descriptionState);
    setCurrentPage(1);
    setPreviewId(null);
    setState({ status: "idle" });
    setAllRecords([]);
    setSearchMode(reset.mode);
    updateParams("", "", 1, "all", "", reset.mode);
  };

  const renderRecord = (record: ArchiveRecord) => {
    const timestamp = record.match?.timestampSeconds;
    const playbackHref = record.match?.kind === "transcript" && typeof timestamp === "number"
      ? buildSearchPlaybackHref(record, timestamp)
      : null;

    return (
    <article className="search-result-card" key={record.id} data-view={viewMode} onMouseEnter={() => setPreviewId(record.id)}>
      <div className="search-result-card__body">
        <div className="panel-title-row">
          <h2>{record.title || searchCopy.untitled}</h2>
          {record.type ? <span className="badge">{record.type}</span> : null}
        </div>
        {record.description ? <p className="helper-text">{record.description}</p> : null}
        {record.match?.excerpt ? <p className="search-result-card__excerpt">{record.match.excerpt}</p> : null}
        <div className="record-meta">
          {record.store ? <span className="badge">{record.store}</span> : null}
          <span className="badge">{formatDate(record.updatedAt || record.createdAt, displaySettings, locale)}</span>
          {record.tags?.slice(0, 4).map((tag) => <span key={tag} className="tag">{tag}</span>)}
        </div>
      </div>
      <div className="button-row">
        {playbackHref ? (
          <a href={playbackHref} className="button button-primary button-sm">
            {searchCopy.playFrom.replace("{time}", formatPlaybackTime(timestamp ?? 0))}
          </a>
        ) : (
          <a href={`/archive/${encodeURIComponent(record.id)}`} className="button button-primary button-sm">{searchCopy.openDetails}</a>
        )}
        <button type="button" className="button button-secondary button-sm" onClick={() => setPreviewId(record.id)}>
          {searchCopy.preview}
        </button>
      </div>
    </article>
    );
  };

  return (
    <AppShell subtitle={pageTitle} contentClassName="search-content" tipsPage="search">
      <PageToolbar
        eyebrow={<span className="badge">{searchCopy.workspace}</span>}
        title={searchCopy.title}
        description={searchCopy.description}
        meta={(
          <>
            <span className="badge">{searchCopy.resultsCount.replace("{count}", String(filteredRecords.length))}</span>
            <span className="badge">{searchCopy.typesCount.replace("{count}", String(typeOptions.length))}</span>
            <span className="badge">{searchCopy.savedSearchesCount.replace("{count}", String(savedSearches.length))}</span>
          </>
        )}
      >
        <form className="search-workbench-form" onSubmit={handleSearch}>
          <div className="search-query-row">
            <label>
              <span>{searchCopy.keywords}</span>
              <SearchAutocomplete
                value={query}
                onChange={setQuery}
                onSelect={(suggestion) => setQuery(suggestion.value)}
                fetchSuggestions={fetchSearchSuggestions}
                placeholder={searchCopy.queryPlaceholder}
                className="search-input"
              />
              <span id="advanced-search-hint" className="helper-text">
                {searchCopy.structuredSearchHint} <code dir="ltr">{searchCopy.structuredSearchExample}</code>
              </span>
            </label>
            <button type="submit" className="button button-primary">{searchCopy.search}</button>
          </div>
          {/* V14-UX-005: advanced filters behind the shared disclosure. */}
          <DisclosureToolbar summary={searchCopy.advanced}>
            <div className="archive-toolbar-grid">
              <label>
                <span>{searchCopy.store}</span>
                <input type="text" placeholder={searchCopy.storePlaceholder} value={store} onChange={(event) => setStore(event.target.value)} className="search-input" />
              </label>
              <label>
                <span>{searchCopy.type}</span>
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                  <option value="all">{searchCopy.allTypes}</option>
                  {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label>
                <span>{searchCopy.tag}</span>
                <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
                  <option value="">{searchCopy.allTags}</option>
                  {tagOptions.map((tag) => <option key={tag.value} value={tag.value}>{tag.label} ({tag.count})</option>)}
                </select>
              </label>
              <label><span>{searchCopy.from}</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
              <label><span>{searchCopy.to}</span><input type="date" min={dateFrom || undefined} value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
              <label>
                <span>{searchCopy.descriptionStateLabel}</span>
                <select value={descriptionState} onChange={(event) => setDescriptionState(event.target.value as "" | "complete" | "incomplete")}>
                  <option value="">{searchCopy.descriptionStateAll}</option><option value="complete">{searchCopy.descriptionStateComplete}</option><option value="incomplete">{searchCopy.descriptionStateIncomplete}</option>
                </select>
              </label>
              <label>
                <span>{searchCopy.searchModeLabel}</span>
                <select value={searchMode} onChange={(event) => setSearchMode(event.target.value as SearchMode)}>
                  <option value="keyword">{searchCopy.searchModeKeyword}</option>
                  <option value="semantic">{searchCopy.searchModeSemantic}</option>
                  <option value="transcript">{searchCopy.searchModeTranscript}</option>
                </select>
              </label>
            </div>
            <SearchFilterBuilder value={query} onChange={setQuery} />
          </DisclosureToolbar>
        </form>
        <div className="search-workbench-actions">
          {/* V14-UX-008 follow-up: explain the disabled state instead of a silent dead button. */}
          <span className="helper-text" title={!query.trim() && !store && typeFilter === "all" && !tagFilter ? searchCopy.saveDisabledHint : undefined}>
            <button type="button" className="button button-primary" onClick={() => void saveCurrentSearch()} disabled={!query.trim() && !store && typeFilter === "all" && !tagFilter}>
              {searchCopy.save}
            </button>
          </span>
          <button type="button" className="button button-secondary" onClick={resetSearch}>
            {searchCopy.reset}
          </button>
          <a className="button button-secondary" href="/search/saved">
            {searchCopy.manageSavedSearches}
          </a>
        </div>
        {/* V15-SEARCH-003: reuse the shared active-filter bar to surface every
            non-default constraint as a removable chip, with one-tap reset. */}
        <ActiveFilterBar
          filters={buildActiveSearchFilters({
            query, store, typeFilter, tagFilter, searchMode, dateFrom, dateTo, descriptionState,
            labels: {
              query: searchCopy.keywords,
              store: searchCopy.store,
              type: searchCopy.type,
              tag: searchCopy.tag,
              mode: searchCopy.searchModeLabel,
              from: searchCopy.from,
              to: searchCopy.to,
              description: searchCopy.descriptionStateLabel,
            },
            handlers: {
              onQuery: () => setQuery(""),
              onStore: () => setStore(""),
              onType: () => setTypeFilter("all"),
              onTag: () => setTagFilter(""),
              onMode: () => setSearchMode("keyword"),
              onDateFrom: () => setDateFrom(""),
              onDateTo: () => setDateTo(""),
              onDescription: () => setDescriptionState(""),
            },
          })}
          onReset={resetSearch}
        />
        {searchMode === "transcript" ? <p className="helper-text">{searchCopy.transcriptModeHint}</p> : null}
        {searchMode === "semantic" && facets?.mode === "keyword-fallback" ? <p className="form-status">{searchCopy.semanticFallbackHint}</p> : null}
        <div className="archive-toolbar-row">
          <DataViewSwitcher value={viewMode} options={searchViewOptions} onChange={setViewMode} label={searchCopy.viewModeLabel} />
          {savedSearches.length > 0 ? (
            <div className="saved-views-strip" aria-label={searchCopy.savedSearchesAriaLabel}>
              {savedSearches.map((saved) => (
                <span key={saved.id} className="saved-view-chip">
                  <button type="button" onClick={() => void applySavedSearch(saved)}>{saved.name}</button>
                  <button type="button" aria-label={searchCopy.deleteSavedSearchAriaLabel.replace("{name}", saved.name)} onClick={() => void removeSavedSearch(saved)}>×</button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {recentSearches.length > 0 ? (
          <section className="recent-searches-strip" aria-label={searchCopy.recentSearches}>
            <div className="recent-searches-strip__header">
              <span>{searchCopy.recentSearches}</span>
              <button type="button" className="button button-ghost button-sm" onClick={clearSearchHistory}>{searchCopy.clearHistory}</button>
            </div>
            <div className="saved-views-strip">
              {recentSearches.map((recent) => (
                <button key={recent.value} type="button" className="saved-view-chip" onClick={() => runRecentSearch(recent.value)}>{recent.label}</button>
              ))}
            </div>
          </section>
        ) : null}
        {facets ? (
              <div className="facet-strip" aria-label={searchCopy.facetsSummaryAriaLabel}>
            {facets.types?.slice(0, 5).map((item) => (
              <button key={item.value} type="button" className="facet-chip" onClick={() => setTypeFilter(item.value)}>
                {item.label} · {item.count}
              </button>
            ))}
            {facets.tags?.slice(0, 6).map((item) => (
              <button key={item.value} type="button" className="facet-chip" onClick={() => setTagFilter(item.value)}>
                #{item.label} · {item.count}
              </button>
            ))}
          </div>
        ) : null}
        {savedStatus ? <p className="form-status">{savedStatus}</p> : null}
      </PageToolbar>

      {state.status === "idle" ? (
        /* V14-UX-011 (P3): a searcher wants searches, not navigation. Offer
           one-click example queries plus any saved searches from the server. */
        <div className="empty-state empty-state-rich" data-page-state="empty">
          <strong>{searchCopy.empty}</strong>
          <p className="helper-text">{searchCopy.emptyDescription}</p>
          {savedSearches.length > 0 ? (
            <>
              <p className="helper-text" style={{ marginBlockStart: "var(--space-3)" }}>{searchCopy.savedSearchesAriaLabel}:</p>
              <div className="button-row">
                {savedSearches.slice(0, 4).map((saved) => (
                  <button
                    key={saved.id}
                    type="button"
                    className="button button-secondary button-sm"
                    onClick={() => setQuery(saved.query ?? saved.name)}
                  >
                    {saved.name}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="helper-text" style={{ marginBlockStart: "var(--space-3)" }}>{searchCopy.quickSuggestionsLabel}:</p>
              <div className="button-row">
                {[searchCopy.structuredSearchExample].map((example) => (
                  <button
                    key={example}
                    type="button"
                    className="button button-secondary button-sm"
                    onClick={() => setQuery(example)}
                  >
                    <code dir="ltr">{example}</code>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* V14-UX-004: loading and error share the semantic state surface. */}
      {state.status === "loading" || state.status === "error" ? (
        <AsyncStateSurface
          status={state.status === "loading" ? "loading" : "error"}
          loadingLabel={searchCopy.loading}
          title={state.status === "error" ? searchCopy.unavailable : undefined}
          description={state.status === "error" ? state.message : undefined}
        />
      ) : null}

      {state.status === "ready" && visibleRecords.length === 0 ? (
        <EmptyState
          title={searchCopy.noResults}
          description={searchCopy.noResultsDescription}
          actions={<button type="button" className="button button-secondary" onClick={resetSearch}>{searchCopy.resetSearch}</button>}
        />
      ) : null}

      {state.status === "ready" && visibleRecords.length > 0 ? (
        <section className="search-workspace" aria-label={searchCopy.results}>
          <div className="search-results-surface" data-view={viewMode}>
            <div className="panel panel-compact">
              <p className="form-status">
                {resultCount.label}
                {typeof state.total === "number" ? searchCopy.totalOnServerTemplate.replace("{total}", String(state.total)) : ""}
                {query ? searchCopy.searchingForTemplate.replace("{query}", query) : ""}
              </p>
            </div>

            {visibleRecords.map(renderRecord)}

            {localEnrichment.suggestedTags.length > 0 || localEnrichment.entities.length > 0 ? (
              <section className="panel stack" aria-label={searchCopy.localEnrichmentAriaLabel}>
                <div className="panel-title-row">
                  <div>
                    <span className="badge">{searchCopy.localEnrichmentBadge}</span>
                    <h2>{searchCopy.localEnrichmentHeading}</h2>
                    <p className="helper-text">
                      {searchCopy.localEnrichmentDescription}
                    </p>
                  </div>
                  <span className="badge">{searchCopy.localEnrichmentCoverageTemplate.replace("{count}", String(localEnrichment.coverage.recordsWithSuggestions))}</span>
                </div>

                {localEnrichment.suggestedTags.length > 0 ? (
                  <div>
                    <strong>{searchCopy.suggestedTagsHeading}</strong>
                    <div className="tag-list">
                      {localEnrichment.suggestedTags.slice(0, 8).map((suggestion) => (
                        <button
                          className="tag"
                          key={suggestion.tag}
                          type="button"
                          title={suggestion.reason}
                          onClick={() => setTagFilter(suggestion.tag)}
                        >
                          #{suggestion.tag} · {suggestion.count}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {localEnrichment.entities.length > 0 ? (
                  <div>
                    <strong>{searchCopy.extractedEntitiesHeading}</strong>
                    <div className="tag-list">
                      {localEnrichment.entities.slice(0, 10).map((entity) => (
                        <span className="badge" key={`${entity.kind}:${entity.label}`}>
                          {entity.label} · {entity.kind} · {entity.count}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            <SuggestionsPanel suggestions={suggestions} title={searchCopy.suggestionsPanelTitle} onFeedback={handleSuggestionFeedback} />

            {totalPages > 1 ? (
              <div className="pagination">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="button button-secondary"
                >
                  {searchCopy.previousPage}
                </button>
                <span className="form-status">
                  {searchCopy.pageOfTemplate.replace("{current}", String(currentPage)).replace("{total}", String(totalPages))}
                </span>
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="button button-secondary"
                >
                  {searchCopy.nextPage}
                </button>
              </div>
            ) : null}
          </div>

          <aside className="record-preview-rail" aria-label={searchCopy.previewRailAriaLabel} aria-live="polite">
            {/* V15-SEARCH-004: screen-reader summary announced on preview change. */}
            <p className="sr-only">{previewSummary ? `${previewSummary.title} — ${previewSummary.descriptionSnippet}` : ""}</p>
            {previewRecord ? (
              <>
                <div className="panel-section-header">
                  <span className="badge">{searchCopy.preview}</span>
                  <h2>{previewRecord.title || searchCopy.untitled}</h2>
                </div>
                <p>{previewRecord.description || searchCopy.noDescription}</p>
                <div className="kv-grid">
                  <div className="kv-item">
                    <strong>{searchCopy.store}</strong>
                    <span>{previewRecord.store || "-"}</span>
                  </div>
                  <div className="kv-item">
                    <strong>{searchCopy.type}</strong>
                    <span>{previewRecord.type || "-"}</span>
                  </div>
                  <div className="kv-item">
                    <strong>{searchCopy.selectedTagLabel}</strong>
                    <span>{tagFilter ? facetLabel(tagOptions, tagFilter) : "-"}</span>
                  </div>
                  <div className="kv-item">
                    <strong>{searchCopy.updatedLabel}</strong>
                    <span>{formatDate(previewRecord.updatedAt || previewRecord.createdAt, displaySettings, locale)}</span>
                  </div>
                </div>
                {previewRecord.tags && previewRecord.tags.length > 0 ? (
                  <div className="tags">
                    {previewRecord.tags.map((tag) => <span key={tag} className="tag">{tag}</span>)}
                  </div>
                ) : null}
                <a className="button button-primary" href={`/archive/${encodeURIComponent(previewRecord.id)}`}>
                  {searchCopy.openDetails}
                </a>
              </>
            ) : (
              <EmptyState title={searchCopy.noPreviewTitle} description={searchCopy.noPreviewDescription} />
            )}
          </aside>
        </section>
      ) : null}
    </AppShell>
  );
}
