"use client";

import type { FormEvent } from "react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import DataViewSwitcher, { type DataViewOption } from "@/components/DataViewSwitcher";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { createArchiveApiClient, type ArchiveRecord, type ArchiveSuggestion, type SavedSearch, type SearchFacetBucket, type SearchFacets, type SuggestionFeedbackValue } from "@/lib/archive-api";
import { useAuthSession } from "@/lib/auth-session";
import { deriveLocalSearchEnrichment } from "@/lib/local-enrichment";
import { readPersistedViewState, writePersistedViewState } from "@/lib/persisted-view-state";
import { deriveWorkspaceResultCount, readWorkspacePreferences, updateWorkspacePreferences, WORKSPACE_PREFERENCES_STORAGE_KEY } from "@/lib/workspace-preferences";
import { Skeleton } from "@/components/ui/Skeleton";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; records: ArchiveRecord[]; total: number; cursor: string | null; facets?: SearchFacets }
  | { status: "error"; message: string };

type SearchViewMode = "cards" | "list";

const searchViewOptions: DataViewOption<SearchViewMode>[] = [
  { value: "cards", label: "بطاقات" },
  { value: "list", label: "قائمة" }
];

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ar-SA");
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
  return (
    <Suspense fallback={(
      <AppShell subtitle="بحث متقدم">
        <div className="panel panel-compact">
          <Skeleton label="جار تحميل البحث..." />
        </div>
      </AppShell>
    )}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const dialogs = useConfirmDialog();
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = useMemo(() => createArchiveApiClient(), []);
  const { user, status: authStatus } = useAuthSession();
  const userId = user?.id ?? null;

  const initialQuery = searchParams.get("q") || "";
  const initialStore = searchParams.get("store") || "";
  const initialPage = parseInt(searchParams.get("page") || "1", 10);
  const initialPageSize = parseInt(searchParams.get("limit") || "20", 10);
  const initialType = searchParams.get("type") || "all";
  const initialTag = searchParams.get("tag") || "";

  const [query, setQuery] = useState(initialQuery);
  const [store, setStore] = useState(initialStore);
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [tagFilter, setTagFilter] = useState(initialTag);
  const [viewMode, setViewMode] = useState<SearchViewMode>("cards");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [pageSize] = useState(initialPageSize);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [allRecords, setAllRecords] = useState<ArchiveRecord[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [savedStatus, setSavedStatus] = useState("");
  const [suggestions, setSuggestions] = useState<ArchiveSuggestion[]>([]);
  const hasCompletedWorkspacePreferenceRestore = useRef(false);

  // Per-user filter/view persistence (V1-752); URL params still win on load.
  useEffect(() => {
    if (authStatus === "loading") return;
    writePersistedViewState<SearchPersistedViewState>(userId, SEARCH_VIEW_STATE_PAGE, { typeFilter, tagFilter, viewMode });
  }, [authStatus, tagFilter, typeFilter, userId, viewMode]);

  useEffect(() => {
    if (!searchParams.toString() && !hasCompletedWorkspacePreferenceRestore.current) return;
    try {
      const current = readWorkspacePreferences(window.localStorage.getItem(WORKSPACE_PREFERENCES_STORAGE_KEY));
      const next = updateWorkspacePreferences(current, "/search", {
        view: viewMode,
        previewId: previewId || undefined,
        filters: { q: query, store, type: typeFilter, tag: tagFilter, page: String(currentPage) }
      });
      window.localStorage.setItem(WORKSPACE_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Local preferences are optional.
    }
  }, [currentPage, previewId, query, store, tagFilter, typeFilter, viewMode]);

  const updateParams = useCallback(
    (q: string, s: string, page: number, type: string, tag: string) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (s) params.set("store", s);
      if (type !== "all") params.set("type", type);
      if (tag) params.set("tag", tag);
      if (page > 1) params.set("page", String(page));
      if (pageSize !== 20) params.set("limit", String(pageSize));

      const queryString = params.toString();
      router.replace(queryString ? `/search?${queryString}` : "/search", { scroll: false });
    },
    [router, pageSize]
  );

  const refreshSavedSearches = useCallback(async () => {
    const response = await api.savedSearches();
    if (!response.ok) {
      setSavedStatus(response.error || "تعذر تحميل البحوث المحفوظة.");
      return;
    }

    setSavedSearches(response.searches.filter(isSearchWorkbenchItem));
    setSavedStatus("");
  }, [api]);

  const search = useCallback(
    async (q: string, s: string, page: number = 1, type: string = typeFilter, tag: string = tagFilter) => {
      if (!q.trim() && !s && type === "all" && !tag && page === 1) {
        setState({ status: "idle" });
        setAllRecords([]);
        return;
      }

      setState({ status: "loading" });
      const response = await api.search({
        q,
        store: s,
        type: type !== "all" ? type : undefined,
        tag,
        limit: 100
      });

      if (!response.ok) {
        setState({ status: "error", message: response.error });
        return;
      }

      setAllRecords(response.records);
      setState({
        status: "ready",
        records: response.records,
        total: response.facets?.total ?? response.records.length,
        cursor: response.nextCursor ?? null,
        facets: response.facets
      });
      const suggestionsResponse = await api.suggestions({ context: "search" });
      setSuggestions(suggestionsResponse.ok ? suggestionsResponse.suggestions : []);
      updateParams(q, s, page, type, tag);
    },
    [api, tagFilter, typeFilter, updateParams]
  );

  useEffect(() => {
    if (authStatus === "loading" || searchParams.toString() || hasCompletedWorkspacePreferenceRestore.current) return;
    try {
      const saved = readWorkspacePreferences(window.localStorage.getItem(WORKSPACE_PREFERENCES_STORAGE_KEY)).routes["/search"];
      // Per-user override (V1-752): a user-scoped type/tag/view choice takes
      // precedence over the route-scoped (shared-browser) preference above.
      const perUser = readPersistedViewState<SearchPersistedViewState>(userId, SEARCH_VIEW_STATE_PAGE);
      if (!saved && !perUser.typeFilter && !perUser.tagFilter && !perUser.viewMode) return;
      const restoredQuery = saved?.filters?.q || "";
      const restoredStore = saved?.filters?.store || "";
      const restoredType = perUser.typeFilter || saved?.filters?.type || "all";
      const restoredTag = perUser.tagFilter || saved?.filters?.tag || "";
      const restoredPage = Math.max(1, Number(saved?.filters?.page) || 1);
      const restoredView = perUser.viewMode || saved?.view;
      if (restoredView === "cards" || restoredView === "list") setViewMode(restoredView);
      if (saved?.previewId) setPreviewId(saved.previewId);
      setQuery(restoredQuery);
      setStore(restoredStore);
      setTypeFilter(restoredType);
      setTagFilter(restoredTag);
      setCurrentPage(restoredPage);
      if (restoredQuery || restoredStore || restoredType !== "all" || restoredTag) {
        void search(restoredQuery, restoredStore, restoredPage, restoredType, restoredTag);
      }
    } catch {
      // Local preferences are optional.
    } finally {
      hasCompletedWorkspacePreferenceRestore.current = true;
    }
  }, [authStatus, search, searchParams, userId]);

  useEffect(() => {
    void refreshSavedSearches();
    if (initialQuery || initialStore || initialType !== "all" || initialTag) {
      void search(initialQuery, initialStore, initialPage, initialType, initialTag);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }), [currentPage, filteredRecords.length, pageSize, state]);
  const previewRecord = useMemo(() => {
    if (previewId) return filteredRecords.find((record) => record.id === previewId) || filteredRecords[0] || null;
    return filteredRecords[0] || null;
  }, [filteredRecords, previewId]);
  const localEnrichment = useMemo(
    () => deriveLocalSearchEnrichment(filteredRecords, query),
    [filteredRecords, query]
  );

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCurrentPage(1);
    await search(query, store, 1, typeFilter, tagFilter);
  };

  const handlePageChange = (newPage: number) => {
    const clamped = Math.max(1, Math.min(newPage, totalPages));
    setCurrentPage(clamped);
    updateParams(query, store, clamped, typeFilter, tagFilter);
  };

  const saveCurrentSearch = async () => {
    if (!query.trim() && !store && typeFilter === "all" && !tagFilter) return;
    const name = await dialogs.prompt({
      title: "حفظ البحث",
      message: "اسم البحث المحفوظ",
      defaultValue: query.trim() || "بحث مخصص"
    });
    if (!name?.trim()) return;

    setSavedStatus("جار حفظ البحث...");
    const response = await api.createSavedSearch({
      name: name.trim(),
      query: query || undefined,
      filters: {
        viewKind: "search",
        store,
        type: typeFilter,
        tag: tagFilter
      }
    });

    if (!response.ok) {
      setSavedStatus(response.error || "تعذر حفظ البحث.");
      return;
    }

    await refreshSavedSearches();
    setSavedStatus("تم حفظ البحث.");
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
    await search(nextQuery, nextStore, 1, nextType, nextTag);
  };

  const removeSavedSearch = async (id: string) => {
    const response = await api.deleteSavedSearch(id);
    if (!response.ok) {
      setSavedStatus(response.error || "تعذر حذف البحث.");
      return;
    }
    await refreshSavedSearches();
  };

  const handleSuggestionFeedback = async (suggestion: ArchiveSuggestion, value: SuggestionFeedbackValue) => {
    const response = await api.submitSuggestionFeedback(suggestion.key, { value, context: "search" });
    if (!response.ok) throw new Error(response.error || "تعذر حفظ تقييم الاقتراح.");
    if (value === "dismissed") setSuggestions((current) => current.filter((item) => item.key !== suggestion.key));
  };

  const resetSearch = () => {
    setQuery("");
    setStore("");
    setTypeFilter("all");
    setTagFilter("");
    setCurrentPage(1);
    setPreviewId(null);
    setState({ status: "idle" });
    setAllRecords([]);
    updateParams("", "", 1, "all", "");
  };

  const renderRecord = (record: ArchiveRecord) => (
    <article className="search-result-card" key={record.id} data-view={viewMode} onMouseEnter={() => setPreviewId(record.id)}>
      <div className="search-result-card__body">
        <div className="panel-title-row">
          <h2>{record.title || "بدون عنوان"}</h2>
          {record.type ? <span className="badge">{record.type}</span> : null}
        </div>
        {record.description ? <p className="helper-text">{record.description}</p> : null}
        <div className="record-meta">
          {record.store ? <span className="badge">{record.store}</span> : null}
          <span className="badge">{formatDate(record.updatedAt || record.createdAt)}</span>
          {record.tags?.slice(0, 4).map((tag) => <span key={tag} className="tag">{tag}</span>)}
        </div>
      </div>
      <div className="button-row">
        <a href={`/archive/${encodeURIComponent(record.id)}`} className="button button-primary button-sm">
          فتح التفاصيل
        </a>
        <button type="button" className="button button-secondary button-sm" onClick={() => setPreviewId(record.id)}>
          معاينة
        </button>
      </div>
    </article>
  );

  return (
    <AppShell subtitle="بحث متقدم" contentClassName="search-content" tipsPage="search">
      <PageToolbar
        eyebrow={<span className="badge">Search Workbench</span>}
        title="البحث المتقدم"
        description="بحث موحد في السجلات مع facets من الخادم، حفظ بحث دائم، ومعاينة سريعة للنتائج دون مغادرة الصفحة."
        meta={(
          <>
            <span className="badge">{filteredRecords.length} نتيجة</span>
            <span className="badge">{typeOptions.length} نوع</span>
            <span className="badge">{savedSearches.length} بحث محفوظ</span>
          </>
        )}
        actions={(
          <>
            <button type="button" className="button button-primary" onClick={() => void saveCurrentSearch()} disabled={!query.trim() && !store && typeFilter === "all" && !tagFilter}>
              حفظ البحث
            </button>
            <button type="button" className="button button-secondary" onClick={resetSearch}>
              تصفير
            </button>
            <a className="button button-secondary" href="/search/saved">
              إدارة البحوث المحفوظة
            </a>
          </>
        )}
      >
        <form className="archive-toolbar-grid" onSubmit={handleSearch}>
          <label>
            <span>الكلمات المفتاحية</span>
            <input
              type="search"
              placeholder={'العنوان، الوسوم، الوصف... أو type:video AND tag:"تاريخ شفهي"'}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="search-input"
              aria-describedby="advanced-search-hint"
            />
            <span id="advanced-search-hint" className="helper-text">
              للبحث المهيكل استخدم مثلاً: <code dir="ltr">type:video AND tag:"تاريخ شفهي"</code>
            </span>
          </label>
          <label>
            <span>المخزن</span>
            <input
              type="text"
              placeholder="اتركه فارغاً لكل المخازن"
              value={store}
              onChange={(event) => setStore(event.target.value)}
              className="search-input"
            />
          </label>
          <label>
            <span>النوع</span>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">كل الأنواع</option>
              {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label>
            <span>الوسم</span>
            <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
              <option value="">كل الوسوم</option>
              {tagOptions.map((tag) => <option key={tag.value} value={tag.value}>{tag.label} ({tag.count})</option>)}
            </select>
          </label>
          <div className="archive-toolbar-actions">
            <button type="submit" className="button button-primary">بحث</button>
          </div>
        </form>
        <div className="archive-toolbar-row">
          <DataViewSwitcher value={viewMode} options={searchViewOptions} onChange={setViewMode} label="طريقة عرض البحث" />
          {savedSearches.length > 0 ? (
            <div className="saved-views-strip" aria-label="بحوث محفوظة">
              {savedSearches.map((saved) => (
                <span key={saved.id} className="saved-view-chip">
                  <button type="button" onClick={() => void applySavedSearch(saved)}>{saved.name}</button>
                  <button type="button" aria-label={`حذف ${saved.name}`} onClick={() => void removeSavedSearch(saved.id)}>×</button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {facets ? (
          <div className="facet-strip" aria-label="ملخص facets">
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
        <EmptyState
          title="ابدأ بكتابة كلمة بحث."
          description="استخدم البحث العام للوصول إلى السجلات، ثم احفظ البحث في الخادم إذا كان يتكرر في عملك اليومي."
        />
      ) : null}

      {state.status === "loading" ? (
        <div className="panel panel-compact" aria-live="polite" role="status">
          <p className="form-status">جار البحث...</p>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تنفيذ البحث</strong>
          <span className="helper-text">{state.message}</span>
        </div>
      ) : null}

      {state.status === "ready" && visibleRecords.length === 0 ? (
        <EmptyState
          title="لم يتم العثور على سجلات."
          description="جرّب بحثاً مختلفاً، أو أزل فلتر النوع/الوسم، أو راجع المخزن المحدد."
          actions={<button type="button" className="button button-secondary" onClick={resetSearch}>تصفير البحث</button>}
        />
      ) : null}

      {state.status === "ready" && visibleRecords.length > 0 ? (
        <section className="search-workspace" aria-label="نتائج البحث">
          <div className="search-results-surface" data-view={viewMode}>
            <div className="panel panel-compact">
              <p className="form-status">
                {resultCount.label}
                {typeof state.total === "number" ? ` · الإجمالي في الخادم: ${state.total}` : ""}
                {query ? ` · البحث عن: "${query}"` : ""}
              </p>
            </div>

            {visibleRecords.map(renderRecord)}

            {localEnrichment.suggestedTags.length > 0 || localEnrichment.entities.length > 0 ? (
              <section className="panel stack" aria-label="إثراء محلي للبحث">
                <div className="panel-title-row">
                  <div>
                    <span className="badge">Local semantic fallback</span>
                    <h2>وسوم وكيانات مقترحة محلياً</h2>
                    <p className="helper-text">
                      قواعد محلية آمنة فوق النتائج الحالية؛ لا ترسل البيانات لأي مزود خارجي ولا تعدّل السجلات تلقائياً.
                    </p>
                  </div>
                  <span className="badge">{localEnrichment.coverage.recordsWithSuggestions} سجل قابل للتحسين</span>
                </div>

                {localEnrichment.suggestedTags.length > 0 ? (
                  <div>
                    <strong>وسوم مقترحة</strong>
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
                    <strong>كيانات مستخرجة</strong>
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

            <SuggestionsPanel suggestions={suggestions} title="تحسينات مقترحة للبحث والأرشيف" onFeedback={handleSuggestionFeedback} />

            {totalPages > 1 ? (
              <div className="pagination">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="button button-secondary"
                >
                  السابق
                </button>
                <span className="form-status">
                  الصفحة {currentPage} من {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="button button-secondary"
                >
                  التالي
                </button>
              </div>
            ) : null}
          </div>

          <aside className="record-preview-rail" aria-label="معاينة نتيجة البحث">
            {previewRecord ? (
              <>
                <div className="panel-section-header">
                  <span className="badge">معاينة</span>
                  <h2>{previewRecord.title || "بدون عنوان"}</h2>
                </div>
                <p>{previewRecord.description || "لا يوجد وصف محفوظ لهذا السجل."}</p>
                <div className="kv-grid">
                  <div className="kv-item">
                    <strong>المخزن</strong>
                    <span>{previewRecord.store || "-"}</span>
                  </div>
                  <div className="kv-item">
                    <strong>النوع</strong>
                    <span>{previewRecord.type || "-"}</span>
                  </div>
                  <div className="kv-item">
                    <strong>الوسم المحدد</strong>
                    <span>{tagFilter ? facetLabel(tagOptions, tagFilter) : "-"}</span>
                  </div>
                  <div className="kv-item">
                    <strong>التحديث</strong>
                    <span>{formatDate(previewRecord.updatedAt || previewRecord.createdAt)}</span>
                  </div>
                </div>
                {previewRecord.tags && previewRecord.tags.length > 0 ? (
                  <div className="tags">
                    {previewRecord.tags.map((tag) => <span key={tag} className="tag">{tag}</span>)}
                  </div>
                ) : null}
                <a className="button button-primary" href={`/archive/${encodeURIComponent(previewRecord.id)}`}>
                  فتح التفاصيل
                </a>
              </>
            ) : (
              <EmptyState title="لا توجد معاينة." description="اختر نتيجة من القائمة لعرض ملخصها." />
            )}
          </aside>
        </section>
      ) : null}
    </AppShell>
  );
}
