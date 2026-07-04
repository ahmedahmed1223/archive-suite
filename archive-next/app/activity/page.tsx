"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ActivityFilters, type RecordHistoryEntry } from "@/lib/archive-api";
import { formatDate } from "@/lib/record-utils";

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
  | { status: "ready"; entries: RecordHistoryEntry[] }
  | { status: "error"; message: string };

function eventLabel(event: string) {
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

  return labels[event] || event;
}

function outcomeLabel(outcome: string) {
  const labels: Record<string, string> = {
    success: "ناجح",
    rejected: "مرفوض",
    failed: "فاشل"
  };

  return labels[outcome] || outcome;
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
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<ActivityState>({ status: "loading" });
  const [filters, setFilters] = useState<ActivityFilters>({ limit: 100 });

  const loadActivity = useCallback(async (nextFilters: ActivityFilters = filters) => {
    setState({ status: "loading" });
    const response = await api.activity(nextFilters);

    if (!response.ok) {
      setState({ status: "error", message: response.error || "تعذر تحميل سجل النشاط." });
      return;
    }

    setState({ status: "ready", entries: response.entries });
  }, [api, filters]);

  useEffect(() => {
    void loadActivity(filters);
  }, [filters, loadActivity]);

  const entries = state.status === "ready" ? state.entries : [];
  const stats = useMemo(() => {
    const failed = entries.filter((entry) => entry.outcome === "failed").length;
    const rejected = entries.filter((entry) => entry.outcome === "rejected").length;
    const withRestoreDecision = entries.filter((entry) => restoreDecision(entry)?.available).length;

    return { failed, rejected, withRestoreDecision };
  }, [entries]);

  return (
    <AppShell subtitle="النشاط" contentClassName="observability-content">
      <PageToolbar
        eyebrow={<span className="badge">Audit Activity</span>}
        title="النشاط والتاريخ"
        description="سجل نشاط مصادق ومسنود من Laravel audit log، مع فلاتر حسب الحدث والنتيجة والمورد وقرارات استعادة عند توفر metadata كافية."
        meta={(
          <>
            <span className="badge">{entries.length} حدث</span>
            <span className={stats.failed > 0 ? "badge badge-danger" : "badge"}>{stats.failed} فاشلة</span>
            <span className={stats.rejected > 0 ? "badge badge-danger" : "badge"}>{stats.rejected} مرفوضة</span>
            <span className="badge">{stats.withRestoreDecision} قابلة للمراجعة</span>
          </>
        )}
        actions={(
          <>
            <button type="button" className="button button-secondary" onClick={() => void loadActivity(filters)}>
              تحديث
            </button>
            <a className="button button-secondary" href="/errors">الأخطاء</a>
            <a className="button button-secondary" href="/status">الحالة</a>
          </>
        )}
      />

      <form className="search-form" aria-label="فلاتر سجل النشاط">
        <select
          className="search-input"
          value={filters.event || ""}
          onChange={(event) => setFilters((current) => ({ ...current, event: event.target.value || undefined }))}
          aria-label="فلتر الحدث"
        >
          {eventOptions.map(([value, label]) => (
            <option key={value || "all-events"} value={value}>{label}</option>
          ))}
        </select>
        <select
          className="search-input"
          value={filters.resourceType || ""}
          onChange={(event) => setFilters((current) => ({ ...current, resourceType: event.target.value || undefined }))}
          aria-label="فلتر نوع المورد"
        >
          {resourceTypeOptions.map(([value, label]) => (
            <option key={value || "all-resources"} value={value}>{label}</option>
          ))}
        </select>
        <select
          className="search-input"
          value={filters.outcome || ""}
          onChange={(event) => setFilters((current) => ({ ...current, outcome: event.target.value as ActivityFilters["outcome"] }))}
          aria-label="فلتر النتيجة"
        >
          {outcomeOptions.map(([value, label]) => (
            <option key={value || "all-outcomes"} value={value}>{label}</option>
          ))}
        </select>
        <input
          className="search-input"
          value={filters.resourceId || ""}
          onChange={(event) => setFilters((current) => ({ ...current, resourceId: event.target.value.trim() || undefined }))}
          placeholder="معرف المورد"
          aria-label="فلتر معرف المورد"
        />
      </form>

      {state.status === "loading" ? (
        <div className="panel panel-compact" role="status" aria-live="polite">
          <p className="form-status">جار تحميل سجل النشاط...</p>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل النشاط</strong>
          <span className="helper-text">{state.message}</span>
        </div>
      ) : null}

      {state.status === "ready" && entries.length === 0 ? (
        <EmptyState title="لا يوجد نشاط مطابق." description="غيّر الفلاتر أو نفّذ تعديلاً موثقاً ليظهر هنا." />
      ) : null}

      {state.status === "ready" && entries.length > 0 ? (
        <section className="error-log-list" aria-label="سجل النشاط">
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
                    <h2>{eventLabel(entry.event)}</h2>
                    <p>{entry.action}</p>
                  </div>
                  <span className={entry.outcome === "success" ? "badge" : "badge badge-danger"}>
                    {outcomeLabel(entry.outcome)}
                  </span>
                </div>
                <div className="record-meta">
                  <span className="badge">{entry.resourceType || "عام"}</span>
                  {entry.resourceId ? <span className="badge">{entry.resourceId}</span> : null}
                  <span className="badge">{formatDate(entry.createdAt || undefined)}</span>
                  {decision ? (
                    <span className={decision.available ? "badge" : "badge badge-danger"} title={decision.reason}>
                      {decision.label}
                    </span>
                  ) : null}
                </div>
                <div className="button-row">
                  {href ? <a className="button button-secondary button-sm" href={href}>فتح السياق</a> : null}
                  {entry.resourceId ? (
                    <button
                      type="button"
                      className="button button-secondary button-sm"
                      onClick={() => setFilters((current) => ({ ...current, resourceId: entry.resourceId || undefined }))}
                    >
                      تصفية المورد
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </AppShell>
  );
}
