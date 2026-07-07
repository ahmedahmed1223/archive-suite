"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ApiEnvelope, type DrProbe, type SystemMetrics } from "@/lib/archive-api";

function IconServer() {
  return (
    <svg className="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <rect x="2" y="2" width="20" height="8" rx="1" strokeWidth="2" />
      <rect x="2" y="14" width="20" height="8" rx="1" strokeWidth="2" />
      <line x1="6" y1="6" x2="6" y2="6.01" strokeWidth="2" />
      <line x1="6" y1="18" x2="6" y2="18.01" strokeWidth="2" />
    </svg>
  );
}

function IconSignal() {
  return (
    <svg className="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" strokeWidth="2" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" strokeWidth="2" />
      <line x1="12" y1="20" x2="12" y2="20.01" strokeWidth="2" />
    </svg>
  );
}

function IconSignalOff() {
  return (
    <svg className="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <line x1="1" y1="1" x2="23" y2="23" strokeWidth="2" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" strokeWidth="2" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.64-2.64" strokeWidth="2" />
      <path d="M19.23 15.56c.6.6 1.1 1.25 1.53 1.97" strokeWidth="2" />
      <path d="M2 17s.6 1.03 1.94 2.97" strokeWidth="2" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg className="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" strokeWidth="2" />
      <path d="M20.49 15a9 9 0 1 1-2-8.83" strokeWidth="2" />
    </svg>
  );
}

function IconAlertCircle() {
  return (
    <svg className="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" />
      <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" />
    </svg>
  );
}

interface HealthResponse {
  backend: string;
  engine: string;
  uptimeSec: number;
}

interface StatusState {
  status: "loading" | "success" | "error";
  health: HealthResponse | null;
  lastChecked: Date | null;
  error: string | null;
}

