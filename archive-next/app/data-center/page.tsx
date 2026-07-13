"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, Database, Gauge, HardDriveDownload, ServerCog, Settings, ShieldCheck, UploadCloud, Workflow } from "lucide-react";
import AppShell from "@/components/AppShell";
import MetricStrip from "@/components/MetricStrip";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type DrProbe, type SystemMetrics } from "@/lib/archive-api";

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

  return (
    <AppShell subtitle="مركز البيانات" navLabel="مركز البيانات" contentClassName="observability-content">
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
              label: "قائمة المهام",
              value: summary.metrics.queueDepth,
              description: "عمق المعالجة الحالي",
              icon: <Workflow size={20} />,
              tone: summary.metrics.queueDepth > 20 ? "warning" : "success"
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
