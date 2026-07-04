"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Archive,
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  Film,
  Gauge,
  ListChecks,
  PlayCircle,
  PlusCircle,
  RefreshCw,
  Search,
  Sparkles,
  UploadCloud,
  Workflow,
  Zap
} from "lucide-react";
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

type FocusMode = "overview" | "intake" | "media";
type JobFilter = MediaJobStatus | "all";

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

const jobFilters: Array<{ id: JobFilter; label: string }> = [
  { id: "all", label: "الكل" },
  { id: "queued", label: "انتظار" },
  { id: "processing", label: "معالجة" },
  { id: "completed", label: "مكتملة" },
  { id: "failed", label: "فاشلة" }
];

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

function getRecordStatus(record: ArchiveRecord) {
  const status = record.metadata?.status;
  return typeof status === "string" && status.trim() ? status : "active";
}

function getJobPulse(status: MediaJobStatus) {
  if (status === "completed") return 100;
  if (status === "processing") return 66;
  if (status === "queued") return 28;
  return 12;
}

export default function HomePage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [recordsState, setRecordsState] = useState<RecordsState>({ status: "loading" });
  const [jobsState, setJobsState] = useState<JobsState>({ status: "loading" });
  const [activeFocus, setActiveFocus] = useState<FocusMode>("overview");
  const [selectedTaskHref, setSelectedTaskHref] = useState("/uploads");
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [jobFilter, setJobFilter] = useState<JobFilter>("all");

  const loadDashboard = useCallback(async () => {
    setRecordsState({ status: "loading" });
    setJobsState({ status: "loading" });

    // Parallel independent fetches; each widget fails on its own.
    void (async () => {
      try {
        const response = await api.search({ limit: 100 });
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

      const status = getRecordStatus(record);
      countByStatus[status] = (countByStatus[status] || 0) + 1;
    });

    return { countByType, countByStatus };
  }, [records]);

  const recentRecords = useMemo(
    () => [...records].sort((a, b) => getRecordTime(b) - getRecordTime(a)).slice(0, 8),
    [records]
  );

  useEffect(() => {
    if (recentRecords.length === 0) {
      setActiveRecordId(null);
      return;
    }

    if (!activeRecordId || !recentRecords.some((record) => record.id === activeRecordId)) {
      setActiveRecordId(recentRecords[0].id);
    }
  }, [activeRecordId, recentRecords]);

  const jobs = jobsState.status === "ready" ? jobsState.jobs : [];
  const failedJobs = jobs.filter((job) => job.status === "failed").length;
  const activeJobs = jobs.filter((job) => job.status === "queued" || job.status === "processing").length;
  const filteredJobs = jobFilter === "all" ? jobs : jobs.filter((job) => job.status === jobFilter);
  const activeRecord = recentRecords.find((record) => record.id === activeRecordId) || recentRecords[0] || null;

  const typeBreakdown = useMemo(
    () => Object.entries(stats.countByType).sort((a, b) => b[1] - a[1]),
    [stats.countByType]
  );
  const statusBreakdown = useMemo(
    () => Object.entries(stats.countByStatus).sort((a, b) => b[1] - a[1]),
    [stats.countByStatus]
  );
  const maxTypeCount = Math.max(1, ...typeBreakdown.map(([, count]) => count));
  const maxStatusCount = Math.max(1, ...statusBreakdown.map(([, count]) => count));

  const attentionItems = useMemo(
    () => [
      {
        icon: <UploadCloud size={18} />,
        title: "إضافة مادة جديدة",
        description: "ابدأ من معالج الإضافة لإرفاق ملفات وmetadata ومراجعة قبل الإنشاء.",
        href: "/uploads",
        label: "إضافة",
        metric: "مسار إدخال"
      },
      {
        icon: <Search size={18} />,
        title: "مراجعة نتائج البحث",
        description: `${records.length} سجل متاح للتصفية والفرز والمعاينة داخل الأرشيف.`,
        href: "/archive",
        label: "فتح",
        metric: `${records.length} سجل`
      },
      {
        icon: failedJobs > 0 ? <AlertTriangle size={18} /> : <Film size={18} />,
        title: failedJobs > 0 ? "مهام وسائط فاشلة" : "مهام الوسائط",
        description: failedJobs > 0 ? `${failedJobs} مهمة تحتاج فحصًا.` : `${activeJobs} مهمة قيد الانتظار أو المعالجة.`,
        href: "/media/jobs",
        label: "مراجعة",
        metric: failedJobs > 0 ? "تنبيه" : `${activeJobs} نشطة`
      }
    ],
    [activeJobs, failedJobs, records.length]
  );

  const selectedTask = attentionItems.find((item) => item.href === selectedTaskHref) || attentionItems[0];

  const readinessItems = useMemo(
    () => [
      { label: "اتصال السجلات", complete: recordsState.status === "ready", detail: recordsState.status === "error" ? "متعثر" : "نشط" },
      { label: "محتوى قابل للعمل", complete: records.length > 0, detail: records.length > 0 ? `${records.length} سجل` : "بانتظار الإدخال" },
      { label: "مهام الوسائط", complete: jobsState.status === "ready" && failedJobs === 0, detail: failedJobs > 0 ? `${failedJobs} فاشلة` : "مستقرة" },
      { label: "عقد API", complete: apiContract.routeCount > 0, detail: `${apiContract.routeCount} مسار` }
    ],
    [failedJobs, jobsState.status, records.length, recordsState.status]
  );
  const readinessScore = Math.round((readinessItems.filter((item) => item.complete).length / readinessItems.length) * 100);

  const focusModes = [
    { id: "overview" as const, label: "تشغيل", icon: <Gauge size={16} /> },
    { id: "intake" as const, label: "إدخال", icon: <PlusCircle size={16} /> },
    { id: "media" as const, label: "وسائط", icon: <Film size={16} /> }
  ];

  const focusCards: Record<FocusMode, {
    title: string;
    description: string;
    href: string;
    cta: string;
    metric: string;
    steps: string[];
  }> = {
    overview: {
      title: "مركز مراقبة اليوم",
      description: "راقب صحة الأرشيف، آخر النشاط، والتنبيهات المهمة من نقطة واحدة.",
      href: "/archive",
      cta: "افتح الأرشيف",
      metric: `${records.length} سجل`,
      steps: ["راجع المؤشرات", "افتح آخر سجل", "نفذ المهمة التالية"]
    },
    intake: {
      title: "مسار إدخال سريع",
      description: "حوّل المواد الجديدة إلى سجلات قابلة للبحث مع مراجعة metadata قبل الحفظ.",
      href: "/uploads",
      cta: "ابدأ الإضافة",
      metric: "3 خطوات",
      steps: ["ارفع الملفات", "راجع البيانات", "أنشئ السجل"]
    },
    media: {
      title: "لوحة معالجة الوسائط",
      description: "تابع التحويل، التفريغ، المصغرات، والتنبيهات دون مغادرة لوحة التشغيل.",
      href: "/media/jobs",
      cta: "إدارة المهام",
      metric: `${activeJobs} نشطة`,
      steps: ["افحص الطابور", "عالج الفشل", "راجع النتائج"]
    }
  };
  const activeFocusCard = focusCards[activeFocus];
  const operationSignals = [
    {
      icon: <Database size={18} />,
      title: "عقد API",
      value: `${apiContract.routeCount} مسار`,
      href: "/status"
    },
    {
      icon: <Workflow size={18} />,
      title: "مسار العمل",
      value: activeFocusCard.cta,
      href: activeFocusCard.href
    },
    {
      icon: <ListChecks size={18} />,
      title: "مراجعة اليوم",
      value: failedJobs > 0 ? `${failedJobs} تنبيه` : "مستقرة",
      href: failedJobs > 0 ? "/media/jobs" : "/activity"
    }
  ];

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
            <a className="button button-primary" href="/uploads">
              <PlusCircle size={16} />
              إضافة للأرشيف
            </a>
            <a className="button button-primary" href="/archive">
              <Archive size={16} />
              فتح الأرشيف
            </a>
            <button type="button" className="button button-secondary" onClick={() => void loadDashboard()}>
              <RefreshCw size={16} />
              تحديث
            </button>
          </>
        )}
      >
        <div className="dashboard-focus-tabs" role="group" aria-label="تبديل تركيز لوحة التشغيل">
          {focusModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className="dashboard-focus-tabs__button"
              aria-pressed={activeFocus === mode.id}
              onClick={() => setActiveFocus(mode.id)}
            >
              {mode.icon}
              <span>{mode.label}</span>
            </button>
          ))}
        </div>
      </PageToolbar>

      <section className="dashboard-live-board" aria-label="لوحة تحكم تفاعلية">
        <article className="dashboard-focus-panel" data-mode={activeFocus}>
          <div className="dashboard-focus-panel__glow" aria-hidden="true" />
          <div className="dashboard-focus-panel__content">
            <div className="dashboard-focus-panel__header">
              <span className="dashboard-focus-panel__kicker">
                <Zap size={16} />
                تركيز الآن
              </span>
              <strong>{activeFocusCard.metric}</strong>
            </div>
            <h2>{activeFocusCard.title}</h2>
            <p>{activeFocusCard.description}</p>
            <ol className="dashboard-flow-steps">
              {activeFocusCard.steps.map((step, index) => (
                <li key={step}>
                  <span>{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="button-row">
              <a className="button button-primary" href={activeFocusCard.href}>
                <PlayCircle size={16} />
                {activeFocusCard.cta}
              </a>
              <button type="button" className="button button-secondary" onClick={() => void loadDashboard()}>
                <RefreshCw size={16} />
                مزامنة
              </button>
            </div>
          </div>
        </article>

        <article className="dashboard-readiness-card" aria-label="مؤشر جاهزية التشغيل">
          <div className="dashboard-readiness-card__header">
            <span className="badge">جاهزية التشغيل</span>
            <strong>{readinessScore}%</strong>
          </div>
          <div className="dashboard-progress" aria-hidden="true">
            <span style={{ inlineSize: `${readinessScore}%` }} />
          </div>
          <ul className="dashboard-readiness-list">
            {readinessItems.map((item) => (
              <li key={item.label} data-complete={item.complete}>
                <CheckCircle2 size={17} />
                <span>{item.label}</span>
                <small>{item.detail}</small>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="dashboard-signal-strip" aria-label="إشارات تشغيل مختصرة">
        {operationSignals.map((signal) => (
          <a key={signal.title} className="dashboard-signal" href={signal.href}>
            <span className="dashboard-signal__icon" aria-hidden="true">{signal.icon}</span>
            <span>
              <strong>{signal.title}</strong>
              <small>{signal.value}</small>
            </span>
          </a>
        ))}
      </section>

      <div className="dashboard-workspace">
        <section className="page-section dashboard-stats" aria-labelledby="stats-heading">
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
                <section className="panel dashboard-breakdown-panel">
                  <div className="panel-title-row">
                    <div>
                      <h2>حسب النوع</h2>
                      <p>توزيع مرئي للسجلات حسب نوع المحتوى.</p>
                    </div>
                  </div>
                  <div className="dashboard-breakdown-list">
                    {typeBreakdown.map(([type, count]) => (
                      <div key={type} className="dashboard-breakdown-row">
                        <span>{type}</span>
                        <div className="dashboard-mini-bar" aria-hidden="true">
                          <span style={{ inlineSize: `${Math.max(12, (count / maxTypeCount) * 100)}%` }} />
                        </div>
                        <strong>{count}</strong>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="panel dashboard-breakdown-panel">
                  <div className="panel-title-row">
                    <div>
                      <h2>حسب الحالة</h2>
                      <p>قراءة أولية من `metadata.status` لكل سجل.</p>
                    </div>
                  </div>
                  <div className="dashboard-breakdown-list">
                    {statusBreakdown.map(([status, count]) => (
                      <div key={status} className="dashboard-breakdown-row">
                        <span>{status}</span>
                        <div className="dashboard-mini-bar" aria-hidden="true">
                          <span style={{ inlineSize: `${Math.max(12, (count / maxStatusCount) * 100)}%` }} />
                        </div>
                        <strong>{count}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          ) : null}
        </section>

        <section className="page-section dashboard-attention" aria-labelledby="attention-heading">
          <div className="toolbar-row toolbar-start">
            <h2 id="attention-heading" className="section-heading">مهام تحتاج انتباه</h2>
            <span className="badge">قائمة تشغيل</span>
          </div>
          <article className="workspace-panel dashboard-attention-panel">
            <ul className="attention-list">
              {attentionItems.map((item) => (
                <li key={item.href}>
                  <button
                    type="button"
                    className="attention-list__item"
                    data-active={selectedTask.href === item.href}
                    onClick={() => setSelectedTaskHref(item.href)}
                  >
                    <span className="attention-list__icon">{item.icon}</span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.description}</small>
                    </span>
                    <em>{item.metric}</em>
                  </button>
                </li>
              ))}
            </ul>
            <div className="dashboard-task-preview">
              <span className="badge">المهمة المحددة</span>
              <h3>{selectedTask.title}</h3>
              <p>{selectedTask.description}</p>
              <a className="button button-primary" href={selectedTask.href}>
                {selectedTask.label}
              </a>
            </div>
          </article>
        </section>

        <section className="page-section dashboard-recent" aria-labelledby="recent-heading">
          <div className="toolbar-row toolbar-start">
            <h2 id="recent-heading" className="section-heading">أحدث السجلات</h2>
            <a className="badge" href="/archive">عرض الكل</a>
          </div>
          {recordsState.status === "ready" ? (
            recentRecords.length === 0 ? (
              <EmptyState icon={<Sparkles size={22} />} title="لا سجلات بعد." description="ابدأ بإضافة عناصر للأرشيف لتظهر هنا." />
            ) : (
              <article className="workspace-panel dashboard-record-browser">
                <div className="dashboard-record-list" role="listbox" aria-label="أحدث السجلات">
                  {recentRecords.map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      role="option"
                      aria-selected={activeRecord?.id === record.id}
                      className="dashboard-record-card"
                      onClick={() => setActiveRecordId(record.id)}
                    >
                      <span className="dashboard-record-card__title">{record.title || "بدون عنوان"}</span>
                      <span className="dashboard-record-card__meta">
                        {record.type || "غير محدد"} · {formatDate(record.updatedAt || record.createdAt)}
                      </span>
                    </button>
                  ))}
                </div>
                <aside className="dashboard-record-preview" aria-live="polite">
                  {activeRecord ? (
                    <>
                      <span className="badge">{getRecordStatus(activeRecord)}</span>
                      <h3>{activeRecord.title || "بدون عنوان"}</h3>
                      <p>{activeRecord.description || "لا يوجد وصف مختصر لهذا السجل بعد."}</p>
                      <dl>
                        <div>
                          <dt>النوع</dt>
                          <dd>{activeRecord.type || "غير محدد"}</dd>
                        </div>
                        <div>
                          <dt>آخر تحديث</dt>
                          <dd>{formatDate(activeRecord.updatedAt || activeRecord.createdAt)}</dd>
                        </div>
                      </dl>
                      <a className="button button-secondary" href={`/archive/${encodeURIComponent(activeRecord.id)}`}>
                        فتح التفاصيل
                      </a>
                    </>
                  ) : null}
                </aside>
              </article>
            )
          ) : null}
        </section>

        <section className="page-section dashboard-jobs" aria-labelledby="jobs-heading">
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
              <article className="workspace-panel dashboard-job-panel">
                <div className="dashboard-job-filters" role="group" aria-label="تصفية مهام الوسائط">
                  {jobFilters.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      className="badge"
                      data-active={jobFilter === filter.id}
                      onClick={() => setJobFilter(filter.id)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <ul className="dashboard-job-timeline">
                  {filteredJobs.map((job) => (
                    <li key={job.id} data-status={job.status}>
                      <span className="dashboard-job-timeline__dot" aria-hidden="true" />
                      <div>
                        <strong>{job.operation}</strong>
                        <span className="helper-text">
                          سجل {job.recordId} · {formatDate(job.completedAt || job.startedAt || job.queuedAt)}
                        </span>
                      </div>
                      <span className="badge" data-tone={job.status === "failed" ? "danger" : undefined}>
                        {jobStatusLabels[job.status]}
                      </span>
                      <div className="dashboard-job-progress" aria-hidden="true">
                        <span style={{ inlineSize: `${getJobPulse(job.status)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
                {filteredJobs.length === 0 ? (
                  <p className="helper-text">لا توجد مهام ضمن هذا المرشح.</p>
                ) : null}
              </article>
            )
          ) : null}
        </section>

        <section className="page-section dashboard-shortcuts" aria-labelledby="shortcuts-heading">
          <div className="toolbar-row toolbar-start">
            <h2 id="shortcuts-heading" className="section-heading">اختصارات تشغيل</h2>
            <span className="badge">وصول مباشر</span>
          </div>
          <article className="workspace-panel dashboard-shortcut-grid">
            {quickLinks.map((item, index) => (
              <a key={item.href} className="dashboard-shortcut" href={item.href}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item.label}</strong>
              </a>
            ))}
          </article>
        </section>
      </div>
    </AppShell>
  );
}
