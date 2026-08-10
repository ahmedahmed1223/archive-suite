"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ActivityFilters, type PaginationMeta, type RecordHistoryEntry } from "@/lib/archive-api";
import { formatDate } from "@/lib/record-utils";
import { redactAdminSecrets } from "@/lib/admin-action-summary";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const eventOptions = [
  ["", "كل الأحداث"],
  ["records.bulk_upsert", "تحديث السجلات"],
  ["record_notes.create", "ملاحظات"],
  ["record_comments.create", "تعليقات"],
  ["rights.upsert", "الحقوق"],
  ["relations.create", "العلاقات"],
  ["media.workflow.queue", "مهام الوسائط"],
  ["system_control.allowed", "تحكم النظام"],
  ["system_control.blocked", "تحكم مرفوض"]
] as const;

const outcomeOptions = [
  ["", "كل النتائج"],
  ["success", "ناجحة"],
  ["rejected", "مرفوضة"],
  ["failed", "فاشلة"]
] as const;

const resourceTypeOptions = [
  ["", "كل الموارد"],
  ["record", "سجل"],
  ["record_note", "ملاحظة"],
  ["record_comment", "تعليق"],
  ["rights_record", "حقوق"],
  ["record_relation", "علاقة"],
  ["media_job", "وسائط"],
  ["system_control_action", "تحكم النظام"]
] as const;

type ActivityState =
  | { status: "loading" }
  | { status: "ready"; entries: RecordHistoryEntry[]; pagination?: PaginationMeta }
  | { status: "error"; message: string };

function eventLabel(event: string, locale: "ar" | "en") {
  const labels: Record<string, string> = {
    "records.bulk_upsert": "تحديث السجلات",
    "record_notes.create": "إضافة ملاحظة",
    "record_notes.update": "تحديث ملاحظة",
    "record_notes.delete": "حذف ملاحظة",
    "record_comments.create": "إضافة تعليق",
    "record_comments.delete": "حذف تعليق",
    "rights.upsert": "تحديث الحقوق",
    "relations.create": "إضافة علاقة",
    "relations.delete": "حذف علاقة",
    "share.create": "إنشاء مشاركة",
    "media.workflow.queue": "إطلاق مهمة وسائط",
    "system_control.allowed": "إجراء نظام",
    "system_control.blocked": "إجراء نظام مرفوض",
    "system_control.rejected": "إجراء نظام مرفوض"
  };

  const englishLabels: Record<string, string> = { "records.bulk_upsert": "Record update", "record_notes.create": "Note added", "record_notes.update": "Note updated", "record_notes.delete": "Note deleted", "record_comments.create": "Comment added", "record_comments.delete": "Comment deleted", "rights.upsert": "Rights updated", "relations.create": "Relationship added", "relations.delete": "Relationship deleted", "share.create": "Share created", "media.workflow.queue": "Media task queued", "system_control.allowed": "System action", "system_control.blocked": "System action blocked", "system_control.rejected": "System action rejected" };
  return (locale === "en" ? englishLabels : labels)[event] || event;
}

function outcomeLabel(outcome: string, locale: "ar" | "en") {
  const labels: Record<string, string> = {
    success: "ناجح",
    rejected: "مرفوض",
    failed: "فاشل"
  };

  const englishLabels: Record<string, string> = { success: "Successful", rejected: "Rejected", failed: "Failed" };
  return (locale === "en" ? englishLabels : labels)[outcome] || outcome;
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
    label: typeof value["label"] === "string" ? value["label"] : "قرار استعادة",
    reason: typeof value["reason"] === "string" ? value["reason"] : ""
  };
}

