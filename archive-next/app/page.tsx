"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Archive, BarChart3, Clock3, Film, Gauge, PlusCircle, Search, Sparkles } from "lucide-react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import MetricStrip from "@/components/MetricStrip";
import PageToolbar from "@/components/PageToolbar";
import { BRAND } from "@/lib/brand";
import {
  createArchiveApiClient,
  getContractSummary,
  type ArchiveRecord,
  type MediaJob,
  type MediaJobStatus
} from "@/lib/archive-api";

type RecordsState =
  | { status: "loading" }
  | { status: "ready"; records: ArchiveRecord[] }
  | { status: "error"; message: string };

type JobsState =
  | { status: "loading" }
  | { status: "ready"; jobs: MediaJob[] }
  | { status: "error"; message: string };

const apiContract = getContractSummary();

const quickLinks = [
  { label: "الأرشيف", href: "/archive" },
  { label: "إضافة للأرشيف", href: "/uploads" },
  { label: "البحث", href: "/search" },
  { label: "الملفات", href: "/files" },
  { label: "الاستيراد", href: "/ingest" },
  { label: "الوسائط", href: "/media/jobs" },
  { label: "الحقوق", href: "/rights" },
  { label: "التحليلات", href: "/analytics" },
  { label: "النسخ الاحتياطي", href: "/backup" },
  { label: "الإعدادات", href: "/settings" }
] as const;

const jobStatusLabels: Record<MediaJobStatus, string> = {
  queued: "في الانتظار",
  processing: "قيد المعالجة",
  completed: "مكتملة",
  failed: "فاشلة"
};

function formatDate(value?: string | null) {
  if (!value) return "غير محدد";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ar-SA");
}