type MetricsState =
  | { status: "loading" | "forbidden" }
  | { status: "ready"; metrics: SystemMetrics; dr: DrProbe }
  | { status: "error"; message: string };

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "-";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}د ${h}س`;
  if (h > 0) return `${h}س ${m}د`;
  return `${m}د`;
}

function formatDateTime(date: Date | null): string {
  if (!date) return "-";
  try {
    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "short",
      timeStyle: "medium"
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function HealthMetric({
  icon,
  label,
  value,
  tone = "neutral"
}: Readonly<{
  icon: ReactNode;
  label: string;
  value: ReactNode;
  tone?: "neutral" | "success" | "danger" | "accent";
}>) {
  return (
    <article className="health-metric" data-tone={tone}>
      <div className="health-metric__icon">{icon}</div>
      <div className="health-metric__body">
        <span>{label}</span>
        <strong dir="auto">{value}</strong>
      </div>
    </article>
  );
}

export default function StatusPage() {
  const [state, setState] = useState<StatusState>({
    status: "loading",
    health: null,
    lastChecked: null,
    error: null
  });
  const [metricsState, setMetricsState] = useState<MetricsState>({ status: "loading" });
  const apiRef = useRef(createArchiveApiClient());
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkMetrics = useCallback(async () => {
    try {
      const response = await apiRef.current.systemStatus();
      if (!response.ok) {
        if ("error" in response && response.error === "Forbidden.") {
          setMetricsState({ status: "forbidden" });
          return;
        }
        setMetricsState({ status: "error", message: response.error || "تعذر تحميل مقاييس النظام." });
        return;
      }
      setMetricsState({ status: "ready", metrics: response.metrics, dr: response.dr });
    } catch (err) {
      setMetricsState({ status: "error", message: err instanceof Error ? err.message : "خطأ غير معروف" });
    }
  }, []);

  const checkHealth = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "loading" }));
    try {
      const response = (await apiRef.current.health()) as ApiEnvelope<HealthResponse>;

      if (!response.ok) {
        setState({
          status: "error",
          health: null,
          lastChecked: new Date(),
          error: response.error || "فشل الاتصال بالخادم"
        });
        return;
      }

      setState({
        status: "success",
        health: response,
        lastChecked: new Date(),
        error: null
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "خطأ غير معروف";
      setState({
        status: "error",
        health: null,
        lastChecked: new Date(),
        error: `خطأ في الاتصال: ${message}`
      });
    }
  }, []);

  useEffect(() => {
    void checkMetrics();
  }, [checkMetrics]);

  useEffect(() => {
    void checkHealth();

    refreshIntervalRef.current = setInterval(() => {
      void checkHealth();
    }, 30000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [checkHealth]);

  const isOnline = state.status === "success";
  const statusTone = isOnline ? "success" : state.status === "loading" ? "accent" : "danger";

  return (
    <AppShell subtitle="حالة النظام" navLabel="حالة النظام" contentClassName="observability-content">
      <PageToolbar
        eyebrow={<span className="badge">مراقبة تشغيلية</span>}
        title="حالة النظام"
        description="سطح سريع لمراقبة اتصال الخادم، محرك البيانات، ومدة التشغيل مع تحديث تلقائي كل 30 ثانية."
        meta={
          <>
            <span className={`badge ${isOnline ? "status-success" : "status-error"}`}>
              {isOnline ? "متصل" : state.status === "loading" ? "جار الفحص" : "غير متصل"}
            </span>
            <span className="badge">آخر فحص: {formatDateTime(state.lastChecked)}</span>
          </>
        }
        actions={
          <button
            type="button"
            onClick={() => void checkHealth()}
            disabled={state.status === "loading"}
            className="button button-secondary"
            aria-label="فحص الحالة الآن"
          >
            <span className={state.status === "loading" ? "status-refresh-icon is-spinning" : "status-refresh-icon"}>
              <IconRefresh />
            </span>
            {state.status === "loading" ? "جاري الفحص" : "فحص الآن"}
          </button>
        }
      />

      <section className="system-health-strip" data-tone={statusTone} aria-live="polite">
        <div className="system-health-strip__icon">{isOnline ? <IconSignal /> : <IconSignalOff />}</div>
        <div>
          <strong>{isOnline ? "الاتصال بالخادم مستقر" : state.status === "loading" ? "يتم فحص الاتصال" : "الاتصال بالخادم متوقف"}</strong>
          <p>{state.error || "يعرض هذا السطح صحة الواجهة الخلفية الحالية ونبض الاتصال المباشر."}</p>
        </div>
      </section>

      <div className="health-metric-grid">
        <HealthMetric icon={<IconServer />} label="الخادم الخلفي" value={state.health?.backend || "محلي"} tone={isOnline ? "success" : "neutral"} />
        <HealthMetric icon={<IconServer />} label="محرك البيانات" value={state.health?.engine || "-"} tone="accent" />
        <HealthMetric
          icon={<IconRefresh />}
          label="مدة التشغيل"
          value={state.health?.uptimeSec != null ? formatUptime(state.health.uptimeSec) : "-"}
        />
      </div>

      {state.error ? (
        <section className="state-banner state-banner-error" role="alert">
          <strong>تعذر إكمال فحص الصحة</strong>
          <p>{state.error}</p>
        </section>
      ) : null}

      <section className="panel status-console" aria-label="تفاصيل الفحص">
        <div className="panel-title-row">
          <div>
            <h2>تفاصيل الفحص</h2>
            <p>تعتمد هذه البيانات على نقطة `/api/v1/health` بدون تغيير في عقد الواجهة الخلفية.</p>
          </div>
          <span className="badge">تحديث تلقائي</span>
        </div>
        <div className="kv-grid">
          <div className="kv-item">
            <strong>حالة الطلب</strong>
            <span>{state.status === "loading" ? "قيد التنفيذ" : isOnline ? "ناجح" : "فشل"}</span>
          </div>
          <div className="kv-item">
            <strong>إيقاع الفحص</strong>
            <span>30 ثانية</span>
          </div>
          <div className="kv-item">
            <strong>آخر تحديث</strong>
            <span>{formatDateTime(state.lastChecked)}</span>
          </div>
        </div>
      </section>

      {metricsState.status === "ready" ? (
        <section className="panel" aria-label="مقاييس الخادم الحية">
          <div className="panel-title-row">
            <div>
              <h2>مقاييس الخادم الحية</h2>
              <p>معالج، ذاكرة، قرص، وعمق قائمة المهام — من `/api/v1/system/status` (للمشرفين فقط).</p>
            </div>
          </div>
          <div className="kv-grid">
            <div className="kv-item">
              <strong>حمل المعالج</strong>
              <span>{metricsState.metrics.cpuLoad.length > 0 ? metricsState.metrics.cpuLoad.map((v) => v.toFixed(2)).join(" / ") : "غير متاح"}</span>
            </div>
            <div className="kv-item">
              <strong>الذاكرة</strong>
              <span>
                {formatBytes(metricsState.metrics.memory.usedBytes)} / {formatBytes(metricsState.metrics.memory.totalBytes)}
              </span>
            </div>
            <div className="kv-item">
              <strong>القرص</strong>
              <span>
                {formatBytes(metricsState.metrics.disk.usedBytes)} / {formatBytes(metricsState.metrics.disk.totalBytes)}
              </span>
            </div>
            <div className="kv-item">
              <strong>عمق قائمة المهام</strong>
              <span>{metricsState.metrics.queueDepth}</span>
            </div>
          </div>
        </section>
      ) : null}

      {metricsState.status === "ready" ? (
        <section className="panel" aria-label="جاهزية التعافي من الكوارث">
          <div className="panel-title-row">
            <div>
              <h2>جاهزية التعافي من الكوارث</h2>
              <p>آخر نسخة احتياطية وآخر اختبار استعادة، من `/api/v1/system/dr-probe`.</p>
            </div>
            <a className="button button-secondary" href="/backup">
              إدارة النسخ الاحتياطي
            </a>
          </div>
          <div className="kv-grid">
            <div className="kv-item">
              <strong>آخر نسخة احتياطية</strong>
              <span>{metricsState.dr.lastBackupName ? `${metricsState.dr.lastBackupName} — ${formatDateTime(metricsState.dr.lastBackupAt ? new Date(metricsState.dr.lastBackupAt) : null)}` : "لا توجد نسخة بعد"}</span>
            </div>
            <div className="kv-item">
              <strong>آخر اختبار استعادة</strong>
              <span>
                {metricsState.dr.lastRestoreTestAt
                  ? `${metricsState.dr.lastRestoreTestOk ? "نجح" : "فشل"} — ${formatDateTime(new Date(metricsState.dr.lastRestoreTestAt))}`
                  : "لم يُجرَ بعد"}
              </span>
            </div>
          </div>
        </section>
      ) : null}

      {metricsState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل مقاييس النظام</strong>
          <p>{metricsState.message}</p>
        </div>
      ) : null}

      <section className="panel">
        <div className="panel-title-row">
          <div>
            <h2>إشارات المتابعة</h2>
            <p>استخدم سجل الأخطاء والتحليلات عند ظهور انقطاع أو تباطؤ للتأكد من أثره على تجربة المستخدم.</p>
          </div>
          <a className="button button-secondary" href="/errors">
            سجل الأخطاء
          </a>
        </div>
      </section>
    </AppShell>
  );
}
