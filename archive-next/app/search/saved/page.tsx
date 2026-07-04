"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type SavedSearch } from "@/lib/archive-api";

export default function SavedSearchesPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const response = await api.savedSearches();
    if (response.ok) setSearches(response.searches);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const response = await api.createSavedSearch({ name, query: query || undefined });

    if (!response.ok) {
      setError(response.error);
      return;
    }

    setName("");
    setQuery("");
    await refresh();
  }

  async function handleDelete(id: string) {
    const response = await api.deleteSavedSearch(id);
    if (response.ok) await refresh();
  }

  function runUrl(search: SavedSearch): string {
    const params = new URLSearchParams();
    if (search.query) params.set("q", search.query);
    const store = search.filters?.store;
    const type = search.filters?.type;
    if (typeof store === "string" && store) params.set("store", store);
    if (typeof type === "string" && type && type !== "all") params.set("type", type);
    const queryString = params.toString();
    return queryString ? `/search?${queryString}` : "/search";
  }

  return (
    <AppShell subtitle="البحوث المحفوظة" contentClassName="stack">
      <PageToolbar
        title="مدير البحوث المحفوظة"
        description="احفظ عمليات بحث متكررة وشغّلها لاحقًا دون إعادة كتابة الاستعلام والفلاتر."
        meta={<span className="badge">{searches.length} بحث محفوظ</span>}
        actions={<a className="button button-secondary" href="/search">فتح البحث المتقدم</a>}
      />

      <article className="panel">
        <form className="auth-form" onSubmit={handleCreate}>
          <label>
            اسم البحث
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            الاستعلام
            <input type="text" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <button type="submit" className="button button-primary">حفظ البحث</button>
          {error ? (
            <p className="form-status" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </article>

      {loading ? (
        <div className="panel panel-compact" role="status">
          <p className="form-status">جار تحميل البحوث المحفوظة...</p>
        </div>
      ) : null}

      {!loading && searches.length === 0 ? (
        <EmptyState title="لا توجد بحوث محفوظة." description="احفظ بحثًا من صفحة البحث المتقدم أو من النموذج أعلاه." />
      ) : null}

      {searches.length > 0 ? (
        <ul className="stack">
          {searches.map((search) => (
            <li key={search.id} className="panel panel-compact">
              <div className="panel-title-row">
                <h2>{search.name}</h2>
              </div>
              {search.query ? <p className="helper-text">الاستعلام: {search.query}</p> : null}
              <div className="button-row">
                <a className="button button-primary button-sm" href={runUrl(search)}>
                  تشغيل البحث
                </a>
                <button type="button" className="button button-secondary button-sm" onClick={() => void handleDelete(search.id)}>
                  حذف
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </AppShell>
  );
}