export default function ActivityPage() {
  const { locale, t } = useLocale();
  const copy = locale === "en" ? {
    eyebrow: "Activity log", title: "Activity and history", description: "An authenticated activity log backed by the server audit trail, with filters for event, result, resource, and recovery decisions when sufficient metadata is available.", events: "events", failed: "failed", rejected: "rejected", reviewable: "reviewable", refresh: "Refresh", errors: "Errors", status: "Status", filters: "Activity-log filters", eventFilter: "Event filter", resourceFilter: "Resource-type filter", outcomeFilter: "Outcome filter", resourceId: "Resource ID", loading: "Loading the activity log…", loadError: "Could not load activity", errorHelp: "Check the filters and your access, then try again.", emptyTitle: "No matching activity.", emptyDescription: "Change the filters or perform a tracked change to see it here.", log: "Activity log", general: "General", openContext: "Open context", filterResource: "Filter resource", loadingMore: "Loading…", loadMore: "Load more",
  } : {
    eyebrow: "سجل النشاط", title: "النشاط والتاريخ", description: "سجل نشاط مصادق ومسنود من سجل التدقيق في الخادم، مع فلاتر حسب الحدث والنتيجة والمورد وقرارات استعادة عند توفر metadata كافية.", events: "حدث", failed: "فاشلة", rejected: "مرفوضة", reviewable: "قابلة للمراجعة", refresh: "تحديث", errors: "الأخطاء", status: "الحالة", filters: "فلاتر سجل النشاط", eventFilter: "فلتر الحدث", resourceFilter: "فلتر نوع المورد", outcomeFilter: "فلتر النتيجة", resourceId: "معرف المورد", loading: "جارٍ تحميل سجل النشاط…", loadError: "تعذر تحميل النشاط", errorHelp: "تحقق من الفلاتر والصلاحية ثم أعد المحاولة.", emptyTitle: "لا يوجد نشاط مطابق.", emptyDescription: "غيّر الفلاتر أو نفّذ تعديلاً موثقاً ليظهر هنا.", log: "سجل النشاط", general: "عام", openContext: "فتح السياق", filterResource: "تصفية المورد", loadingMore: "جارٍ التحميل…", loadMore: "تحميل المزيد",
  };
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<ActivityState>({ status: "loading" });
  const [filters, setFilters] = useState<ActivityFilters>({ limit: 100 });
  const [loadingMore, setLoadingMore] = useState(false);

  const loadActivity = useCallback(async (nextFilters: ActivityFilters = filters) => {
    setState({ status: "loading" });
    const response = await api.activity({ ...nextFilters, page: 1 });

    if (!response.ok) {
      setState({ status: "error", message: response.error || "تعذر تحميل سجل النشاط." });
      return;
    }

    setState({ status: "ready", entries: response.entries, pagination: response.pagination });
  }, [api, filters]);

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
            <button type="button" className="button button-secondary" onClick={() => void loadActivity(filters)}>
              {copy.refresh}
            </button>
            <a className="button button-secondary" href="/errors">{copy.errors}</a>
            <a className="button button-secondary" href="/status">{copy.status}</a>
          </>
        )}
      />

      <form className="search-form" aria-label={copy.filters}>
        <select
          className="search-input"
          value={filters.event || ""}
          onChange={(event) => setFilters((current) => ({ ...current, event: event.target.value || undefined }))}
          aria-label={copy.eventFilter}
        >
          {eventOptions.map(([value, label]) => (
            <option key={value || "all-events"} value={value}>{locale === "en" ? ({ "كل الأحداث": "All events", "تحديث السجلات": "Record updates", "ملاحظات": "Notes", "تعليقات": "Comments", "الحقوق": "Rights", "العلاقات": "Relationships", "مهام الوسائط": "Media tasks", "تحكم النظام": "System control", "تحكم مرفوض": "Blocked control" }[label] ?? label) : label}</option>
          ))}
        </select>
        <select
          className="search-input"
          value={filters.resourceType || ""}
          onChange={(event) => setFilters((current) => ({ ...current, resourceType: event.target.value || undefined }))}
          aria-label={copy.resourceFilter}
        >
          {resourceTypeOptions.map(([value, label]) => (
            <option key={value || "all-resources"} value={value}>{locale === "en" ? ({ "كل الموارد": "All resources", "سجل": "Record", "ملاحظة": "Note", "تعليق": "Comment", "حقوق": "Rights", "علاقة": "Relationship", "وسائط": "Media", "تحكم النظام": "System control" }[label] ?? label) : label}</option>
          ))}
        </select>
        <select
          className="search-input"
          value={filters.outcome || ""}
          onChange={(event) => setFilters((current) => ({ ...current, outcome: event.target.value as ActivityFilters["outcome"] }))}
          aria-label={copy.outcomeFilter}
        >
          {outcomeOptions.map(([value, label]) => (
            <option key={value || "all-outcomes"} value={value}>{locale === "en" ? ({ "كل النتائج": "All results", "ناجحة": "Successful", "مرفوضة": "Rejected", "فاشلة": "Failed" }[label] ?? label) : label}</option>
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
                    <h2>{eventLabel(entry.event, locale)}</h2>
                    <p>{redactAdminSecrets(entry.action)}</p>
                  </div>
                  <span className={entry.outcome === "success" ? "badge" : "badge badge-danger"}>
                    {outcomeLabel(entry.outcome, locale)}
                  </span>
                </div>
                <div className="record-meta">
                  <span className="badge">{entry.resourceType || copy.general}</span>
                  {entry.resourceId ? <span className="badge">{entry.resourceId}</span> : null}
                  <span className="badge">{locale === "en" ? new Date(entry.createdAt || "").toLocaleDateString("en-US") : formatDate(entry.createdAt || undefined)}</span>
                  {decision ? (
                    <span className={decision.available ? "badge" : "badge badge-danger"} title={decision.reason}>
                      {decision.label}
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
