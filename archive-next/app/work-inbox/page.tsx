"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type PaginationMeta, type WorkInboxCounts, type WorkInboxItem, type WorkInboxItemType } from "@/lib/archive-api";
import { sortWorkInboxItems } from "@/lib/work-inbox";
import { formatDate } from "@/lib/record-utils";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const PAGE_LIMIT = 20;

type WorkInboxState =
  | { status: "loading" }
  | { status: "ready"; items: WorkInboxItem[]; pagination: PaginationMeta; counts: WorkInboxCounts }
  | { status: "error"; message: string };

type FilterValue = WorkInboxItemType | "all";

const FILTER_VALUES: FilterValue[] = ["all", "task", "review", "rights", "notification"];

export default function WorkInboxPage() {
  const { locale, t } = useLocale();
  const copy = t.pages.workInbox;
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<WorkInboxState>({ status: "loading" });
  const [filter, setFilter] = useState<FilterValue>("all");
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

  const filterCount = useMemo(() => ({ all: total, ...counts }) as Record<FilterValue, number>, [total, counts]);

  return (
    <AppShell subtitle={t.pageTitles.workInbox} contentClassName="local-list-content">
      <PageToolbar
        eyebrow={<span className="badge">{copy.toolbar.eyebrow}</span>}
        title={copy.toolbar.title}
        description={copy.toolbar.description}
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
        <section className="dense-grid" aria-label={copy.states.ariaLabel}>
          {visibleItems.map((item) => (
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
        </section>
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
