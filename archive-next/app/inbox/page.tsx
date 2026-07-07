"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type InboxItem, type InboxStatus } from "@/lib/archive-api";
import { formatDate, normalizeText } from "@/lib/record-utils";

const statusLabels: Record<InboxStatus, string> = {
  new: "وارد جديد",
  triage: "قيد الفرز",
  ready: "جاهز للأرشفة",
  done: "مكتمل"
};

export default function InboxPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<InboxStatus | "all">("all");

  async function refreshInbox() {
    const response = await api.inboxItems();
    if (response.ok) setItems(response.items);
    else setStatusMessage(response.error || "تعذر تحميل الوارد.");
  }

  useEffect(() => {
    void refreshInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const visibleItems = useMemo(() => {
    return filter === "all" ? items : items.filter((item) => item.status === filter);
  }, [filter, items]);

  const counts = useMemo(() => {
    return items.reduce<Record<InboxStatus, number>>((acc, item) => {
      acc[item.status] += 1;
      return acc;
    }, { new: 0, triage: 0, ready: 0, done: 0 });
  }, [items]);

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setStatusMessage("جار الحفظ...");
    const response = await api.createInboxItem({ title: title.trim(), source: source.trim(), note: note.trim() });
    if (!response.ok) {
      setStatusMessage(response.error || "تعذر إضافة العنصر.");
      return;
    }
    setStatusMessage("تمت الإضافة إلى Laravel.");
    setTitle("");
    setSource("");
    setNote("");
    await refreshInbox();
  }

  async function updateStatus(id: string, status: InboxStatus) {
    const response = await api.updateInboxItem(id, { status });
    if (!response.ok) setStatusMessage(response.error || "تعذر تحديث الحالة.");
    await refreshInbox();
  }

  async function removeItem(id: string) {
    const response = await api.deleteInboxItem(id);
    if (!response.ok) setStatusMessage(response.error || "تعذر حذف العنصر.");
    await refreshInbox();
  }

  return (
    <AppShell subtitle="صندوق الوارد" contentClassName="local-list-content">
      <PageToolbar
        eyebrow={<span className="badge">Capture</span>}
        title="صندوق الوارد"
        description="التقاط سريع للمواد أو الأفكار قبل الأرشفة، محفوظ في Laravel لكل مستخدم."
        meta={(
          <>
            <span className="badge">{items.length} عنصر</span>
            <span className="badge">{counts.ready} جاهز للأرشفة</span>
          </>
        )}
        actions={<a className="button button-primary" href="/uploads">رفع ملف</a>}
      >
        <form className="archive-toolbar-grid" onSubmit={addItem}>
          <label>
            <span>العنوان</span>
            <input className="search-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مادة أو مهمة فرز" />
          </label>
          <label>
            <span>المصدر</span>
            <input className="search-input" value={source} onChange={(event) => setSource(event.target.value)} placeholder="مجلد، جهة، رابط..." />
          </label>
          <label className="full-span">
            <span>ملاحظة</span>
            <textarea className="search-input" value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
          </label>
          <div className="archive-toolbar-actions">
            <button className="button button-primary" type="submit" disabled={!title.trim()}>إضافة للوارد</button>
          </div>
        </form>
        {statusMessage ? <p className="form-status">{statusMessage}</p> : null}
        <div className="archive-toolbar-row">
          <button className="badge" data-active={filter === "all" ? "true" : "false"} type="button" onClick={() => setFilter("all")}>الكل · {items.length}</button>
          {(Object.keys(statusLabels) as InboxStatus[]).map((status) => (
            <button key={status} className="badge" data-active={filter === status ? "true" : "false"} type="button" onClick={() => setFilter(status)}>
              {statusLabels[status]} · {counts[status]}
            </button>
          ))}
        </div>
      </PageToolbar>

      {visibleItems.length === 0 ? (
        <EmptyState title="لا توجد عناصر في هذا العرض." description="أضف عنصراً سريعاً أو غيّر فلتر الحالة." />
      ) : (
        <section className="dense-grid" aria-label="عناصر الوارد">
          {visibleItems.map((item) => (
            <article className="local-list-card" key={item.id}>
              <div className="local-list-card__main">
                <div>
                  <span className="badge">{statusLabels[item.status]}</span>
                  <h3>{item.title}</h3>
                </div>
                <span className="badge">{item.createdAt ? formatDate(item.createdAt) : "-"}</span>
              </div>
              <dl className="mobile-field-list">
                <div><dt>المصدر</dt><dd dir="auto">{item.source || "-"}</dd></div>
                <div><dt>الملاحظة</dt><dd>{item.note || "-"}</dd></div>
              </dl>
              <div className="button-row">
                <select value={item.status} onChange={(event) => void updateStatus(item.id, event.target.value as InboxStatus)} aria-label={`حالة ${item.title}`}>
                  {(Object.keys(statusLabels) as InboxStatus[]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                </select>
                <a className="button button-secondary button-sm" href={`/search?q=${encodeURIComponent(normalizeText(item.title))}`}>بحث مشابه</a>
                <button className="button button-danger button-sm" type="button" onClick={() => void removeItem(item.id)}>حذف</button>
              </div>
            </article>
          ))}
        </section>
      )}
    </AppShell>
  );
}
