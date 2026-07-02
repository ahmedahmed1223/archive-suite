"use client";

import type { FormEvent } from "react";
import { Suspense, useMemo, useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";
import AppHeader from "@/components/AppHeader";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; records: ArchiveRecord[]; total: number; cursor: string | null }
  | { status: "error"; message: string };

// useSearchParams requires a Suspense boundary for static prerendering.
export default function SearchPage() {
  return (
    <Suspense fallback={<main className="content"><p className="helper-text">جارٍ تحميل البحث...</p></main>}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = useMemo(() => createArchiveApiClient(), []);

  const initialQuery = searchParams.get("q") || "";
  const initialStore = searchParams.get("store") || "";
  const initialPage = parseInt(searchParams.get("page") || "1", 10);
  const initialPageSize = parseInt(searchParams.get("limit") || "20", 10);

  const [query, setQuery] = useState(initialQuery);
  const [store, setStore] = useState(initialStore);
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [pageSize] = useState(initialPageSize);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [allRecords, setAllRecords] = useState<ArchiveRecord[]>([]);

  const updateParams = useCallback(
    (q: string, s: string, page: number) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (s) params.set("store", s);
      if (page > 1) params.set("page", String(page));
      if (pageSize !== 20) params.set("limit", String(pageSize));

      const queryString = params.toString();
      router.replace(queryString ? `/search?${queryString}` : "/search");
    },
    [router, pageSize]
  );

  const search = useCallback(
    async (q: string, s: string, page: number = 1) => {
      if (!q.trim() && page === 1) {
        setState({ status: "idle" });
        setAllRecords([]);
        return;
      }

      setState({ status: "loading" });
      const response = await api.search({ q, store: s, limit: 1000 });

      if (!response.ok) {
        setState({ status: "error", message: response.error });
        return;
      }

      setAllRecords(response.records);
      setState({
        status: "ready",
        records: response.records,
        total: response.records.length,
        cursor: null
      });
    },
    [api]
  );

  const handleSearch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCurrentPage(1);
    await search(query, store, 1);
    updateParams(query, store, 1);
  };

  useEffect(() => {
    if (initialQuery) {
      search(initialQuery, initialStore, initialPage);
    }
  }, []);

  const visibleRecords = useMemo(() => {
    if (state.status !== "ready") return [];
    const start = (currentPage - 1) * pageSize;
    return allRecords.slice(start, start + pageSize);
  }, [state, allRecords, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (state.status !== "ready") return 1;
    return Math.ceil(state.total / pageSize);
  }, [state, pageSize]);

  const handlePageChange = (newPage: number) => {
    const clamped = Math.max(1, Math.min(newPage, totalPages));
    setCurrentPage(clamped);
    updateParams(query, store, clamped);
  };

  return (
    <main className="shell">
      <AppHeader subtitle="بحث متقدم" />

      <section className="content" aria-label="بحث السجلات">
        <div className="hero">
          <h1>البحث المتقدم</h1>
          <p>
            ابحث عن السجلات حسب الكلمات المفتاحية. يمكنك تصفية حسب المتجر أو الاستعراض
            المباشر للعناصر.
          </p>
        </div>

        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="ابحث عن العنوان أو الوسم أو الوصف..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input"
            autoFocus
          />
          {store && (
            <select
              value={store}
              onChange={(e) => setStore(e.target.value)}
              className="search-input"
            >
              <option value="">كل المتاجر</option>
              <option value={store}>{store}</option>
            </select>
          )}
          <button type="submit" className="button button-primary">بحث</button>
        </form>

        {state.status === "idle" && (
          <div className="empty-state">
            <strong>ابدأ بكتابة كلمة بحث</strong>
            <p className="helper-text">اكتب في حقل البحث أعلاه للبدء في البحث عن السجلات.</p>
          </div>
        )}

        {state.status === "loading" && (
          <div className="panel panel-compact" aria-live="polite" role="status">
            <p className="form-status">جار البحث...</p>
          </div>
        )}

        {state.status === "error" && (
          <div className="state-banner state-banner-error" role="alert">
            <strong>تعذر تنفيذ البحث</strong>
            <span className="helper-text">{state.message}</span>
          </div>
        )}

        {state.status === "ready" && visibleRecords.length === 0 && (
          <div className="empty-state">
            <strong>لم يتم العثور على سجلات</strong>
            <p className="helper-text">جرّب بحثاً مختلفاً أو أزل بعض معايير التصفية.</p>
          </div>
        )}

        {state.status === "ready" && visibleRecords.length > 0 && (
          <>
            <div className="split-layout">
              <div>
                <div className="panel panel-compact">
                  <p className="form-status">
                    عرض {visibleRecords.length} من {state.total} نتيجة
                    {query && ` • البحث عن: "${query}"`}
                  </p>
                </div>

                <div className="grid" role="list">
                  {visibleRecords.map((record) => (
                    <article className="panel panel-compact" key={record.id} role="listitem">
                      <div className="panel-title-row">
                        <h3>{record.title || "بدون عنوان"}</h3>
                      </div>
                      {record.description && (
                        <p className="helper-text">{record.description}</p>
                      )}
                      {record.type && (
                        <div className="badge">{record.type}</div>
                      )}
                      {record.tags && record.tags.length > 0 && (
                        <div className="tags">
                          {record.tags.slice(0, 5).map((tag) => (
                            <span key={tag} className="tag">{tag}</span>
                          ))}
                        </div>
                      )}
                      <a href={`/archive/${record.id}`} className="button button-secondary">
                        فتح التفاصيل
                      </a>
                    </article>
                  ))}
                </div>

                {totalPages > 1 && (
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
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
