"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

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

function formatDate(value: string | undefined, locale: "ar" | "en") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale === "en" ? "en-US" : "ar-SA");
}

export default function ReadingListsPage() {
  const { locale, t } = useLocale();
  const copy = t.pages.readingLists;
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
    <AppShell subtitle={t.pageTitles.readingLists} navLabel={t.pageTitles.readingLists} contentClassName="local-list-content" tipsPage="reading-lists">
      <PageToolbar
        eyebrow={<span className="badge">{copy.toolbar.eyebrow}</span>}
        title={copy.toolbar.title}
        description={copy.toolbar.description}
        meta={(
          <>
            <span className="badge">{copy.toolbar.listCount.replace("{count}", String(lists.length))}</span>
            <span className="badge">{copy.toolbar.remainingCount.replace("{count}", String(remainingCount))}</span>
            <span className="badge">{copy.toolbar.completedCount.replace("{count}", String(completedCount))}</span>
          </>
        )}
        actions={<a className="button button-secondary" href="/collections">{copy.toolbar.officialCollections}</a>}
      >
        <form className="archive-toolbar-grid" onSubmit={createList}>
          <label>
            <span>{copy.create.name}</span>
            <input className="search-input" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            <span>{copy.create.description}</span>
            <input className="search-input" value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <div className="archive-toolbar-actions">
            <button type="submit" className="button button-primary" disabled={!name.trim()}>{copy.create.submit}</button>
          </div>
        </form>
      </PageToolbar>

      {recordsError ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.errors.recordsLoad}</strong>
          <span className="helper-text">{recordsError}</span>
        </div>
      ) : null}

      {lists.length === 0 ? (
        <EmptyState title={copy.empty.title} description={copy.empty.description} />
      ) : (
        <section className="split-layout" aria-label={copy.layout.ariaLabel}>
          <aside className="panel">
            <div className="panel-title-row">
              <h2>{copy.layout.listsTitle}</h2>
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
                    <span className="badge">{copy.layout.itemCount.replace("{count}", String(list.items.length))}</span>
                    <span className="badge">{formatDate(list.updatedAt, locale)}</span>
                  </div>
                  <button type="button" className="button button-danger button-sm" onClick={() => deleteList(list.id)}>{copy.layout.remove}</button>
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
                  <span className="badge">{copy.layout.itemCount.replace("{count}", String(activeList.items.length))}</span>
                </div>

                <form className="archive-toolbar-row" onSubmit={addRecord}>
                  <label>
                    <span>{copy.layout.addRecord}</span>
                    <select value={recordId} onChange={(event) => setRecordId(event.target.value)}>
                      <option value="">{copy.layout.selectRecord}</option>
                      {records.map((record) => (
                        <option key={record.id} value={record.id}>{record.title || record.id}</option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="button button-secondary" disabled={!recordId}>{copy.layout.add}</button>
                </form>

                {activeList.items.length === 0 ? (
                  <EmptyState title={copy.layout.emptyListTitle} description={copy.layout.emptyListDescription} />
                ) : (
                  <div className="mobile-card-list">
                    {activeList.items.map((item) => {
                      const record = recordsById.get(item.recordId);
                      return (
                        <article className="local-list-card" key={item.recordId} data-enabled={!item.done ? "true" : "false"}>
                          <div className="local-list-card__main">
                            <div>
                              <span className="badge">{item.done ? copy.layout.completed : copy.layout.remaining}</span>
                              <h3>{record?.title || item.recordId}</h3>
                            </div>
                            <span className="badge">{record?.type || copy.layout.record}</span>
                          </div>
                          {record?.description ? <p className="helper-text">{record.description}</p> : null}
                          <p className="helper-text">{copy.layout.addedAt.replace("{date}", formatDate(item.addedAt, locale))}</p>
                          <div className="button-row">
                            <button type="button" className="button button-secondary button-sm" onClick={() => toggleItem(activeList.id, item.recordId)}>
                              {item.done ? copy.layout.markUnread : copy.layout.markRead}
                            </button>
                            <a className="button button-secondary button-sm" href={`/archive/${encodeURIComponent(item.recordId)}`}>{copy.layout.openRecord}</a>
                            <button type="button" className="button button-danger button-sm" onClick={() => removeItem(activeList.id, item.recordId)}>{copy.layout.removeItem}</button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <EmptyState title={copy.layout.noActiveTitle} description={copy.layout.noActiveDescription} />
            )}
          </article>
        </section>
      )}
    </AppShell>
  );
}
