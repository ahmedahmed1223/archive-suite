"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
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

const HUB_LINKS = [
  { href: "/uploads", title: "الرفع والاستيراد اليدوي", description: "رفع ملفات جديدة، قوالب الإدخال، روابط الرفع الخارجية." },
  { href: "/ingest", title: "الاستيراد الآلي", description: "مسح المجلدات، السحب عبر FTP/SMB، متابعة الدفعات الواردة." },
  { href: "/backup", title: "النسخ الاحتياطي والاستعادة", description: "إنشاء نسخة فورية، معاينة المحتوى، أو الاستعادة الكاملة." },
  { href: "/status", title: "حالة النظام", description: "صحة الاتصال، مقاييس الخادم الحية، وجاهزية التعافي من الكوارث." },
  { href: "/settings", title: "الإعدادات", description: "إعدادات الأمان، المستخدمون، وسياسات الوصول." },
  { href: "/system/control", title: "التحكم بالنظام", description: "إجراءات مضيف حساسة (معطّلة افتراضيًا، للمشرفين فقط)." }
] as const;

export default function DataCenterPage() {
  const [summary, setSummary] = useState<SummaryState>({ status: "loading" });
  const apiRef = useRef(createArchiveApiClient());

  const loadSummary = useCallback(async () => {
    setSummary({ status: "loading" });
    try {
      const response = await apiRef.current.systemStatus();
      if (!response.ok) {
        if ("error" in response && response.error === "Forbidden.") {
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

  return (
    <AppShell subtitle="مركز البيانات" navLabel="مركز البيانات" contentClassName="observability-content">
      <PageToolbar
        eyebrow={<span className="badge">Data Center</span>}
        title="مركز البيانات"
        description="نقطة تجميع لعمليات الرفع، الاستيراد، النسخ الاحتياطي، الحالة، والإعدادات — كل الروابط والملخصات المهمة في مكان واحد."
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
        <section className="panel" aria-label="ملخص سريع">
          <div className="panel-title-row">
            <div>
              <h2>ملخص سريع</h2>
              <p>مصدره `/api/v1/system/status`، مطابق لما يظهر في صفحة الحالة.</p>
            </div>
          </div>
          <div className="kv-grid">
            <div className="kv-item">
              <strong>الذاكرة المستخدمة</strong>
              <span>
                {formatBytes(summary.metrics.memory.usedBytes)} / {formatBytes(summary.metrics.memory.totalBytes)}
              </span>
            </div>
            <div className="kv-item">
              <strong>القرص المستخدم</strong>
              <span>
                {formatBytes(summary.metrics.disk.usedBytes)} / {formatBytes(summary.metrics.disk.totalBytes)}
              </span>
            </div>
            <div className="kv-item">
              <strong>عمق قائمة المهام</strong>
              <span>{summary.metrics.queueDepth}</span>
            </div>
            <div className="kv-item">
              <strong>آخر نسخة احتياطية</strong>
              <span>{summary.dr.lastBackupName ? formatDate(summary.dr.lastBackupAt) : "لا توجد نسخة بعد"}</span>
            </div>
          </div>
        </section>
      ) : null}

      <section className="panel" aria-label="أقسام مركز البيانات">
        <div className="panel-title-row">
          <div>
            <h2>الأقسام</h2>
            <p>انتقل مباشرة إلى أي عملية تشغيلية.</p>
          </div>
        </div>
        <div className="health-metric-grid">
          {HUB_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="panel panel-compact">
              <strong>{link.title}</strong>
              <p className="helper-text">{link.description}</p>
            </a>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
