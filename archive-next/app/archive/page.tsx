"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";

type ArchiveState =
  | { status: "loading" }
  | { status: "ready"; records: ArchiveRecord[] }
  | { status: "error"; message: string };

export default function ArchivePage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<ArchiveState>({ status: "loading" });
  const [query, setQuery] = useState("");

  const loadRecords = useCallback(async (q: string) => {
    setState({ status: "loading" });
    const response = await api.search({ q, limit: 20 });

    if (!response.ok) {
      setState({ status: "error", message: response.error });
      return;
    }

    setState({
      status: "ready",
      records: response.records
    });
  }, [api]);

  useEffect(() => {
    void loadRecords("");
  }, [loadRecords]);

  const handleSearch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await loadRecords(query);
  };

  return (
    <main className="shell">
      <AppHeader subtitle="قائمة السجلات" />

      <section className="content" aria-label="بحث السجلات">
        <div className="hero">
          <h1>بحث السجلات المحفوظة.</h1>
          <p>
            هذا المسار ينقل قائمة السجلات وواجهة البحث الأساسية إلى Next.js.
            أدخل كلمة مفتاحية للبحث أو اترك الحقل فارغا لعرض جميع السجلات.
          </p>
          <div className="hero-actions">
            <span className="badge">Next.js archive listing</span>
            <span className="badge">
              {state.status === "ready" ? `${state.records.length} نتيجة` : "عرض مباشر"}
            </span>
          </div>
        </div>

        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="ابحث عن السجلات..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="button button-primary">بحث</button>
        </form>

        {state.status === "loading" && <p className="form-status" aria-live="polite">جار تحميل السجلات...</p>}

        {state.status === "error" && (
          <div className="state-banner state-banner-error" role="alert">
            <strong>تعذر تحميل السجلات</strong>
            <span className="helper-text">{state.message}</span>
          </div>
        )}

        {state.status === "ready" && (
          <>
            {state.records.length === 0 ? (
              <div className="empty-state">
                <strong>لم يتم العثور على سجلات.</strong>
                <p className="helper-text">جرّب كلمة أقصر أو أزل الفلتر الحالي.</p>
              </div>
            ) : (
              <div className="grid" aria-label="السجلات المحفوظة">
                {state.records.map((record) => (
                  <article className="panel panel-compact" key={record.id}>
                    <div className="panel-title-row">
                      <h2>
                        <a href={`/archive/${encodeURIComponent(record.id)}`}>{record.title}</a>
                      </h2>
                      {record.createdAt ? (
                        <time className="created-at">
                          {new Date(record.createdAt).toLocaleDateString("ar-SA")}
                        </time>
                      ) : null}
                    </div>
                    {record.description ? <p>{record.description}</p> : null}
                    <div className="record-meta">
                      {record.store ? (
                        <span className="badge">{record.store}</span>
                      ) : null}
                      {record.type ? (
                        <span className="badge">{record.type}</span>
                      ) : null}
                    </div>
                    {record.tags && record.tags.length > 0 ? (
                      <div className="tags">
                        {record.tags.map((tag) => (
                          <span key={tag} className="tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
