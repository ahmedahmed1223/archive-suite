"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import WorkspacePositionRestorer from "@/components/WorkspacePositionRestorer";
import { createArchiveApiClient, type PublicCatalogRecord } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type CatalogState =
  | { status: "loading"; records: PublicCatalogRecord[]; nextCursor?: string | null }
  | { status: "ready"; records: PublicCatalogRecord[]; nextCursor?: string | null }
  | { status: "error"; records: PublicCatalogRecord[]; nextCursor?: string | null; message: string };

interface CatalogFilters {
  q: string;
  type: string;
  tag: string;
}

function formatDate(value: string | null | undefined, locale: "ar" | "en") {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(locale === "en" ? "en-US" : "ar-SA");
}

export default function PublicCatalogPage() {
  const { locale, t } = useLocale();
  const copy = locale === "en" ? {
    publishedOnly: "Published only", title: "Public catalogue", description: "Published records for public viewing with limited fields. Files, internal notes, and operational data are excluded.", records: "records", readOnly: "Read only", filters: "Catalogue filters", search: "Search", searchPlaceholder: "Title, description, type, or tag", type: "Type", tag: "Tag", apply: "Apply", clear: "Clear", loadError: "Could not load the catalogue", loading: "Loading catalogue", loadingDescription: "Only published records are being retrieved.", emptyTitle: "No published records", emptyDescription: "Change the filters or publish records from the workspace to show them here.", publishedRecords: "Published records", untitled: "Untitled", record: "record", tags: "Record tags", loadingMore: "Loading…", loadMore: "Load more",
  } : {
    publishedOnly: "منشور فقط", title: "الكتالوج العام", description: "سجلات منشورة للعرض العام بحقول محدودة، دون ملفات أو ملاحظات داخلية أو بيانات تشغيلية.", records: "سجل", readOnly: "قراءة فقط", filters: "فلاتر الكتالوج", search: "بحث", searchPlaceholder: "عنوان، وصف، نوع، أو وسم", type: "النوع", tag: "وسم", apply: "تطبيق", clear: "مسح", loadError: "تعذر تحميل الكتالوج", loading: "جارٍ تحميل الكتالوج", loadingDescription: "يتم جلب السجلات المنشورة فقط.", emptyTitle: "لا توجد سجلات منشورة", emptyDescription: "غيّر الفلاتر أو انشر سجلات من داخل مساحة العمل لتظهر هنا.", publishedRecords: "السجلات المنشورة", untitled: "بدون عنوان", record: "سجل", tags: "وسوم السجل", loadingMore: "جارٍ التحميل…", loadMore: "تحميل المزيد",
  };
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
      <WorkspacePositionRestorer />
      <PublicHeader subtitle={t.pageTitles.publicCatalogue} />

      <section className="content public-content" aria-label={copy.title}>
        <PageToolbar
          eyebrow={<span className="badge">{copy.publishedOnly}</span>}
          title={copy.title}
          description={copy.description}
          meta={
            <>
              <span className="badge">{state.records.length} {copy.records}</span>
              <span className="badge">{copy.readOnly}</span>
            </>
          }
        />

        <form className="panel form-grid" onSubmit={applyFilters} aria-label={copy.filters}>
          <label>
            {copy.search}
            <input
              value={filters.q}
              onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
              placeholder={copy.searchPlaceholder}
            />
          </label>
          <label>
            {copy.type}
            <input
              value={filters.type}
              onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}
              placeholder="video"
              dir="ltr"
            />
          </label>
          <label>
            {copy.tag}
            <input
              value={filters.tag}
              onChange={(event) => setFilters((current) => ({ ...current, tag: event.target.value }))}
              placeholder="public"
            />
          </label>
          <div className="button-row form-actions">
            <button className="button button-primary" type="submit">
              {copy.apply}
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
              {copy.clear}
            </button>
          </div>
        </form>

        {state.status === "error" ? (
          <div className="state-banner state-banner-error" role="alert">
            <strong>{copy.loadError}</strong>
            <p className="helper-text">{state.message}</p>
          </div>
        ) : null}

        {state.status === "loading" && state.records.length === 0 ? (
          <div className="state-banner" role="status">
            <strong>{copy.loading}</strong>
            <p className="helper-text">{copy.loadingDescription}</p>
          </div>
        ) : null}

        {state.status !== "loading" && state.records.length === 0 ? (
          <EmptyState
            title={copy.emptyTitle}
            description={copy.emptyDescription}
          />
        ) : null}

        {state.records.length > 0 ? (
          <section className="record-grid" aria-label={copy.publishedRecords}>
            {state.records.map((record) => (
              <article className="panel" key={record.uid}>
                <div className="panel-title-row">
                  <div>
                    <span className="badge">{record.type ?? copy.record}</span>
                    <h2>{record.title || copy.untitled}</h2>
                  </div>
                  <span className="badge">{formatDate(record.updatedAt ?? record.createdAt, locale)}</span>
                </div>
                {record.description ? <p>{record.description}</p> : null}
                <div className="record-meta">
                  <span className="badge wrap-anywhere" dir="ltr">{record.uid}</span>
                  {record.subtype ? <span className="badge">{record.subtype}</span> : null}
                </div>
                {record.tags.length > 0 ? (
                  <div className="tag-list" aria-label={copy.tags}>
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
              {state.status === "loading" ? copy.loadingMore : copy.loadMore}
            </button>
          </div>
        ) : null}
      </section>

      <PublicFooter />
    </main>
  );
}