function getRecordTime(record: ArchiveRecord) {
  const value = record.updatedAt || record.createdAt || "";
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

export default function HomePage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [recordsState, setRecordsState] = useState<RecordsState>({ status: "loading" });
  const [jobsState, setJobsState] = useState<JobsState>({ status: "loading" });

  const loadDashboard = useCallback(async () => {
    setRecordsState({ status: "loading" });
    setJobsState({ status: "loading" });

    // Parallel independent fetches; each widget fails on its own.
    void (async () => {
      try {
        const response = await api.search({ q: "", limit: 300 });
        if (response.ok) {
          setRecordsState({ status: "ready", records: response.records });
        } else {
          setRecordsState({ status: "error", message: response.error || "تعذر تحميل السجلات." });
        }
      } catch (error) {
        setRecordsState({ status: "error", message: error instanceof Error ? error.message : "تعذر تحميل السجلات." });
      }
    })();

    void (async () => {
      try {
        const response = await api.mediaJobs({ limit: 8 });
        if (response.ok) {
          setJobsState({ status: "ready", jobs: response.jobs });
        } else {
          setJobsState({ status: "error", message: response.error || "تعذر تحميل مهام الوسائط." });
        }
      } catch (error) {
        setJobsState({ status: "error", message: error instanceof Error ? error.message : "تعذر تحميل مهام الوسائط." });
      }
    })();
  }, [api]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const records = recordsState.status === "ready" ? recordsState.records : [];

  const stats = useMemo(() => {
    const countByType: Record<string, number> = {};
    const countByStatus: Record<string, number> = {};

    records.forEach((record) => {
      const type = record.type || "unknown";
      countByType[type] = (countByType[type] || 0) + 1;

      const status = (record.metadata?.status as string) || "active";
      countByStatus[status] = (countByStatus[status] || 0) + 1;
    });

    return { countByType, countByStatus };
  }, [records]);

  const recentRecords = useMemo(
    () => [...records].sort((a, b) => getRecordTime(b) - getRecordTime(a)).slice(0, 8),
    [records]
  );

  const jobs = jobsState.status === "ready" ? jobsState.jobs : [];
  const failedJobs = jobs.filter((job) => job.status === "failed").length;
  const activeJobs = jobs.filter((job) => job.status === "queued" || job.status === "processing").length;
  const attentionItems = useMemo(
    () => [
      {
        icon: <PlusCircle size={18} />,
        title: "إضافة مادة جديدة",
        description: "ابدأ من معالج الإضافة لإرفاق ملفات وmetadata ومراجعة قبل الإنشاء.",
        href: "/uploads",
        label: "إضافة"
      },
      {
        icon: <Search size={18} />,
        title: "مراجعة نتائج البحث",
        description: `${records.length} سجل متاح للتصفية والفرز والمعاينة داخل الأرشيف.`,
        href: "/archive",
        label: "فتح"
      },
      {
        icon: failedJobs > 0 ? <AlertTriangle size={18} /> : <Film size={18} />,
        title: failedJobs > 0 ? "مهام وسائط فاشلة" : "مهام الوسائط",
        description: failedJobs > 0 ? `${failedJobs} مهمة تحتاج فحصًا.` : `${activeJobs} مهمة قيد الانتظار أو المعالجة.`,
        href: "/media/jobs",
        label: "مراجعة"
      }
    ],
    [activeJobs, failedJobs, records.length]
  );

  return (
    <AppShell subtitle="لوحة التشغيل" navLabel="مسارات Masar">
      <PageToolbar
        icon={<Gauge size={24} strokeWidth={2} />}
        eyebrow={<span className="badge">Command Workspace</span>}
        title={`لوحة ${BRAND.arabicName}`}
        description="مركز تشغيل يومي يجمع مؤشرات الأرشيف، المهام التي تحتاج انتباه، آخر السجلات، وحالة الوسائط."
        meta={(
          <>
            <span className="badge">v{apiContract.version}</span>
            <span className="badge">{apiContract.routeCount} مسار API</span>
            <span className="badge">{records.length} سجل محمل</span>
          </>
        )}
        actions={(
          <>
            <a className="button button-primary" href="/uploads">إضافة للأرشيف</a>
            <a className="button button-primary" href="/archive">فتح الأرشيف</a>
            <button type="button" className="button button-secondary" onClick={() => void loadDashboard()}>
              تحديث
            </button>
          </>
        )}
      />

      <section className="page-section" aria-labelledby="stats-heading">
        <div className="toolbar-row toolbar-start">
          <h2 id="stats-heading" className="section-heading">مؤشرات الأرشيف</h2>
          <span className="badge">من بيانات البحث الحية</span>
        </div>

        {recordsState.status === "loading" ? (
          <div className="panel panel-compact" role="status" aria-live="polite">
            <p className="form-status">جار تحميل مؤشرات الأرشيف...</p>
          </div>
        ) : null}

        {recordsState.status === "error" ? (
          <div className="state-banner state-banner-error" role="alert">
            <strong>تعذر تحميل مؤشرات الأرشيف</strong>
            <span className="helper-text">{recordsState.message}</span>
          </div>
        ) : null}

        {recordsState.status === "ready" ? (
          <>
            <MetricStrip
              ariaLabel="مؤشرات لوحة التشغيل"
              items={[
                { label: "السجلات", value: records.length, description: "محملة من البحث", icon: <Archive size={20} />, tone: "accent" },
                { label: "الأنواع", value: Object.keys(stats.countByType).length, description: "تصنيفات نشطة", icon: <BarChart3 size={20} />, tone: "info" },
                { label: "الحالات", value: Object.keys(stats.countByStatus).length, description: "من metadata", icon: <Activity size={20} />, tone: "success" },
                { label: "مهام الوسائط", value: jobs.length, description: `${activeJobs} نشطة`, icon: <Film size={20} />, tone: failedJobs > 0 ? "warning" : "default" }
              ]}
            />
            <div className="analytics-columns">
              <section className="panel">
                <div className="panel-title-row">
                  <div>
                    <h2>حسب النوع</h2>
                    <p>عدد السجلات لكل نوع محتوى.</p>
                  </div>
                </div>
                <div className="analytics-chip-list">
                  {Object.entries(stats.countByType).map(([type, count]) => (
                    <span key={type} className="badge">{type} ({count})</span>
                  ))}
                </div>
              </section>
              <section className="panel">
                <div className="panel-title-row">
                  <div>
                    <h2>حسب الحالة</h2>
                    <p>قراءة أولية من `metadata.status` لكل سجل.</p>
                  </div>
                </div>
                <div className="analytics-chip-list">
                  {Object.entries(stats.countByStatus).map(([status, count]) => (
                    <span key={status} className="badge">{status} ({count})</span>
                  ))}
                </div>
              </section>
            </div>
          </>
        ) : null}
      </section>

      <section className="page-section" aria-labelledby="attention-heading">
        <div className="toolbar-row toolbar-start">
          <h2 id="attention-heading" className="section-heading">مهام تحتاج انتباه</h2>
          <span className="badge">قائمة تشغيل</span>
        </div>
        <article className="workspace-panel">
          <ul className="attention-list">
            {attentionItems.map((item) => (
              <li key={item.href}>
                <span className="attention-list__icon">{item.icon}</span>
                <span>
                  <strong>{item.title}</strong>
                  <br />
                  <span className="helper-text">{item.description}</span>
                </span>
                <a className="badge" href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="page-section" aria-labelledby="recent-heading">
        <div className="toolbar-row toolbar-start">
          <h2 id="recent-heading" className="section-heading">أحدث السجلات</h2>
          <a className="badge" href="/archive">عرض الكل</a>
        </div>
        {recordsState.status === "ready" ? (
          recentRecords.length === 0 ? (
            <EmptyState icon={<Sparkles size={22} />} title="لا سجلات بعد." description="ابدأ بإضافة عناصر للأرشيف لتظهر هنا." />
          ) : (
            <article className="workspace-panel">
              <ul className="compact-list">
                {recentRecords.map((record) => (
                  <li key={record.id}>
                    <a className="text-accent" href={`/archive/${encodeURIComponent(record.id)}`}>
                      {record.title || "بدون عنوان"}
                    </a>
                    {" — "}
                    <span className="helper-text">
                      {record.type || "غير محدد"} · {formatDate(record.updatedAt || record.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          )
        ) : null}
      </section>

      <section className="page-section" aria-labelledby="jobs-heading">
        <div className="toolbar-row toolbar-start">
          <h2 id="jobs-heading" className="section-heading">آخر مهام الوسائط</h2>
          <a className="badge" href="/media/jobs">إدارة المهام</a>
        </div>

        {jobsState.status === "loading" ? (
          <div className="panel panel-compact" role="status" aria-live="polite">
            <p className="form-status">جار تحميل مهام الوسائط...</p>
          </div>
        ) : null}

        {jobsState.status === "error" ? (
          <div className="state-banner state-banner-error" role="alert">
            <strong>تعذر تحميل مهام الوسائط</strong>
            <span className="helper-text">{jobsState.message}</span>
          </div>
        ) : null}

        {jobsState.status === "ready" ? (
          jobs.length === 0 ? (
            <EmptyState icon={<Clock3 size={22} />} title="لا مهام وسائط حديثة." description="أطلق مهمة معالجة من صفحة الوسائط لتظهر هنا." />
          ) : (
            <article className="workspace-panel">
              <ul className="compact-list">
                {jobs.map((job) => (
                  <li key={job.id}>
                    <strong>{job.operation}</strong>
                    {" — "}
                    <span className="badge" data-tone={job.status === "failed" ? "danger" : undefined}>
                      {jobStatusLabels[job.status]}
                    </span>{" "}
                    <span className="helper-text">
                      سجل {job.recordId} · {formatDate(job.completedAt || job.startedAt || job.queuedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          )
        ) : null}
      </section>

      <section className="page-section" aria-labelledby="shortcuts-heading">
        <div className="toolbar-row toolbar-start">
          <h2 id="shortcuts-heading" className="section-heading">اختصارات تشغيل</h2>
          <span className="badge">وصول مباشر</span>
        </div>
        <article className="workspace-panel">
          <div className="button-row">
            {quickLinks.map((item) => (
              <a key={item.href} className="button button-secondary" href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
