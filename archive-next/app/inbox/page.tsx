"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { useCapability } from "@/components/RoleGate";
import { createArchiveApiClient, type InboxItem, type InboxStatus } from "@/lib/archive-api";
import { formatDate, normalizeText } from "@/lib/record-utils";
import { toastError, toastSuccess } from "@/lib/toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { triageCommand } from "@/lib/inbox-triage";

type InboxLoadState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

export default function InboxPage() {
  const { locale, t } = useLocale();
  const copy = t.pages.inbox;
  const api = useMemo(() => createArchiveApiClient(), []);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loadState, setLoadState] = useState<InboxLoadState>({ status: "loading" });
  const [statusMessage, setStatusMessage] = useState("");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<InboxStatus | "all">("all");
  const [triageMode, setTriageMode] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [departmentTargets, setDepartmentTargets] = useState<Record<string, string>>({});
  const [routingPreviews, setRoutingPreviews] = useState<Record<string, string>>({});
  const [routingBusyId, setRoutingBusyId] = useState<string | null>(null);
  const canRouteInbox = useCapability("records.edit");

  const refreshInbox = useCallback(async () => {
    setLoadState({ status: "loading" });
    const response = await api.inboxItems();
    if (response.ok) {
      setItems(response.items);
      setLoadState({ status: "ready" });
    } else {
      const message = response.error || copy.errors.load;
      setLoadState({ status: "error", message });
      setStatusMessage(message);
    }
  }, [api, copy.errors.load]);

  useEffect(() => {
    void refreshInbox();
  }, [refreshInbox]);

  const visibleItems = useMemo(() => {
    return filter === "all" ? items : items.filter((item) => item.status === filter);
  }, [filter, items]);

  const counts = useMemo(() => {
    return items.reduce<Record<InboxStatus, number>>((acc, item) => {
      acc[item.status] += 1;
      return acc;
    }, { new: 0, triage: 0, ready: 0, done: 0 });
  }, [items]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, visibleItems.length - 1)));
  }, [visibleItems.length]);

  const updateStatus = useCallback(async (id: string, status: InboxStatus) => {
    const response = await api.updateInboxItem(id, { status });
    if (!response.ok) {
      const message = response.error || copy.errors.update;
      setStatusMessage(message);
      toastError(message);
    }
    await refreshInbox();
  }, [api, copy.errors.update, refreshInbox]);

  useEffect(() => {
    if (!triageMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = Boolean(target?.closest("input, textarea, select, [contenteditable='true']"));
      const command = triageCommand(event.key, editing);
      if (!command || !visibleItems.length) return;
      event.preventDefault();
      if (command.type === "move") {
        setActiveIndex((current) => Math.max(0, Math.min(visibleItems.length - 1, current + command.offset)));
        return;
      }
      const item = visibleItems[activeIndex];
      if (!item) return;
      if (command.type === "status") {
        void updateStatus(item.id, command.status);
        return;
      }
      const href = item.status === "ready" ? "/uploads" : item.status === "done" ? "/archive" : `/search?q=${encodeURIComponent(normalizeText(item.title))}`;
      window.location.assign(href);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, triageMode, visibleItems, updateStatus]);

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setStatusMessage(copy.messages.saving);
    const response = await api.createInboxItem({ title: title.trim(), source: source.trim(), note: note.trim() });
    if (!response.ok) {
      const message = response.error || copy.errors.add;
      setStatusMessage(message);
      toastError(message);
      return;
    }
    setStatusMessage(copy.messages.added);
    toastSuccess(copy.messages.addedToast);
    setTitle("");
    setSource("");
    setNote("");
    await refreshInbox();
  }

  async function removeItem(id: string) {
    const response = await api.deleteInboxItem(id);
    if (!response.ok) {
      const message = response.error || copy.errors.remove;
      setStatusMessage(message);
      toastError(message);
    } else {
      toastSuccess(copy.messages.removed);
    }
    await refreshInbox();
  }

  async function previewRouting(item: InboxItem) {
    const departmentId = departmentTargets[item.id]?.trim();
    if (!departmentId) return;

    setRoutingBusyId(item.id);
    const response = await api.previewInboxDepartmentRouting(item.id, departmentId);
    const message = !response.ok
      ? response.error || copy.errors.previewRoute
      : response.blocked
        ? response.reason || copy.errors.repeatedRoute
        : copy.messages.routePreview.replace("{department}", response.toDepartmentId);
    setRoutingPreviews((current) => ({ ...current, [item.id]: message }));
    setRoutingBusyId(null);
  }

  async function applyRouting(item: InboxItem) {
    const departmentId = departmentTargets[item.id]?.trim();
    if (!departmentId) return;

    setRoutingBusyId(item.id);
    const response = await api.routeInboxDepartment(item.id, departmentId);
    if (!response.ok) {
      const message = response.error || copy.errors.applyRoute;
      setRoutingPreviews((current) => ({ ...current, [item.id]: message }));
      toastError(message);
    } else {
      toastSuccess(copy.messages.routed.replace("{department}", response.departmentId));
      setRoutingPreviews((current) => ({ ...current, [item.id]: copy.messages.routeLogged }));
      await refreshInbox();
    }
    setRoutingBusyId(null);
  }

  return (
    <AppShell subtitle={t.pageTitles.inbox} contentClassName="local-list-content" tipsPage="inbox">
      <PageToolbar
        eyebrow={<span className="badge">{copy.toolbar.eyebrow}</span>}
        title={copy.toolbar.title}
        description={copy.toolbar.description}
        meta={(
          <>
            <span className="badge">{copy.toolbar.items.replace("{count}", String(items.length))}</span>
            <span className="badge">{copy.toolbar.ready.replace("{count}", String(counts.ready))}</span>
          </>
        )}
        actions={<><button className="button button-secondary" type="button" aria-pressed={triageMode} onClick={() => setTriageMode((value) => !value)}>{triageMode ? copy.toolbar.endTriage : copy.toolbar.startTriage}</button><a className="button button-primary" href="/uploads">{copy.toolbar.upload}</a></>}
      >
        {/* V14-UX-011 (P7): the quick-add form is the page's primary tool —
            visually set it apart from the filter row below it. */}
        <form className="archive-toolbar-grid quick-add-form" onSubmit={addItem}>
          <label>
            <span>{copy.form.title}</span>
            <input className="search-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={copy.form.titlePlaceholder} />
          </label>
          <label>
            <span>{copy.form.source}</span>
            <input className="search-input" value={source} onChange={(event) => setSource(event.target.value)} placeholder={copy.form.sourcePlaceholder} />
          </label>
          <label className="full-span">
            <span>{copy.form.note}</span>
            <textarea className="search-input" value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
          </label>
          <div className="archive-toolbar-actions">
            <button className="button button-primary" type="submit" disabled={!title.trim()}>{copy.form.add}</button>
          </div>
        </form>
        {statusMessage ? <p className="form-status">{statusMessage}</p> : null}
        <div className="archive-toolbar-row">
          <button className="badge" data-active={filter === "all" ? "true" : "false"} type="button" onClick={() => setFilter("all")}>{copy.form.all.replace("{count}", String(items.length))}</button>
          {(Object.keys(copy.statuses) as InboxStatus[]).map((status) => (
            <button key={status} className="badge" data-active={filter === status ? "true" : "false"} type="button" onClick={() => setFilter(status)}>
              {copy.statuses[status]} · {counts[status]}
            </button>
          ))}
        </div>
      </PageToolbar>

      {triageMode ? <div className="state-banner state-banner-info" role="status"><strong>{copy.triage.active}</strong><span>{copy.triage.instructions}</span></div> : null}

      {loadState.status === "loading" ? (
        <div className="panel panel-compact"><Skeleton label={copy.states.loading} /></div>
      ) : null}

      {loadState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.states.loadFailed}</strong>
          <span className="helper-text">{loadState.message}</span>
          <div><button type="button" className="button button-secondary button-sm" onClick={() => void refreshInbox()}>{copy.states.retry}</button></div>
        </div>
      ) : null}

      {loadState.status === "ready" && visibleItems.length === 0 ? (
        <EmptyState title={copy.states.emptyTitle} description={copy.states.emptyDescription} />
      ) : (
        <section className="dense-grid" aria-label={copy.states.ariaLabel}>
          {visibleItems.map((item, index) => (
            <article className="local-list-card" data-triage-active={triageMode && index === activeIndex} aria-current={triageMode && index === activeIndex ? "true" : undefined} key={item.id}>
              <div className="local-list-card__main">
                <div>
                  <span className="badge">{copy.statuses[item.status]}</span>
                  <h3>{item.title}</h3>
                </div>
                <span className="badge">{item.createdAt ? formatDate(item.createdAt, "-", locale) : "-"}</span>
              </div>
              <dl className="mobile-field-list">
                <div><dt>{copy.item.source}</dt><dd dir="auto">{item.source || "-"}</dd></div>
                <div><dt>{copy.item.note}</dt><dd>{item.note || "-"}</dd></div>
                <div><dt>{copy.item.department}</dt><dd>{item.departmentId || copy.item.unrouted}</dd></div>
              </dl>
              <div className="button-row">
                <select value={item.status} onChange={(event) => void updateStatus(item.id, event.target.value as InboxStatus)} aria-label={copy.item.statusFor.replace("{title}", item.title)}>
                  {(Object.keys(copy.statuses) as InboxStatus[]).map((status) => <option key={status} value={status}>{copy.statuses[status]}</option>)}
                </select>
                <a className="button button-secondary button-sm" href={`/search?q=${encodeURIComponent(normalizeText(item.title))}`}>{copy.item.searchSimilar}</a>
                {item.status === "ready" ? <a className="button button-primary button-sm" href="/uploads">{copy.item.startArchiving}</a> : null}
                {item.status === "done" ? <a className="button button-secondary button-sm" href="/archive">{copy.item.openArchive}</a> : null}
                <button className="button button-danger button-sm" type="button" onClick={() => void removeItem(item.id)}>{copy.item.remove}</button>
              </div>
              <div className="button-row">
                <input className="search-input" value={departmentTargets[item.id] || ""} onChange={(event) => setDepartmentTargets((current) => ({ ...current, [item.id]: event.target.value }))} placeholder={copy.item.targetDepartmentPlaceholder} aria-label={copy.item.targetDepartmentFor.replace("{title}", item.title)} />
                <button className="button button-secondary button-sm" type="button" onClick={() => void previewRouting(item)} disabled={routingBusyId === item.id || !(departmentTargets[item.id] || "").trim()}>{copy.item.previewRoute}</button>
                {canRouteInbox ? <button className="button button-primary button-sm" type="button" onClick={() => void applyRouting(item)} disabled={routingBusyId === item.id || !(departmentTargets[item.id] || "").trim()}>{copy.item.routeDepartment}</button> : null}
              </div>
              {routingPreviews[item.id] ? <p className="helper-text" role="status">{routingPreviews[item.id]}</p> : null}
            </article>
          ))}
        </section>
      )}
    </AppShell>
  );
}
