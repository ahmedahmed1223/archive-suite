"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import DisclosureToolbar from "@/components/DisclosureToolbar";
import { createArchiveApiClient, type ActivityFilters, type PaginationMeta, type RecordHistoryEntry } from "@/lib/archive-api";
import { redactAdminSecrets } from "@/lib/admin-action-summary";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type ActivityState =
  | { status: "loading" }
  | { status: "ready"; entries: RecordHistoryEntry[]; pagination?: PaginationMeta }
  | { status: "error"; message: string };

function labelFor(labels: object, value: string): string {
  const label = (labels as Record<string, unknown>)[value];
  return typeof label === "string" ? label : value;
}

// V14-UX-011 (P6): raw API event names like "post.api.v1.uploads.schedules"
// leaked into headings as-is. Map the known HTTP-verb + path shapes onto
// human labels; fall back to a cleaned-up tail segment instead of the full path.
function humanEventLabel(entry: { event: string }, labels: object): string {
  const direct = labelFor(labels, entry.event);
  if (direct !== entry.event) return direct;

  const match = /^(get|post|put|patch|delete)\.api\.v1\.(.+)$/i.exec(entry.event);
  if (match) {
    const verb = match[1].toLowerCase();
    const verbLabel: Record<string, string> = {
      get: "عرض",
      post: "إنشاء",
      put: "تحديث",
      patch: "تعديل",
      delete: "حذف",
    };
    // Tail: last meaningful path segment, kebab/snake → spaces.
    const segments = match[2].split(".").filter((part) => part !== "v1");
    const subject = (segments[segments.length - 1] ?? "").replace(/[-_]+/g, " ");
    return `${verbLabel[verb] ?? verb}: ${subject}`;
  }
  return entry.event.replace(/[-_.]+/g, " ");
}

function hrefForEntry(entry: RecordHistoryEntry) {
  if (!entry.resourceId) return null;

  if (entry.resourceType === "record" || entry.resourceType === "rights_record" || entry.resourceType === "media_job") {
    return `/archive/${encodeURIComponent(entry.resourceId)}`;
  }

  if (entry.event.startsWith("system_control")) {
    return "/system/control";
  }

  return null;
}

function restoreDecision(entry: RecordHistoryEntry) {
  const decision = entry.metadata?.["restoreDecision"];
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) {
    return null;
  }

  const value = decision as Record<string, unknown>;
  return {
    available: value["available"] === true,
    label: typeof value["label"] === "string" ? value["label"] : null,
    reason: typeof value["reason"] === "string" ? value["reason"] : ""
  };
}

