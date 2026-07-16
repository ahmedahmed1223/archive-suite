"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, Database, Gauge, HardDriveDownload, ServerCog, Settings, ShieldCheck, UploadCloud, Workflow } from "lucide-react";
import AppShell from "@/components/AppShell";
import MetricStrip from "@/components/MetricStrip";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type DrProbe, type SystemMetrics } from "@/lib/archive-api";
import { assessQueues, type QueueStatus } from "@/lib/queue-health";

type SummaryState =
  | { status: "loading" }
  | { status: "ready"; metrics: SystemMetrics; dr: DrProbe }
  | { status: "forbidden" }
  | { status: "error"; message: string };

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ar-SA");
}

function percent(used: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

// V1-760: queue depth alone cannot tell a busy queue from a stalled one, so
// the tone follows the assessed verdict (which weighs oldest-job age and
// failures) rather than the raw count.
const QUEUE_TONE: Record<QueueStatus, "success" | "warning" | "danger" | "info"> = {
  healthy: "success",
  warning: "warning",
  critical: "danger",
  unknown: "info",
};

const QUEUE_STATUS_LABEL: Record<QueueStatus, string> = {
  healthy: "سليم",
  warning: "تحذير",
  critical: "حرج",
  unknown: "غير معروف",
};

const QUEUE_REASON_LABEL: Record<string, string> = {
  depth: "تراكم عميق",
  stalled: "متوقف",
  failures: "مهام فاشلة",
  unreadable: "قراءة غير متاحة",
};

function formatAge(seconds: number): string {
  if (seconds <= 0) return "-";
  if (seconds < 60) return `${seconds} ث`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} د`;
  return `${Math.floor(seconds / 3600)} س`;
}

const HUB_LINKS = [
  { href: "/uploads", title: "الرفع والاستيراد اليدوي", description: "رفع ملفات جديدة، قوالب الإدخال، روابط الرفع الخارجية.", meta: "Intake", icon: UploadCloud },
  { href: "/ingest", title: "الاستيراد الآلي", description: "مسح المجلدات، السحب عبر FTP/SMB، متابعة الدفعات الواردة.", meta: "Pipelines", icon: Workflow },
  { href: "/backup", title: "النسخ الاحتياطي والاستعادة", description: "إنشاء نسخة فورية، معاينة المحتوى، أو الاستعادة الكاملة.", meta: "DR", icon: HardDriveDownload },
  { href: "/status", title: "حالة النظام", description: "صحة الاتصال، مقاييس الخادم الحية، وجاهزية التعافي من الكوارث.", meta: "Health", icon: Gauge },
  { href: "/settings", title: "الإعدادات", description: "إعدادات الأمان، المستخدمون، وسياسات الوصول.", meta: "Policy", icon: Settings },
  { href: "/system/control", title: "التحكم بالنظام", description: "إجراءات مضيف حساسة (معطّلة افتراضيًا، للمشرفين فقط).", meta: "Admin", icon: ServerCog }
] as const;

export default function DataCenterPage() {
  const [summary, setSummary] = useState<SummaryState>({ status: "loading" });
  const apiRef = useRef(createArchiveApiClient());

  const loadSummary = useCallback(async () => {
    setSummary({ status: "loading" });
    try {
      const response = await apiRef.current.systemStatus();
      if (!response.ok) {
        // ponytail: `error === "Forbidden."` is a transitional fallback for
        // an older API that predates the `code` field — drop once the API
        // is guaranteed to always send `code`.
        if (response.code === "FORBIDDEN" || response.error === "Forbidden.") {
          setSummary({ status: "forbidden" });
          return;
        }
        setSummary({ status: "error", message: response.error || "تعذر تحميل ملخص مركز البيانات." });
        return;
      }
      setSummary({ status: "ready", metrics: response.metrics, dr: response.dr });
    } catch (error) {
      setSummary({ status: "error", message: error instanceof Error ? error.message : "خطأ غير معروف" });
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const memoryPercent = summary.status === "ready" ? percent(summary.metrics.memory.usedBytes, summary.metrics.memory.totalBytes) : 0;
  const diskPercent = summary.status === "ready" ? percent(summary.metrics.disk.usedBytes, summary.metrics.disk.totalBytes) : 0;
  // An idle stack reports no queues at all; that is genuinely nothing pending,
  // not a blind spot, so it stays healthy instead of the assessor's "unknown".
  const queueHealth =
    summary.status === "ready" && summary.metrics.queues.length > 0
      ? assessQueues(summary.metrics.queues)
      : { status: "healthy" as QueueStatus, queues: [] };

  return (
    <AppShell subtitle="مركز البيانات" navLabel="مركز البيانات" contentClassName="observability-content" tipsPage="data-center">
      <PageToolbar
        icon={<Database size={24} />}
        eyebrow={<span className="badge">Data Center</span>}
        title="مركز البيانات"
        description="نقطة تجميع لعمليات الرفع، الاستيراد، النسخ الاحتياطي، الحالة، والإعدادات — كل الروابط والملخصات المهمة في مكان واحد."
        meta={
          <span className={summary.status === "ready" ? "badge badge-success" : "badge"}>
            {summary.status === "ready" ? "المقاييس متصلة" : summary.status === "loading" ? "جار الفحص" : "يتطلب مراجعة"}
          </span>
        }
        actions={
          <button type="button" className="button button-secondary" onClick={() => void loadSummary()} disabled={summary.status === "loading"}>
            تحديث الملخص
          </button>
        }
      />

      {summary.status === "forbidden" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>ملخص المقاييس متاح للمشرفين فقط</strong>
          <p>يمكنك مع ذلك استخدام الروابط أدناه للانتقال إلى كل قسم مباشرة.</p>
        </div>
      ) : null}

      {summary.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل الملخص</strong>
          <p>{summary.message}</p>
        </div>
      ) : null}

      {summary.status === "ready" ? (
        <MetricStrip
          ariaLabel="ملخص مركز البيانات"
          items={[
            {
              label: "الذاكرة",
              value: `${memoryPercent}%`,
              description: `${formatBytes(summary.metrics.memory.usedBytes)} / ${formatBytes(summary.metrics.memory.totalBytes)}`,
              icon: <Gauge size={20} />,
              tone: memoryPercent > 85 ? "warning" : "success"
            },
            {
              label: "القرص",
              value: `${diskPercent}%`,
              description: `${formatBytes(summary.metrics.disk.usedBytes)} / ${formatBytes(summary.metrics.disk.totalBytes)}`,
              icon: <Archive size={20} />,
              tone: diskPercent > 85 ? "warning" : "info"
            },
            {
              label: "الطوابير الخلفية",
              value: summary.metrics.queueDepth,
              description: `${QUEUE_STATUS_LABEL[queueHealth.status]} — ${summary.metrics.queues.length} طابور نشط`,
              icon: <Workflow size={20} />,
              tone: QUEUE_TONE[queueHealth.status]
            },
            {
              label: "آخر نسخة",
              value: summary.dr.lastBackupName ? "موجودة" : "لا توجد",
              description: summary.dr.lastBackupName ? formatDate(summary.dr.lastBackupAt) : "ابدأ من مركز النسخ",
              icon: <ShieldCheck size={20} />,
              tone: summary.dr.lastBackupName ? "success" : "warning"
            }
          ]}
        />
      ) : null}

      {summary.status === "ready" && summary.metrics.queues.length > 0 ? (
        <section className="workspace-panel" aria-label="صحة الطوابير الخلفية">
          <div className="panel-title-row">
            <div>
              <h2>صحة الطوابير الخلفية</h2>
              <p>الاستيراد والوسائط والنسخ الاحتياطي. عمر أقدم مهمة يميّز الطابور المتوقف عن المزدحم.</p>
            </div>
            <span className="badge">{QUEUE_STATUS_LABEL[queueHealth.status]}</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">الطابور</th>
                <th scope="col">الحالة</th>
                <th scope="col">قيد الانتظار</th>
                <th scope="col">فاشلة</th>
                <th scope="col">عمر أقدم مهمة</th>
              </tr>
            </thead>
            <tbody>
              {summary.metrics.queues.map((queue) => {
                const health = queueHealth.queues.find((entry) => entry.name === queue.name);
                const status = health?.status ?? "unknown";
                return (
                  <tr key={queue.name}>
                    <td>{queue.name}</td>
                    <td>
                      {/* Status is never colour-only: the label carries it for anyone who cannot see the tone. */}
                      <span className={`badge badge-${QUEUE_TONE[status]}`}>{QUEUE_STATUS_LABEL[status]}</span>
                      {health?.reasons.length ? (
                        <span className="helper-text"> {health.reasons.map((reason) => QUEUE_REASON_LABEL[reason] ?? reason).join("، ")}</span>
                      ) : null}
                    </td>
                    <td>{queue.depth}</td>
                    <td>{queue.failed}</td>
                    <td>{formatAge(queue.oldestJobAgeSec)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="workspace-panel data-center-hub" aria-label="أقسام مركز البيانات">
        <div className="panel-title-row">
          <div>
            <h2>مسارات التشغيل</h2>
            <p>كل بطاقة تفتح مساحة عمل مرتبطة بعملية بيانات محددة.</p>
          </div>
          <span className="badge">{HUB_LINKS.length} مسارات</span>
        </div>
        <div className="data-center-link-grid">
          {HUB_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="data-center-link-card">
              <span className="data-center-link-card__icon" aria-hidden="true">
                <link.icon size={20} />
              </span>
              <span className="badge">{link.meta}</span>
              <strong>{link.title}</strong>
              <p className="helper-text">{link.description}</p>
            </a>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
