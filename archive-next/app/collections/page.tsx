"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import ChangeImpactPreview from "@/components/ChangeImpactPreview";
import { createArchiveApiClient, type ArchiveRecord, type Collection } from "@/lib/archive-api";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { buildChangeImpact } from "@/lib/change-impact";
import { countBy, formatDate, recordMatches, uniqueSorted } from "@/lib/record-utils";
import { toastError, toastSuccess } from "@/lib/toast";
import { Skeleton } from "@/components/ui/Skeleton";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; records: ArchiveRecord[] }
  | { status: "error"; message: string };

type CollectionsLoadState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

export default function CollectionsPage() {
  const dialogs = useConfirmDialog();
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionsState, setCollectionsState] = useState<CollectionsLoadState>({ status: "loading" });
  const [statusMessage, setStatusMessage] = useState("");
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [tag, setTag] = useState("all");

  async function refreshCollections() {
    setCollectionsState({ status: "loading" });
    const response = await api.collections();
    if (response.ok) {
      setCollections(response.collections);
      setCollectionsState({ status: "ready" });
    } else {
      const message = response.error || "تعذر تحميل المجموعات.";
      setCollectionsState({ status: "error", message });
      setStatusMessage(message);
    }
  }

  useEffect(() => {
    void refreshCollections();
    void (async () => {
      const response = await api.search({ limit: 1000 });
      setState(response.ok ? { status: "ready", records: response.records } : { status: "error", message: response.error });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const records = state.status === "ready" ? state.records : [];
  const types = useMemo(() => uniqueSorted(records.map((record) => record.type)), [records]);
  const tags = useMemo(() => uniqueSorted(records.flatMap((record) => record.tags || [])), [records]);
  const smartSuggestions = useMemo(() => {
    const topTypes = countBy(records.map((record) => record.type || "").filter(Boolean)).slice(0, 4);
    const topTags = countBy(records.flatMap((record) => record.tags || [])).slice(0, 4);
    return [
      ...topTypes.map(([value, count]) => ({ label: `نوع: ${value}`, type: value, tag: "all", count })),
      ...topTags.map(([value, count]) => ({ label: `وسم: ${value}`, type: "all", tag: value, count }))
    ].slice(0, 6);
  }, [records]);

  async function createCollection(payload: { name: string; query?: string; type?: string; tag?: string }) {
    setStatusMessage("جار حفظ المجموعة...");
    const response = await api.createCollection(payload);
    if (!response.ok) {
      const message = response.error || "تعذر حفظ المجموعة.";
      setStatusMessage(message);
      toastError(message);
      return;
    }
    setStatusMessage("تم حفظ المجموعة.");
    toastSuccess("تم حفظ المجموعة.");
    await refreshCollections();
  }

  async function addCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    await createCollection({ name: name.trim(), query: query.trim(), type, tag });
    setName("");
    setQuery("");
    setType("all");
    setTag("all");
  }

  async function removeCollection(id: string) {
    if (state.status !== "ready") {
      setStatusMessage("تعذر تأكيد عدد السجلات قبل اكتمال التحميل.");
      return;
    }
    const collection = collections.find((item) => item.id === id);
    if (
      collection &&
      !(await dialogs.confirm({
        title: "حذف المجموعة",
        message: `حذف المجموعة لا يحذف السجلات نفسها. تحتوي المجموعة حالياً على ${records.filter((record) => recordMatches(record, collection)).length} سجل. هل تريد المتابعة؟`,
        confirmLabel: "حذف",
        destructive: true
      }))
    )
      return;
    const response = await api.deleteCollection(id);
    if (!response.ok) setStatusMessage(response.error || "تعذر حذف المجموعة.");
    else setStatusMessage("تم حذف المجموعة.");
    await refreshCollections();
  }

  async function saveSuggestion(suggestion: { label: string; type: string; tag: string }) {
    await createCollection({ name: suggestion.label, type: suggestion.type, tag: suggestion.tag });
  }

  return (
    <AppShell subtitle="المجموعات" contentClassName="local-list-content" tipsPage="collections">
      <PageToolbar
        eyebrow={<span className="badge">Organize</span>}
        title="المجموعات"
        description="تجميعات يدوية وذكية خفيفة فوق السجلات الحالية، محفوظة في الخادم لكل مستخدم."
        meta={(
          <>
            <span className="badge">{collections.length} مجموعة</span>
            <span className="badge">{records.length} سجل قابل للتجميع</span>
          </>
        )}
        actions={<a className="button button-secondary" href="/archive">فتح الأرشيف</a>}
      >
        <form className="archive-toolbar-grid" onSubmit={addCollection}>
          <label>
            <span>اسم المجموعة</span>
            <input className="search-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="مثال: مواد تحتاج مراجعة" />
          </label>
          <label>
            <span>بحث داخلي</span>
            <input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="كلمة أو وصف" />
          </label>
          <label>
            <span>النوع</span>
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="all">كل الأنواع</option>
              {types.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>وسم</span>
            <select value={tag} onChange={(event) => setTag(event.target.value)}>
              <option value="all">كل الوسوم</option>
              {tags.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <div className="archive-toolbar-actions">
            <button className="button button-primary" type="submit" disabled={!name.trim()}>حفظ المجموعة</button>
          </div>
        </form>
        {statusMessage ? <p className="form-status">{statusMessage}</p> : null}
      </PageToolbar>

      {state.status === "loading" ? <div className="panel panel-compact"><Skeleton label="جار تحميل السجلات..." /></div> : null}
      {state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل السجلات</strong>
          <span className="helper-text">{state.message}</span>
        </div>
      ) : null}

      {collectionsState.status === "loading" ? <div className="panel panel-compact"><Skeleton label="جار تحميل المجموعات..." /></div> : null}
      {collectionsState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل المجموعات</strong>
          <span className="helper-text">{collectionsState.message}</span>
          <div><button className="button button-secondary button-sm" type="button" onClick={() => void refreshCollections()}>إعادة المحاولة</button></div>
        </div>
      ) : null}

      {collectionsState.status === "ready" && collections.length === 0 ? (
        <EmptyState
          title="لا توجد مجموعات محفوظة بعد."
          description="أنشئ مجموعة حسب بحث أو نوع أو وسم، أو استخدم أحد الاقتراحات الذكية أدناه."
        />
      ) : collectionsState.status === "ready" ? (
        <section className="dense-grid" aria-label="المجموعات المحفوظة">
          {collections.map((collection) => {
            const matches = state.status === "ready" ? records.filter((record) => recordMatches(record, collection)) : [];
            const searchTerm = collection.query || (collection.tag !== "all" ? collection.tag : collection.name);
            const searchHref = `/search?q=${encodeURIComponent(searchTerm)}${collection.type !== "all" ? `&type=${encodeURIComponent(collection.type)}` : ""}`;
            return (
              <article className="local-list-card" key={collection.id}>
                <div className="local-list-card__main">
                  <div>
                    <span className="badge">مجموعة</span>
                    <h3>{collection.name}</h3>
                  </div>
                  <strong className="metric-value">{matches.length}</strong>
                </div>
                <dl className="mobile-field-list">
                  <div><dt>النوع</dt><dd>{collection.type === "all" ? "كل الأنواع" : collection.type}</dd></div>
                  <div><dt>الوسم</dt><dd>{collection.tag === "all" ? "كل الوسوم" : collection.tag}</dd></div>
                  <div><dt>الإنشاء</dt><dd>{collection.createdAt ? formatDate(collection.createdAt) : "-"}</dd></div>
                </dl>
                <ChangeImpactPreview impact={buildChangeImpact({ action: "update", entity: "المجموعة", affectedCount: 0 })} />
                <p className="helper-text">{state.status === "ready" ? `المعاينة الحالية تشمل ${matches.length} سجل؛ حذف المجموعة لا يغيّر هذه السجلات.` : "تعذر تأكيد عدد السجلات قبل اكتمال التحميل."}</p>
                <div className="button-row">
                  <a className="button button-primary button-sm" href={searchHref}>عرض النتائج</a>
                  <button className="button button-danger button-sm" type="button" disabled={state.status !== "ready"} onClick={() => void removeCollection(collection.id)}>حذف</button>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {smartSuggestions.length > 0 ? (
        <section className="page-section" aria-labelledby="smart-collections-heading">
          <div className="toolbar-row toolbar-start">
            <h2 id="smart-collections-heading" className="section-heading">اقتراحات ذكية</h2>
            <span className="badge">من بيانات الأرشيف</span>
          </div>
          <div className="analytics-tag-list">
            {smartSuggestions.map((suggestion) => (
              <div className="analytics-tag-row" key={`${suggestion.type}-${suggestion.tag}`}>
                <span>{suggestion.label}</span>
                <div className="button-row">
                  <strong>{suggestion.count}</strong>
                  <button type="button" className="button button-secondary button-sm" onClick={() => void saveSuggestion(suggestion)}>حفظ</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
