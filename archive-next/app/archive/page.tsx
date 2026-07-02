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
          <h1>السجلات المحفوظة.</h1>
          <p>
            استعرض كل السجلات أو ابحث بالكلمات المفتاحية. اتركه فارغاً لعرض أحدث
            السجلات، أو اضغط على أي نتيجة لفتح التفاصيل كاملة والحقوق.
          </p>
          <div className="hero-actions">
            <span className="badge">بحث فوري</span>
            <span className="badge">
              {state.status === "ready" ? `${state.records.length} نتيجة` : ""}
            </span>
          </div>
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
          <button type="submit" className="button button-primary">بحث</button>
        </form>

        {state.status === "loading" && (
          <div className="panel panel-compact" aria-live="polite" role="status">
            <p className="form-status">جار تحميل السجلات...</p>
          </div>
        )}

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
                <p className="helper-text">جرّب بحثاً أقصر أو اترك الحقل فارغاً لعرض الكل.</p>
              </div>
            ) : (
              <div aria-label={`${state.records.length} نتيجة`}>
                <div className="split-layout">
                  <div>
                    <div className="grid" role="list">
                      {state.records.map((record) => (
                        <article className="panel panel-compact" key={record.id} role="listitem">
                          <div className="panel-title-row">
                            <h2>
                              <a
                                href={`/archive/${encodeURIComponent(record.id)}`}
                                className="text-accent"
                                title={record.description || record.title}
                              >
                                {record.title || "بدون عنوان"}
                              </a>
                            </h2>
                          </div>
                          {record.description ? (
                            <p className="text-sm">{record.description.substring(0, 120)}{record.description.length > 120 ? "…" : ""}</p>
                          ) : null}
                          <div className="record-meta">
                            {record.store ? (
                              <span className="badge">{record.store}</span>
                            ) : null}
                            {record.type ? (
                              <span className="badge">{record.type}</span>
                            ) : null}
                            {record.createdAt ? (
                              <time className="created-at text-xs">
                                {new Date(record.createdAt).toLocaleDateString("ar-SA")}
                              </time>
                            ) : null}
                          </div>
                          {record.tags && record.tags.length > 0 ? (
                            <div className="tags">
                              {record.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="tag">
                                  {tag}
                                </span>
                              ))}
                              {record.tags.length > 3 ? (
                                <span className="tag muted">+{record.tags.length - 3}</span>
                              ) : null}
                            </div>
                          ) : null}
                          <a
                            href={`/archive/${encodeURIComponent(record.id)}`}
                            className="button button-secondary button-sm inline-flex"
                            style={{ marginTop: "0.5rem" }}
                          >
                            فتح التفاصيل →
                          </a>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
