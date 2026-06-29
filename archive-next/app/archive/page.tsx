"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";

type ArchiveState =
  | { status: "loading" }
  | { status: "ready"; records: ArchiveRecord[] }
  | { status: "error"; message: string };

export default function ArchivePage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<ArchiveState>({ status: "loading" });
  const [query, setQuery] = useState("");

  // Load initial records on mount
  const loadRecords = async (q: string) => {
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
  };

  // Initialize on mount
  useEffect(() => {
    let active = true;
    loadRecords("").then(() => {
      if (!active) return;
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSearch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await loadRecords(query);
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>Archive Suite</strong>
          <span>قائمة السجلات</span>
        </div>
        <a className="badge" href="/">حالة الترحيل</a>
      </header>

      <section className="content" aria-label="بحث السجلات">
        <div className="hero">
          <span className="badge">Next.js archive listing</span>
          <h1>بحث السجلات المحفوظة.</h1>
          <p>
            هذا المسار ينقل قائمة السجلات وواجهة البحث الأساسية إلى Next.js.
            أدخل كلمة مفتاحية للبحث أو اترك الحقل فارغا لعرض جميع السجلات.
          </p>
        </div>

        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="ابحث عن السجلات..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="badge">بحث</button>
        </form>

        {state.status === "loading" && (
          <p className="form-status">جار تحميل السجلات...</p>
        )}

        {state.status === "error" && (
          <p className="form-status" role="alert">{state.message}</p>
        )}

        {state.status === "ready" && (
          <>
            {state.records.length === 0 ? (
              <p className="form-status">لم يتم العثور على سجلات.</p>
            ) : (
              <div className="grid" aria-label="السجلات المحفوظة">
                {state.records.map((record) => (
                  <article className="panel" key={record.id}>
                    <h2>{record.title}</h2>
                    {record.description ? (
                      <p>{record.description}</p>
                    ) : null}
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
                    {record.createdAt ? (
                      <time className="created-at">
                        {new Date(record.createdAt).toLocaleDateString("ar-SA")}
                      </time>
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
