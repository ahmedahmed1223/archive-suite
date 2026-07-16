"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileBarChart, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import {
  createArchiveApiClient,
  type ComplianceReportEntry,
  type ComplianceReportFilters,
  type ComplianceReportSummary,
  type StorageSample
} from "@/lib/archive-api";
import { formatDate } from "@/lib/record-utils";
import { buildExportPreview, redactAdminSecrets } from "@/lib/admin-action-summary";
import { forecastStorageGrowth } from "@/lib/storage-forecast";
import "./reports.css";

const eventOptions = [
  ["", "كل الأحداث"],
  ["records.bulk_upsert", "تحديث السجلات"],
  ["rights.upsert", "تحديث الحقوق"],
  ["media.workflow.queue", "مهام الوسائط"],
  ["relations.create", "إضافة علاقة"],
  ["system_control.allowed", "إجراء نظام"],
  ["system_control.rejected", "إجراء نظام مرفوض"]
] as const;

const resourceTypeOptions = [
  ["", "كل الموارد"],
  ["record", "سجل"],
  ["rights_record", "حقوق"],
  ["media_job", "وسائط"],
  ["record_relation", "علاقة"],
  ["system_control_action", "تحكم النظام"]
] as const;

const outcomeOptions = [
  ["", "كل النتائج"],
  ["success", "ناجحة"],
  ["rejected", "مرفوضة"],
  ["failed", "فاشلة"]
] as const;

type ReportState =
  | { status: "loading" }
  | { status: "ready"; entries: ComplianceReportEntry[]; summary: ComplianceReportSummary }
  | { status: "error"; message: string };

function outcomeLabel(outcome: ComplianceReportEntry["outcome"]) {
  return ({ success: "ناجح", rejected: "مرفوض", failed: "فاشل" } as const)[outcome];
}

// V1-756: why a forecast is unavailable is more useful than a blank panel —
// each code maps to what the operator would actually do about it.
const FORECAST_REASON: Record<string, string> = {
  INSUFFICIENT_SAMPLES: "لا توجد قياسات كافية بعد. يلتقط النظام قياساً كل ساعة؛ عُد بعد بضع ساعات.",
  NO_TIME_SPAN: "كل القياسات من لحظة واحدة، فلا يمكن حساب معدل يومي.",
  SAMPLE_INVALID: "بعض القياسات تالفة. راجع سجل مهمة الالتقاط."
};

function formatStorageBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${Math.round((bytes / 1024 ** i) * 10) / 10} ${units[i]}`;
}

function formatForecastDate(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("ar-SA");
}

export default function ReportsPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [filters, setFilters] = useState<ComplianceReportFilters>({ limit: 100 });
  const [appliedFilters, setAppliedFilters] = useState<ComplianceReportFilters>({ limit: 100 });
  const [state, setState] = useState<ReportState>({ status: "loading" });
  const [isExporting, setIsExporting] = useState(false);
  const [storageSamples, setStorageSamples] = useState<StorageSample[] | null>(null);

  const loadReport = useCallback(async (nextFilters: ComplianceReportFilters) => {
    setState({ status: "loading" });
    const response = await api.complianceReport(nextFilters);
    if (!response.ok) {
      setState({ status: "error", message: response.error || "تعذر تحميل تقرير الامتثال." });
      return;
    }
    setState({ status: "ready", entries: response.entries, summary: response.summary });
  }, [api]);

  useEffect(() => {
    void loadReport(appliedFilters);
  }, [appliedFilters, loadReport]);

  // V1-756: the storage series is independent of the compliance filters, so it
  // loads once rather than refetching on every filter change.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await api.systemMetricsHistory({ days: 90 });
      if (cancelled) return;
      // A failed read leaves the series null, which the panel renders as
      // "unavailable" — never as an empty series, which would read as
      // "no growth" and is a different claim entirely.
      setStorageSamples(response.ok ? response.samples : null);
    })();
    return () => { cancelled = true; };
  }, [api]);

  const storageForecast = useMemo(() => {
    if (!storageSamples?.length) return null;
    const capacityBytes = storageSamples[storageSamples.length - 1]?.totalBytes;
    return forecastStorageGrowth(storageSamples, capacityBytes ? { capacityBytes } : {});
  }, [storageSamples]);

  const submitFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedFilters({ ...filters, limit: 100 });
  };

  const exportReport = async () => {
    setIsExporting(true);
    const response = await api.downloadComplianceReport(appliedFilters);
    setIsExporting(false);
    if (!response.ok) {
      setState({ status: "error", message: response.error || "تعذر تصدير التقرير." });
      return;
    }

    const href = URL.createObjectURL(response.blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = response.filename;
    link.click();
    URL.revokeObjectURL(href);
  };

  const entries = state.status === "ready" ? state.entries : [];
  const summary = state.status === "ready" ? state.summary : null;
  const exportPreview = buildExportPreview({ total: summary?.total ?? 0, format: "CSV", limit: 10000 });

  return (
    <AppShell subtitle="التقارير" navLabel="التقارير" contentClassName="observability-content">
      <PageToolbar
        icon={<FileBarChart size={24} />}
        eyebrow={<span className="badge">امتثال تشغيلي</span>}
        title="تقرير امتثال العمليات"
        description="دليل قابل للتصفية والتصدير للأحداث الموثقة في سجل التدقيق. لا يتضمن ملف التصدير payload أو عنوان IP أو معلومات العميل."
        meta={
          <>
            <span className="badge"><ShieldCheck size={14} aria-hidden="true" /> مدير النظام فقط</span>
            <span className="badge">{summary?.total ?? 0} حدث مطابق</span>
          </>
        }
        actions={
          <>
            <button type="button" className="button button-secondary" onClick={() => void loadReport(appliedFilters)} disabled={state.status === "loading"}>
              <RefreshCw size={16} aria-hidden="true" /> تحديث
            </button>
            <button type="button" className="button button-primary" onClick={() => void exportReport()} disabled={isExporting || entries.length === 0}>
              <Download size={16} aria-hidden="true" /> {isExporting ? "جار التصدير..." : "تصدير CSV"}
            </button>
          </>
        }
      />

      <section className="workspace-panel" aria-label="تنبؤ نمو التخزين">
        <div className="panel-title-row">
          <div>
            <h2>تنبؤ نمو التخزين</h2>
            <p>اتجاه مبني على قياسات آخر 90 يوماً، تُلتقط كل ساعة.</p>
          </div>
          {storageForecast?.ok ? (
            <span className={`badge badge-${storageForecast.confidence >= 0.7 ? "success" : "warning"}`}>
              ثقة {Math.round(storageForecast.confidence * 100)}%
            </span>
          ) : null}
        </div>

        {storageSamples === null ? (
          <p className="helper-text">تعذر تحميل قياسات التخزين.</p>
        ) : storageForecast?.ok ? (
          <>
            {/* Confidence is shown next to every number, never behind it: a
                trend fitted to noisy data must not read as a promise. */}
            {storageForecast.confidence < 0.5 ? (
              <p className="helper-text">
                <TriangleAlert size={14} aria-hidden="true" /> القياسات متذبذبة، فهذا الاتجاه تقريبي ولا يصلح للتخطيط.
              </p>
            ) : null}
            <dl className="report-summary-grid">
              <div>
                <dt>المستخدم حالياً</dt>
                <dd>{formatStorageBytes(storageForecast.currentBytes)}</dd>
              </div>
              <div>
                <dt>معدل النمو</dt>
                <dd>
                  {storageForecast.bytesPerDay > 0
                    ? `${formatStorageBytes(storageForecast.bytesPerDay)} / يوم`
                    : "مستقر أو متناقص"}
                </dd>
              </div>
              <div>
                <dt>المتوقع بعد 30 يوماً</dt>
                <dd>{formatStorageBytes(storageForecast.projectedBytes(30))}</dd>
              </div>
              <div>
                <dt>امتلاء السعة</dt>
                {/* No growth means no exhaustion date. Inventing one would be
                    a deadline the data does not support. */}
                <dd>
                  {storageForecast.daysUntilFull === null
                    ? "غير متوقع"
                    : `${Math.round(storageForecast.daysUntilFull)} يوماً (${formatForecastDate(storageForecast.exhaustionAt)})`}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="helper-text">
            {(storageForecast && !storageForecast.ok && FORECAST_REASON[storageForecast.code]) ||
              "لا توجد قياسات كافية بعد. يلتقط النظام قياساً كل ساعة."}
          </p>
        )}
      </section>

      <form className="report-filter-form panel panel-compact" onSubmit={submitFilters} aria-label="تخصيص تقرير الامتثال">
        <label>
          <span>من تاريخ</span>
          <input type="date" className="search-input" value={filters.from || ""} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value || undefined }))} />
        </label>
        <label>
          <span>إلى تاريخ</span>
          <input type="date" className="search-input" value={filters.to || ""} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value || undefined }))} />
        </label>
        <label>
          <span>الحدث</span>
          <select className="search-input" value={filters.event || ""} onChange={(event) => setFilters((current) => ({ ...current, event: event.target.value || undefined }))}>
            {eventOptions.map(([value, label]) => <option key={value || "all-events"} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>المورد</span>
          <select className="search-input" value={filters.resourceType || ""} onChange={(event) => setFilters((current) => ({ ...current, resourceType: event.target.value || undefined }))}>
            {resourceTypeOptions.map(([value, label]) => <option key={value || "all-resources"} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>النتيجة</span>
          <select className="search-input" value={filters.outcome || ""} onChange={(event) => setFilters((current) => ({ ...current, outcome: event.target.value as ComplianceReportFilters["outcome"] }))}>
            {outcomeOptions.map(([value, label]) => <option key={value || "all-outcomes"} value={value}>{label}</option>)}
          </select>
        </label>
        <button className="button button-primary" type="submit">تطبيق الفلاتر</button>
      </form>
      {state.status === "ready" ? <div className="state-banner" role="status"><strong>{exportPreview.summary}</strong><span className="helper-text">{exportPreview.detail} لا يشمل CSV payload أو عنوان IP أو معلومات العميل.</span></div> : null}

      {summary ? (
        <section className="report-summary-grid" aria-label="ملخص الامتثال">
          <article className="health-metric" data-tone="accent"><div className="health-metric__body"><span>إجمالي الأحداث</span><strong>{summary.total}</strong></div></article>
          <article className="health-metric" data-tone="success"><div className="health-metric__body"><span>ناجحة</span><strong>{summary.outcomes.success}</strong></div></article>
          <article className="health-metric" data-tone={summary.outcomes.rejected > 0 ? "warning" : undefined}><div className="health-metric__body"><span>مرفوضة</span><strong>{summary.outcomes.rejected}</strong></div></article>
          <article className="health-metric" data-tone={summary.outcomes.failed > 0 ? "danger" : undefined}><div className="health-metric__body"><span>فاشلة</span><strong>{summary.outcomes.failed}</strong></div></article>
        </section>
      ) : null}

      {state.status === "loading" ? <section className="state-banner" role="status" aria-live="polite"><strong>جار إعداد تقرير الامتثال</strong><p>يجري تجميع أحداث التدقيق بحسب الفلاتر المحددة.</p></section> : null}
      {state.status === "error" ? <section className="state-banner state-banner-error" role="alert"><TriangleAlert size={18} aria-hidden="true" /><div><strong>تعذر إعداد التقرير</strong><p>{redactAdminSecrets(state.message)}</p><button type="button" className="button button-secondary button-sm" onClick={() => void loadReport(appliedFilters)}>إعادة المحاولة</button></div></section> : null}
      {state.status === "ready" && entries.length === 0 ? <EmptyState title="لا توجد أحداث مطابقة" description="عدّل نطاق التاريخ أو الفلاتر، أو نفّذ عملية موثقة لتظهر ضمن الدليل." /> : null}

      {state.status === "ready" && entries.length > 0 ? (
        <section className="panel report-table-panel" aria-label="أحداث تقرير الامتثال">
          <div className="panel-title-row"><div><h2>أحداث الدليل</h2><p>يعرض حتى 100 حدث. يتضمن CSV كل النتائج المطابقة حتى 10,000 حدث.</p></div><span className="badge">{entries.length} معروض</span></div>
          <div className="ui-data-table-wrap" tabIndex={0}>
            <table className="data-table"><thead><tr><th>الحدث</th><th>المورد</th><th>المعرف</th><th>النتيجة</th><th>الرمز</th><th>التاريخ</th></tr></thead>
              <tbody>{entries.map((entry) => <tr key={entry.id}><td>{entry.event}</td><td>{entry.resourceType || "عام"}</td><td dir="ltr">{entry.resourceId || "—"}</td><td><span className={entry.outcome === "success" ? "badge" : "badge badge-danger"}>{outcomeLabel(entry.outcome)}</span></td><td>{entry.statusCode}</td><td>{formatDate(entry.createdAt || undefined)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
