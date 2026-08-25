"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type PaginationMeta, type WorkInboxCounts, type WorkInboxItem, type WorkInboxItemType } from "@/lib/archive-api";
import { sortWorkInboxItems, groupWorkInboxItems } from "@/lib/work-inbox";
import { formatDate } from "@/lib/record-utils";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useAuthSession } from "@/lib/auth-session";
import { isContextRecordingEnabled } from "@/lib/personal-context";
import { readUserWorkspacePreferences, updateWorkspacePreferences, workspacePreferencesStorageKey } from "@/lib/workspace-preferences";

const PAGE_LIMIT = 20;

type WorkInboxState =
  | { status: "loading" }
  | { status: "ready"; items: WorkInboxItem[]; pagination: PaginationMeta; counts: WorkInboxCounts }
  | { status: "error"; message: string };

type FilterValue = WorkInboxItemType | "all";

const FILTER_VALUES: FilterValue[] = ["all", "task", "review", "rights", "notification"];

export default function WorkInboxPage() {
  const { locale, t } = useLocale();
  const { user } = useAuthSession();
  const copy = t.pages.workInbox;
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<WorkInboxState>({ status: "loading" });
  const [filter, setFilter] = useState<FilterValue>("all");
  const isFilterRestored = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // ponytail: the UI always fetches every type and filters the loaded page
  // client-side (same pattern as /inbox's status chips) — the API's own
  // `types[]` filter still exists for programmatic callers and is covered
  // by WorkInboxApiTest, it just isn't needed to drive this simple chip row.
  const load = useCallback(async () => {
    setState({ status: "loading" });
    const response = await api.workInbox({ page: 1, limit: PAGE_LIMIT });
    if (!response.ok) {
      setState({ status: "error", message: response.error || copy.states.loadFailed });
      return;
    }
    setState({ status: "ready", items: response.items, pagination: response.pagination, counts: response.counts });
  }, [api, copy.states.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user?.id || isFilterRestored.current) return;
    try {
      if (!isContextRecordingEnabled()) {
        const key = workspacePreferencesStorageKey(user.id);
        const scoped = localStorage.getItem(key);
        if (scoped) {
          const saved = readUserWorkspacePreferences(localStorage, user.id);
          const withoutInboxContext = updateWorkspacePreferences(saved, "/work-inbox", { filters: {} });
          localStorage.setItem(key, JSON.stringify(withoutInboxContext));
        }
      } else {
        const saved = readUserWorkspacePreferences(localStorage, user.id);
        const source = saved.routes["/work-inbox"]?.filters?.source;
        if (source && FILTER_VALUES.includes(source as FilterValue)) setFilter(source as FilterValue);
      }
    } catch {
      // Context is optional; the inbox remains usable without browser storage.
    } finally {
      isFilterRestored.current = true;
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !isFilterRestored.current || !isContextRecordingEnabled()) return;
    try {
      const saved = readUserWorkspacePreferences(localStorage, user.id);
      const next = updateWorkspacePreferences(saved, "/work-inbox", {
        filters: filter === "all" ? {} : { source: filter },
      });
      localStorage.setItem(workspacePreferencesStorageKey(user.id), JSON.stringify(next));
    } catch {
      // Context is optional; the inbox remains usable without browser storage.
    }
  }, [filter, user?.id]);

  const loadMore = useCallback(async () => {
    if (state.status !== "ready" || !state.pagination.hasMore || loadingMore) return;
    setLoadingMore(true);
    const response = await api.workInbox({ page: state.pagination.page + 1, limit: PAGE_LIMIT });
    setLoadingMore(false);
    if (!response.ok) return;

    setState((current) => (current.status === "ready"
      ? { status: "ready", items: [...current.items, ...response.items], pagination: response.pagination, counts: response.counts }
      : current));
  }, [api, loadingMore, state]);

  const items = state.status === "ready" ? state.items : [];
  const counts = state.status === "ready" ? state.counts : { task: 0, review: 0, rights: 0, notification: 0 };
  const total = counts.task + counts.review + counts.rights + counts.notification;
  // V14-UX-003: the daily list is ordered by urgency (soonest/overdue due
  // date first) with a stable tiebreak — not by arrival order.
  const visibleItems = sortWorkInboxItems(filter === "all" ? items : items.filter((item) => item.type === filter));
  // V15-DAILY-003: group the visible items by urgency for a scannable inbox.
  const groups = groupWorkInboxItems(visibleItems);
  const groupLabels: Record<string, string> = {
    overdue: copy.groups.overdue,
    today: copy.groups.today,
    upcoming: copy.groups.upcoming,
    undated: copy.groups.undated,
  };

  const filterCount = useMemo(() => ({ all: total, ...counts }) as Record<FilterValue, number>, [total, counts]);

  return (
    <AppShell subtitle={t.pageTitles.workInbox} contentClassName="local-list-content">
      <PageToolbar
        eyebrow={<span className="badge">{copy.toolbar.eyebrow}</span>}
        title={copy.toolbar.title}
        description={copy.toolbar.description}
        actions={<><a className="button button-primary" href="/uploads">{copy.toolbar.addMaterial}</a><a className="button button-secondary" href="/daily">{copy.toolbar.openDaily}</a></>}
      >
        <div className="archive-toolbar-row">
          {FILTER_VALUES.map((value) => (
            <button
              key={value}
              className="badge"
              data-active={filter === value ? "true" : "false"}
              type="button"
              onClick={() => setFilter(value)}
            >
              {copy.filters[value].replace("{count}", String(filterCount[value]))}
            </button>
          ))}
          {filter !== "all" ? <button className="button button-secondary button-sm" type="button" onClick={() => setFilter("all")}>{copy.filters.clear}</button> : null}
        </div>
      </PageToolbar>

      {state.status === "loading" ? (
        <div className="panel panel-compact"><Skeleton label={copy.states.loading} /></div>
      ) : null}

      {state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.states.loadFailed}</strong>
          <span className="helper-text">{state.message}</span>
          <div><button type="button" className="button button-secondary button-sm" onClick={() => void load()}>{copy.states.retry}</button></div>
        </div>
      ) : null}

      {state.status === "ready" && visibleItems.length === 0 ? (
        <EmptyState title={copy.states.emptyTitle} description={copy.states.emptyDescription} />
      ) : null}

      {state.status === "ready" && visibleItems.length > 0 ? (
        <div className="work-inbox-groups">
          {groups.map((group) => (
            <section key={group.key} aria-label={groupLabels[group.key]}>
              <h2 className="work-inbox-group-title">{groupLabels[group.key]} <span className="badge">{group.items.length}</span></h2>
              <div className="dense-grid">
                {group.items.map((item) => (
                  <a className="local-list-card" href={item.href} key={item.id}>
                    <div className="local-list-card__main">
                      <div>
                        <span className="badge">{copy.types[item.type]}</span>
                        <h3>{item.title}</h3>
                      </div>
                      <span className="badge">{item.dueAt ? copy.item.due.replace("{date}", formatDate(item.dueAt, "-", locale)) : copy.item.noDue}</span>
                    </div>
                    <dl className="mobile-field-list">
                      <div><dt>{copy.types[item.type]}</dt><dd dir="auto">{item.status}</dd></div>
                    </dl>
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {state.status === "ready" && state.pagination.hasMore ? (
        <div className="button-row">
          <button type="button" className="button button-secondary" onClick={() => void loadMore()} disabled={loadingMore}>
            {copy.loadMore}
          </button>
        </div>
      ) : null}
    </AppShell>
  );
}
