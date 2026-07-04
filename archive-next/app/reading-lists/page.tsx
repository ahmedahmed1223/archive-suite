"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";

interface ReadingListItem {
  recordId: string;
  done: boolean;
  addedAt: string;
}

interface ReadingList {
  id: string;
  name: string;
  description: string;
  items: ReadingListItem[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "masar:reading-lists:v1";

function readLists(): ReadingList[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLists(lists: ReadingList[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ar-SA");
}

export default function ReadingListsPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [recordsError, setRecordsError] = useState("");
  const [lists, setLists] = useState<ReadingList[]>([]);
  const [activeId, setActiveId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [recordId, setRecordId] = useState("");

  useEffect(() => {
    const stored = readLists();
    setLists(stored);
    setActiveId(stored[0]?.id || "");

    void (async () => {
      const response = await api.search({ limit: 100 });
      if (response.ok) setRecords(response.records);
      else setRecordsError(response.error);
    })();
  }, [api]);

  const recordsById = useMemo(() => new Map(records.map((record) => [record.id, record])), [records]);
  const activeList = lists.find((list) => list.id === activeId) || lists[0] || null;
  const remainingCount = activeList?.items.filter((item) => !item.done).length ?? 0;
  const completedCount = activeList?.items.filter((item) => item.done).length ?? 0;

  function persist(nextLists: ReadingList[], nextActiveId = activeId) {
    writeLists(nextLists);
    setLists(nextLists);
    setActiveId(nextActiveId || nextLists[0]?.id || "");
  }

  function createList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;

    const now = new Date().toISOString();
    const next: ReadingList = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      items: [],
      createdAt: now,
      updatedAt: now
    };
    persist([next, ...lists], next.id);
    setName("");
    setDescription("");
  }

  function deleteList(id: string) {
    persist(lists.filter((list) => list.id !== id));
  }

  function addRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeList || !recordId) return;
    if (activeList.items.some((item) => item.recordId === recordId)) return;

    const now = new Date().toISOString();
    persist(lists.map((list) => list.id === activeList.id
      ? {
          ...list,
          items: [{ recordId, done: false, addedAt: now }, ...list.items],
          updatedAt: now
        }
      : list));
    setRecordId("");
  }

  function toggleItem(listId: string, itemId: string) {
    const now = new Date().toISOString();
    persist(lists.map((list) => list.id === listId
      ? {
          ...list,
          items: list.items.map((item) => item.recordId === itemId ? { ...item, done: !item.done } : item),
          updatedAt: now
        }
      : list));
  }

  function removeItem(listId: string, itemId: string) {
    const now = new Date().toISOString();
    persist(lists.map((list) => list.id === listId
      ? { ...list, items: list.items.filter((item) => item.recordId !== itemId), updatedAt: now }
      : list));
  }

  return (
    <AppShell subtitle="قوائم القراءة" navLabel="قوائم القراءة" contentClassName="local-list-content">
      <PageToolbar
        eyebrow={<span className="badge">Reading Lists</span>}
        title="قوائم القراءة"
        description="مساحة تشغيلية لتجميع سجلات تحتاج مراجعة أو قراءة لاحقة، مستقلة عن Collections حتى لا تختلط مع التصنيف الرسمي."
        meta={(
          <>
            <span className="badge">{lists.length} قائمة</span>
            <span className="badge">{remainingCount} متبقّي</span>
            <span className="badge">{completedCount} مكتمل</span>
          </>
        )}
        actions={<a className="button button-secondary" href="/collections">المجموعات الرسمية</a>}
      >
        <form className="archive-toolbar-grid" onSubmit={createList}>
          <label>
            <span>اسم القائمة</span>
            <input className="search-input" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            <span>وصف مختصر</span>
            <input className="search-input" value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <div className="archive-toolbar-actions">
            <button type="submit" className="button button-primary" disabled={!name.trim()}>إنشاء قائمة</button>
          </div>
        </form>
      </PageToolbar>

      {recordsError ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل سجلات الأرشيف</strong>
          <span className="helper-text">{recordsError}</span>
        </div>
      ) : null}

      {lists.length === 0 ? (
        <EmptyState title="لا توجد قوائم قراءة." description="أنشئ قائمة لتجميع سجلات تريد مراجعتها لاحقاً." />
      ) : (
        <section className="split-layout" aria-label="قوائم القراءة">
          <aside className="panel">
            <div className="panel-title-row">
              <h2>القوائم</h2>
              <span className="badge">{lists.length}</span>
            </div>
            <div className="mobile-card-list">
              {lists.map((list) => (
                <article className="local-list-card" key={list.id} data-active={activeList?.id === list.id ? "true" : "false"}>
                  <button type="button" className="button button-secondary button-sm" onClick={() => setActiveId(list.id)}>
                    <strong>{list.name}</strong>
                  </button>
                  {list.description ? <p className="helper-text">{list.description}</p> : null}
                  <div className="record-meta">
                    <span className="badge">{list.items.length} عنصر</span>
                    <span className="badge">{formatDate(list.updatedAt)}</span>
                  </div>
                  <button type="button" className="button button-danger button-sm" onClick={() => deleteList(list.id)}>حذف</button>
                </article>
              ))}
            </div>
          </aside>

          <article className="panel">
            {activeList ? (
              <>
                <div className="panel-title-row">
                  <div>
                    <h2>{activeList.name}</h2>
                    {activeList.description ? <p>{activeList.description}</p> : null}
                  </div>
                  <span className="badge">{activeList.items.length} عنصر</span>
                </div>

                <form className="archive-toolbar-row" onSubmit={addRecord}>
                  <label>
                    <span>إضافة سجل</span>
                    <select value={recordId} onChange={(event) => setRecordId(event.target.value)}>
                      <option value="">اختر سجلاً...</option>
                      {records.map((record) => (
                        <option key={record.id} value={record.id}>{record.title || record.id}</option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="button button-secondary" disabled={!recordId}>إضافة</button>
                </form>

                {activeList.items.length === 0 ? (
                  <EmptyState title="القائمة فارغة." description="أضف سجلاً من القائمة العلوية لبدء المتابعة." />
                ) : (
                  <div className="mobile-card-list">
                    {activeList.items.map((item) => {
                      const record = recordsById.get(item.recordId);
                      return (
                        <article className="local-list-card" key={item.recordId} data-enabled={!item.done ? "true" : "false"}>
                          <div className="local-list-card__main">
                            <div>
                              <span className="badge">{item.done ? "مكتمل" : "متبقّي"}</span>
                              <h3>{record?.title || item.recordId}</h3>
                            </div>
                            <span className="badge">{record?.type || "record"}</span>
                          </div>
                          {record?.description ? <p className="helper-text">{record.description}</p> : null}
                          <p className="helper-text">أضيف في {formatDate(item.addedAt)}</p>
                          <div className="button-row">
                            <button type="button" className="button button-secondary button-sm" onClick={() => toggleItem(activeList.id, item.recordId)}>
                              {item.done ? "إلغاء الاكتمال" : "تمت القراءة"}
                            </button>
                            <a className="button button-secondary button-sm" href={`/archive/${encodeURIComponent(item.recordId)}`}>فتح السجل</a>
                            <button type="button" className="button button-danger button-sm" onClick={() => removeItem(activeList.id, item.recordId)}>إزالة</button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <EmptyState title="اختر قائمة." description="حدد قائمة من العمود الجانبي لإدارة عناصرها." />
            )}
          </article>
        </section>
      )}
    </AppShell>
  );
}