export default function ActivityPage() {
  const { locale, t } = useLocale();
  const copy = t.pages.activity;
  const eventOptions = [
    ["", copy.filterOptions.events.all],
    ["records.bulk_upsert", copy.filterOptions.events.bulkUpsert],
    ["record_notes.create", copy.filterOptions.events.notes],
    ["record_comments.create", copy.filterOptions.events.comments],
    ["rights.upsert", copy.filterOptions.events.rights],
    ["relations.create", copy.filterOptions.events.relations],
    ["media.workflow.queue", copy.filterOptions.events.media],
    ["system_control.allowed", copy.filterOptions.events.systemAllowed],
    ["system_control.blocked", copy.filterOptions.events.systemBlocked]
  ] as const;
  const outcomeOptions = [
    ["", copy.filterOptions.outcomes.all],
    ["success", copy.filterOptions.outcomes.success],
    ["rejected", copy.filterOptions.outcomes.rejected],
    ["failed", copy.filterOptions.outcomes.failed]
  ] as const;
  const resourceTypeOptions = [
    ["", copy.filterOptions.resources.all],
    ["record", copy.filterOptions.resources.record],
    ["record_note", copy.filterOptions.resources.note],
    ["record_comment", copy.filterOptions.resources.comment],
    ["rights_record", copy.filterOptions.resources.rights],
    ["record_relation", copy.filterOptions.resources.relation],
    ["media_job", copy.filterOptions.resources.media],
    ["system_control_action", copy.filterOptions.resources.systemControl]
  ] as const;
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<ActivityState>({ status: "loading" });
  const [filters, setFilters] = useState<ActivityFilters>({ limit: 100 });
  const [loadingMore, setLoadingMore] = useState(false);

  const loadActivity = useCallback(async (nextFilters: ActivityFilters = filters) => {
    setState({ status: "loading" });
    const response = await api.activity({ ...nextFilters, page: 1 });

    if (!response.ok) {
      setState({ status: "error", message: response.error || copy.loadErrorMessage });
      return;
    }

    setState({ status: "ready", entries: response.entries, pagination: response.pagination });
  }, [api, copy.loadErrorMessage, filters]);

  const loadMoreActivity = useCallback(async () => {
    if (state.status !== "ready" || !state.pagination?.hasMore || loadingMore) return;
    setLoadingMore(true);
    const response = await api.activity({ ...filters, page: state.pagination.page + 1 });
    setLoadingMore(false);

    if (!response.ok) return;

    setState((current) => (current.status === "ready"
      ? { status: "ready", entries: [...current.entries, ...response.entries], pagination: response.pagination }
      : current));
  }, [api, filters, loadingMore, state]);

  useEffect(() => {
    void loadActivity(filters);
  }, [filters, loadActivity]);

  const entries = useMemo(() => (state.status === "ready" ? state.entries : []), [state]);
  const pagination = state.status === "ready" ? state.pagination : undefined;
  const stats = useMemo(() => {
    const failed = entries.filter((entry) => entry.outcome === "failed").length;
    const rejected = entries.filter((entry) => entry.outcome === "rejected").length;
    const withRestoreDecision = entries.filter((entry) => restoreDecision(entry)?.available).length;

    return { failed, rejected, withRestoreDecision };
  }, [entries]);

  return (
    <AppShell subtitle={t.pageTitles.activity} contentClassName="observability-content" tipsPage="activity">
      <PageToolbar
        eyebrow={<span className="badge">{copy.eyebrow}</span>}
        title={copy.title}
        description={copy.description}
        meta={(
          <>
            <span className="badge">{pagination ? `${entries.length} / ${pagination.total}` : entries.length} {copy.events}</span>
            <span className={stats.failed > 0 ? "badge badge-danger" : "badge"}>{stats.failed} {copy.failed}</span>
            <span className={stats.rejected > 0 ? "badge badge-danger" : "badge"}>{stats.rejected} {copy.rejected}</span>
            <span className="badge">{stats.withRestoreDecision} {copy.reviewable}</span>
          </>
        )}
        actions={(
          <>
            {/* V14-UX-008 follow-up: refresh is this page's one primary action. */}
            <button type="button" className="button button-primary" onClick={() => void loadActivity(filters)}>
              {copy.refresh}
            </button>
            <a className="button button-secondary" href="/errors">{copy.errors}</a>
            <a className="button button-secondary" href="/status">{copy.status}</a>
          </>
        )}
      />

      {/* V14-UX-008 follow-up: filters are secondary tools — collapsed behind
          the shared semantic disclosure like archive/search. */}
      <DisclosureToolbar summary={copy.filters}>
        <form className="search-form" aria-label={copy.filters}>
          <select
            className="search-input"
            value={filters.event || ""}
            onChange={(event) => setFilters((current) => ({ ...current, event: event.target.value || undefined }))}
            aria-label={copy.eventFilter}
          >
            {eventOptions.map(([value, label]) => (
              <option key={value || "all-events"} value={value}>{label}</option>
            ))}
          </select>
          <select
            className="search-input"
            value={filters.resourceType || ""}
            onChange={(event) => setFilters((current) => ({ ...current, resourceType: event.target.value || undefined }))}
            aria-label={copy.resourceFilter}
          >
            {resourceTypeOptions.map(([value, label]) => (
              <option key={value || "all-resources"} value={value}>{label}</option>
            ))}
          </select>
          <select
            className="search-input"
            value={filters.outcome || ""}
            onChange={(event) => setFilters((current) => ({ ...current, outcome: event.target.value as ActivityFilters["outcome"] }))}
            aria-label={copy.outcomeFilter}
          >
            {outcomeOptions.map(([value, label]) => (
              <option key={value || "all-outcomes"} value={value}>{label}</option>
            ))}
          </select>
          <input
            className="search-input"
            value={filters.resourceId || ""}
            onChange={(event) => setFilters((current) => ({ ...current, resourceId: event.target.value.trim() || undefined }))}
            placeholder={copy.resourceId}
            aria-label={copy.resourceId}
          />
        </form>
      </DisclosureToolbar>

      {state.status === "loading" ? (
        <div className="panel panel-compact">
          <Skeleton label={copy.loading} />
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.loadError}</strong>
          <span className="helper-text">{redactAdminSecrets(state.message)} — {copy.errorHelp}</span>
        </div>
      ) : null}

      {state.status === "ready" && entries.length === 0 ? (
        <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
      ) : null}

      {state.status === "ready" && entries.length > 0 ? (
        <section className="error-log-list" aria-label={copy.log}>
          {entries.map((entry) => {
            const href = hrefForEntry(entry);
            const decision = restoreDecision(entry);

            return (
              <article
                className="error-log-card"
                key={entry.id}
                data-severity={entry.outcome === "success" ? "info" : "warning"}
              >
                <div className="panel-title-row">
                  <div>
                    <h2>{humanEventLabel(entry, copy.eventLabels)}</h2>
                    <p>{redactAdminSecrets(entry.action)}</p>
                  </div>
                  <span className={entry.outcome === "success" ? "badge" : "badge badge-danger"}>
                    {labelFor(copy.outcomeLabels, entry.outcome)}
                  </span>
                </div>
                <div className="record-meta">
                  <span className="badge">{entry.resourceType || copy.general}</span>
                  {entry.resourceId ? <span className="badge">{entry.resourceId}</span> : null}
                  <span className="badge">{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "ar-SA") : "-"}</span>
                  {decision ? (
                    <span className={decision.available ? "badge" : "badge badge-danger"} title={decision.reason}>
                      {decision.label || copy.restore.defaultLabel}
                    </span>
                  ) : null}
                </div>
                <div className="button-row">
                  {href ? <a className="button button-secondary button-sm" href={href}>{copy.openContext}</a> : null}
                  {entry.resourceId ? (
                    <button
                      type="button"
                      className="button button-secondary button-sm"
                      onClick={() => setFilters((current) => ({ ...current, resourceId: entry.resourceId || undefined }))}
                    >
                      {copy.filterResource}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {state.status === "ready" && pagination?.hasMore ? (
        <div className="button-row" style={{ justifyContent: "center" }}>
          <button type="button" className="button button-secondary" onClick={() => void loadMoreActivity()} disabled={loadingMore}>
            {loadingMore ? copy.loadingMore : copy.loadMore}
          </button>
        </div>
      ) : null}
    </AppShell>
  );
}
