"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import { createArchiveApiClient, type PublicCatalogRecord } from "@/lib/archive-api";

type CatalogState =
  | { status: "loading"; records: PublicCatalogRecord[]; nextCursor?: string | null }
  | { status: "ready"; records: PublicCatalogRecord[]; nextCursor?: string | null }
  | { status: "error"; records: PublicCatalogRecord[]; nextCursor?: string | null; message: string };

interface CatalogFilters {
  q: string;
  type: string;
  tag: string;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ar-SA");
}

export default function PublicCatalogPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [filters, setFilters] = useState<CatalogFilters>({ q: "", type: "", tag: "" });
  const [submittedFilters, setSubmittedFilters] = useState<CatalogFilters>(filters);
  const [state, setState] = useState<CatalogState>({ status: "loading", records: [] });

  useEffect(() => {
    let active = true;

    setState({ status: "loading", records: [] });
    api.publicCatalog({ ...submittedFilters, limit: 24 }).then((response) => {
      if (!active) return;

      if (!response.ok) {
        setState({ status: "error", records: [], message: response.error });
        return;
      }

      setState({
        status: "ready",
        records: response.records,
        nextCursor: response.nextCursor
      });
    });

    return () => {
      active = false;
    };
  }, [api, submittedFilters]);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittedFilters({
      q: filters.q.trim(),
      type: filters.type.trim(),
      tag: filters.tag.trim()
    });
  };

  const loadMore = async () => {
    if (!state.nextCursor || state.status === "loading") return;

    const currentRecords = state.records;
    setState({ status: "loading", records: currentRecords, nextCursor: state.nextCursor });
    const response = await api.publicCatalog({
      ...submittedFilters,
      cursor: state.nextCursor,
      limit: 24
    });

    if (!response.ok) {
      setState({
        status: "error",
        records: currentRecords,
        nextCursor: state.nextCursor,
        message: response.error
      });
      return;
    }

    setState({
      status: "ready",
      records: [...currentRecords, ...response.records],
      nextCursor: response.nextCursor
    });
  };

  return (
    <main className="shell">
      <PublicHeader subtitle="الكتالوج العام" />

      <section className="content public-content" aria-label="الكتالوج العام">
        <PageToolbar
          eyebrow={<span className="badge">منشور فقط</span>}
          title="الكتالوج العام"
          description="سجلات منشورة للعرض العام بحقول محدودة، دون ملفات أو ملاحظات داخلية أو بيانات تشغيلية."
          meta={
            <>
              <span className="badge">{state.records.length} سجل</span>
              <span className="badge">قراءة فقط</span>
            </>
          }
        />

        <form className="panel form-grid" onSubmit={applyFilters} aria-label="فلاتر الكتالوج">
          <label>
            بحث
            <input
              value={filters.q}
              onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
              placeholder="عنوان، وصف، نوع، أو وسم"
            />
          </label>
          <label>
            النوع
            <input
              value={filters.type}
              onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}
              placeholder="video"
              dir="ltr"
            />
          </label>
          <label>
            وسم
            <input
              value={filters.tag}
              onChange={(event) => setFilters((current) => ({ ...current, tag: event.target.value }))}
              placeholder="public"
            />
          </label>
          <div className="button-row form-actions">
            <button className="button button-primary" type="submit">
              تطبيق
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                const empty = { q: "", type: "", tag: "" };
                setFilters(empty);
                setSubmittedFilters(empty);
              }}
            >
              مسح
            </button>
          </div>
        </form>

        {state.status === "error" ? (
          <div className="state-banner state-banner-error" role="alert">
            <strong>تعذر تحميل الكتالوج</strong>
            <p className="helper-text">{state.message}</p>
          </div>
        ) : null}

        {state.status === "loading" && state.records.length === 0 ? (
          <div className="state-banner" role="status">
            <strong>جار تحميل الكتالوج</strong>
            <p className="helper-text">يتم جلب السجلات المنشورة فقط.</p>
          </div>
        ) : null}

        {state.status !== "loading" && state.records.length === 0 ? (
          <EmptyState
            title="لا توجد سجلات منشورة"
            description="غيّر الفلاتر أو انشر سجلات من داخل مساحة العمل لتظهر هنا."
          />
        ) : null}

        {state.records.length > 0 ? (
          <section className="record-grid" aria-label="السجلات المنشورة">
            {state.records.map((record) => (
              <article className="panel" key={record.uid}>
                <div className="panel-title-row">
                  <div>
                    <span className="badge">{record.type ?? "record"}</span>
                    <h2>{record.title || "بدون عنوان"}</h2>
                  </div>
                  <span className="badge">{formatDate(record.updatedAt ?? record.createdAt)}</span>
                </div>
                {record.description ? <p>{record.description}</p> : null}
                <div className="record-meta">
                  <span className="badge wrap-anywhere" dir="ltr">{record.uid}</span>
                  {record.subtype ? <span className="badge">{record.subtype}</span> : null}
                </div>
                {record.tags.length > 0 ? (
                  <div className="tag-list" aria-label="وسوم السجل">
                    {record.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
                  </div>
                ) : null}
              </article>
            ))}
          </section>
        ) : null}

        {state.nextCursor ? (
          <div className="button-row">
            <button className="button button-secondary" type="button" onClick={() => void loadMore()} disabled={state.status === "loading"}>
              {state.status === "loading" ? "جار التحميل..." : "تحميل المزيد"}
            </button>
          </div>
        ) : null}
      </section>

      <PublicFooter />
    </main>
  );
}
