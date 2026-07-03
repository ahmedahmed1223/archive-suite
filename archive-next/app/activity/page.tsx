"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ArchiveRecord, type MediaJob } from "@/lib/archive-api";
import { formatDate } from "@/lib/record-utils";

type ActivityItem =
  | { id: string; kind: "record"; title: string; detail: string; at?: string; href: string }
  | { id: string; kind: "media"; title: string; detail: string; at?: string; href: string };

export default function ActivityPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [jobs, setJobs] = useState<MediaJob[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const [recordResponse, jobsResponse] = await Promise.all([
        api.search({ limit: 1000 }),
        api.mediaJobs({ limit: 80 })
      ]);
      if (recordResponse.ok) setRecords(recordResponse.records);
      else setError(recordResponse.error);
      if (jobsResponse.ok) setJobs(jobsResponse.jobs);
    })();
  }, [api]);

  const activity = useMemo<ActivityItem[]>(() => {
    const recordItems: ActivityItem[] = records.map((record) => ({
      id: `record-${record.id}`,
      kind: "record",
      title: record.title || record.id,
      detail: `${record.type || "غير محدد"} · ${record.store || "default"}`,
      at: record.updatedAt || record.createdAt,
      href: `/archive/${encodeURIComponent(record.id)}`
    }));
    const jobItems: ActivityItem[] = jobs.map((job) => ({
      id: `job-${job.id}`,
      kind: "media",
      title: `${job.operation} · ${job.status}`,
      detail: job.error || job.sourcePath || job.recordId,
      at: job.completedAt || job.startedAt || job.queuedAt || undefined,
      href: `/media/jobs?recordId=${encodeURIComponent(job.recordId)}`
    }));
    return [...recordItems, ...jobItems]
      .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
      .slice(0, 80);
  }, [jobs, records]);

  const failedJobs = jobs.filter((job) => job.status === "failed").length;
  const recentRecords = records.filter((record) => {
    const time = new Date(record.updatedAt || record.createdAt || 0).getTime();
    return Number.isFinite(time) && Date.now() - time < 1000 * 60 * 60 * 24 * 7;
  }).length;

  return (
    <AppShell subtitle="النشاط" contentClassName="observability-content">
      <PageToolbar
        eyebrow={<span className="badge">Activity</span>}
        title="النشاط والتاريخ"
        description="سطح متابعة يومي يجمع آخر تغييرات السجلات ومهام الوسائط. undo/diffs الكامل ينتظر endpoint audit مخصص."
        meta={(
          <>
            <span className="badge">{activity.length} حدث</span>
            <span className="badge">{recentRecords} سجل آخر 7 أيام</span>
            <span className={failedJobs > 0 ? "badge badge-danger" : "badge"}>{failedJobs} jobs فاشلة</span>
          </>
        )}
        actions={(
          <>
            <a className="button button-secondary" href="/errors">الأخطاء</a>
            <a className="button button-secondary" href="/status">الحالة</a>
          </>
        )}
      />

      {error ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل النشاط</strong>
          <span className="helper-text">{error}</span>
        </div>
      ) : null}

      <section className="health-metric-grid" aria-label="ملخص النشاط">
        <article className="health-metric" data-tone="accent">
          <div className="health-metric__body">
            <span>سجلات محدثة</span>
            <strong>{records.length}</strong>
            <small>من نتائج البحث الحالية</small>
          </div>
        </article>
        <article className="health-metric" data-tone={failedJobs > 0 ? "danger" : "success"}>
          <div className="health-metric__body">
            <span>مهام وسائط فاشلة</span>
            <strong>{failedJobs}</strong>
            <small>راجع Media Jobs عند الحاجة</small>
          </div>
        </article>
      </section>

      {activity.length === 0 ? (
        <EmptyState title="لا يوجد نشاط ظاهر." description="ستظهر هنا السجلات ومهام الوسائط عند توفر بيانات من API." />
      ) : (
        <section className="error-log-list" aria-label="سجل النشاط">
          {activity.map((item) => (
            <article className="error-log-card" key={item.id} data-severity={item.kind === "media" ? "warning" : "info"}>
              <div className="panel-title-row">
                <div>
                  <h2>{item.title}</h2>
                  <p>{item.detail}</p>
                </div>
                <span className="badge">{item.kind === "media" ? "وسائط" : "سجل"}</span>
              </div>
              <div className="button-row">
                <span className="badge">{formatDate(item.at)}</span>
                <a className="button button-secondary button-sm" href={item.href}>فتح</a>
              </div>
            </article>
          ))}
        </section>
      )}
    </AppShell>
  );
}
