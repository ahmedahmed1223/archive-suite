"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileBarChart, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  createArchiveApiClient,
  type ComplianceReportEntry,
  type ComplianceReportFilters,
  type ComplianceReportSummary,
  type StorageSample
} from "@/lib/archive-api";
import { formatDate } from "@/lib/record-utils";
import { formatArabicDate } from "@/lib/arabic-format";
import { buildExportPreview, redactAdminSecrets } from "@/lib/admin-action-summary";
import { forecastStorageGrowth } from "@/lib/storage-forecast";
import "./reports.css";

type ReportState =
  | { status: "loading" }
  | { status: "ready"; entries: ComplianceReportEntry[]; summary: ComplianceReportSummary }
  | { status: "error"; message: string };

function formatStorageBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${Math.round((bytes / 1024 ** i) * 10) / 10} ${units[i]}`;
}

function formatForecastDate(iso: string | null): string {
  return formatArabicDate(iso, "-");
}

export default function ReportsPage() {
  const { t } = useLocale();
  const copy = t.pages.reports;
  const eventOptions = [
    ["", copy.eventOptions.all], ["records.bulk_upsert", copy.eventOptions.recordsBulkUpsert], ["rights.upsert", copy.eventOptions.rightsUpsert], ["media.workflow.queue", copy.eventOptions.mediaWorkflowQueue], ["relations.create", copy.eventOptions.relationsCreate], ["system_control.allowed", copy.eventOptions.systemControlAllowed], ["system_control.rejected", copy.eventOptions.systemControlRejected],
  ] as const;
  const resourceTypeOptions = [["", copy.resourceTypeOptions.all], ["record", copy.resourceTypeOptions.record], ["rights_record", copy.resourceTypeOptions.rightsRecord], ["media_job", copy.resourceTypeOptions.mediaJob], ["record_relation", copy.resourceTypeOptions.recordRelation], ["system_control_action", copy.resourceTypeOptions.systemControlAction]] as const;
  const outcomeOptions = [["", copy.outcomeOptions.all], ["success", copy.outcomeOptions.success], ["rejected", copy.outcomeOptions.rejected], ["failed", copy.outcomeOptions.failed]] as const;
  const forecastReasons: Record<string, string> = { INSUFFICIENT_SAMPLES: copy.forecast.insufficientSamples, NO_TIME_SPAN: copy.forecast.noTimeSpan, SAMPLE_INVALID: copy.forecast.sampleInvalid };
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
      setState({ status: "error", message: response.error || copy.errors.load });
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
      setState({ status: "error", message: response.error || copy.errors.export });
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
    <AppShell subtitle={t.pageTitles.reports} navLabel={t.pageTitles.reports} contentClassName="observability-content" tipsPage="reports">
      <PageToolbar
        icon={<FileBarChart size={24} />}
        eyebrow={<span className="badge">{copy.toolbar.eyebrow}</span>}
        title={copy.toolbar.title}
        description={copy.toolbar.description}
        meta={
          <>
            <span className="badge"><ShieldCheck size={14} aria-hidden="true" /> {copy.toolbar.adminOnly}</span>
            <span className="badge">{copy.toolbar.matchingEvents.replace("{count}", String(summary?.total ?? 0))}</span>
          </>
        }
        actions={
          <>
            <button type="button" className="button button-secondary" onClick={() => void loadReport(appliedFilters)} disabled={state.status === "loading"}>
              <RefreshCw size={16} aria-hidden="true" /> {copy.toolbar.refresh}
            </button>
            <button type="button" className="button button-primary" onClick={() => void exportReport()} disabled={isExporting || entries.length === 0}>
              <Download size={16} aria-hidden="true" /> {isExporting ? copy.toolbar.exporting : copy.toolbar.exportCsv}
            </button>
          </>
        }
      />

      <section className="workspace-panel" aria-label={copy.forecast.ariaLabel}>
        <div className="panel-title-row">
          <div>
            <h2>{copy.forecast.title}</h2>
            <p>{copy.forecast.description}</p>
          </div>
          {storageForecast?.ok ? (
            <span className={`badge badge-${storageForecast.confidence >= 0.7 ? "success" : "warning"}`}>
              {copy.forecast.confidence.replace("{percent}", String(Math.round(storageForecast.confidence * 100)))}
            </span>
          ) : null}
        </div>

        {storageSamples === null ? (
          <p className="helper-text">{copy.forecast.loadFailed}</p>
        ) : storageForecast?.ok ? (
          <>
            {/* Confidence is shown next to every number, never behind it: a
                trend fitted to noisy data must not read as a promise. */}
            {storageForecast.confidence < 0.5 ? (
              <p className="helper-text">
                <TriangleAlert size={14} aria-hidden="true" /> {copy.forecast.unstable}
              </p>
            ) : null}
            <dl className="report-summary-grid">
              <div>
                <dt>{copy.forecast.currentUsage}</dt>
                <dd>{formatStorageBytes(storageForecast.currentBytes)}</dd>
              </div>
              <div>
                <dt>{copy.forecast.growthRate}</dt>
                <dd>
                  {storageForecast.bytesPerDay > 0
                    ? copy.forecast.perDay.replace("{value}", formatStorageBytes(storageForecast.bytesPerDay))
                    : copy.forecast.stableOrDeclining}
                </dd>
              </div>
              <div>
                <dt>{copy.forecast.projected30Days}</dt>
                <dd>{formatStorageBytes(storageForecast.projectedBytes(30))}</dd>
              </div>
              <div>
                <dt>{copy.forecast.capacityExhaustion}</dt>
                {/* No growth means no exhaustion date. Inventing one would be
                    a deadline the data does not support. */}
                <dd>
                  {storageForecast.daysUntilFull === null
                    ? copy.forecast.notExpected
                    : copy.forecast.daysWithDate.replace("{days}", String(Math.round(storageForecast.daysUntilFull))).replace("{date}", formatForecastDate(storageForecast.exhaustionAt))}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="helper-text">
            {(storageForecast && !storageForecast.ok && forecastReasons[storageForecast.code]) || copy.forecast.fallback}
          </p>
        )}
      </section>

      <form className="report-filter-form panel panel-compact" onSubmit={submitFilters} aria-label={copy.filters.ariaLabel}>
        <label>
          <span>{copy.filters.from}</span>
          <input type="date" className="search-input" value={filters.from || ""} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value || undefined }))} />
        </label>
        <label>
          <span>{copy.filters.to}</span>
          <input type="date" className="search-input" value={filters.to || ""} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value || undefined }))} />
        </label>
        <label>
          <span>{copy.filters.event}</span>
          <select className="search-input" value={filters.event || ""} onChange={(event) => setFilters((current) => ({ ...current, event: event.target.value || undefined }))}>
            {eventOptions.map(([value, label]) => <option key={value || "all-events"} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>{copy.filters.resource}</span>
          <select className="search-input" value={filters.resourceType || ""} onChange={(event) => setFilters((current) => ({ ...current, resourceType: event.target.value || undefined }))}>
            {resourceTypeOptions.map(([value, label]) => <option key={value || "all-resources"} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>{copy.filters.outcome}</span>
          <select className="search-input" value={filters.outcome || ""} onChange={(event) => setFilters((current) => ({ ...current, outcome: event.target.value as ComplianceReportFilters["outcome"] }))}>
            {outcomeOptions.map(([value, label]) => <option key={value || "all-outcomes"} value={value}>{label}</option>)}
          </select>
        </label>
        <button className="button button-primary" type="submit">{copy.filters.apply}</button>
      </form>
      {state.status === "ready" ? <div className="state-banner" role="status"><strong>{exportPreview.summary}</strong><span className="helper-text">{exportPreview.detail} {copy.exportNotice}</span></div> : null}

      {summary ? (
        <section className="report-summary-grid" aria-label={copy.summary.ariaLabel}>
          <article className="health-metric" data-tone="accent"><div className="health-metric__body"><span>{copy.summary.total}</span><strong>{summary.total}</strong></div></article>
          <article className="health-metric" data-tone="success"><div className="health-metric__body"><span>{copy.summary.success}</span><strong>{summary.outcomes.success}</strong></div></article>
          <article className="health-metric" data-tone={summary.outcomes.rejected > 0 ? "warning" : undefined}><div className="health-metric__body"><span>{copy.summary.rejected}</span><strong>{summary.outcomes.rejected}</strong></div></article>
          <article className="health-metric" data-tone={summary.outcomes.failed > 0 ? "danger" : undefined}><div className="health-metric__body"><span>{copy.summary.failed}</span><strong>{summary.outcomes.failed}</strong></div></article>
        </section>
      ) : null}

      {state.status === "loading" ? <section className="state-banner" role="status" aria-live="polite"><strong>{copy.loading.title}</strong><p>{copy.loading.description}</p></section> : null}
      {state.status === "error" ? <section className="state-banner state-banner-error" role="alert"><TriangleAlert size={18} aria-hidden="true" /><div><strong>{copy.error.title}</strong><p>{redactAdminSecrets(state.message)}</p><button type="button" className="button button-secondary button-sm" onClick={() => void loadReport(appliedFilters)}>{copy.error.retry}</button></div></section> : null}
      {state.status === "ready" && entries.length === 0 ? <EmptyState title={copy.empty.title} description={copy.empty.description} /> : null}

      {state.status === "ready" && entries.length > 0 ? (
        <section className="panel report-table-panel" aria-label={copy.table.ariaLabel}>
          <div className="panel-title-row"><div><h2>{copy.table.title}</h2><p>{copy.table.description}</p></div><span className="badge">{copy.table.displayed.replace("{count}", String(entries.length))}</span></div>
          <div className="ui-data-table-wrap" tabIndex={0}>
            <table className="data-table"><thead><tr><th>{copy.table.event}</th><th>{copy.table.resource}</th><th>{copy.table.identifier}</th><th>{copy.table.outcome}</th><th>{copy.table.code}</th><th>{copy.table.date}</th></tr></thead>
              <tbody>{entries.map((entry) => <tr key={entry.id}><td>{entry.event}</td><td>{entry.resourceType || copy.table.general}</td><td dir="ltr">{entry.resourceId || "—"}</td><td><span className={entry.outcome === "success" ? "badge" : "badge badge-danger"}>{copy.outcomeLabels[entry.outcome]}</span></td><td>{entry.statusCode}</td><td>{formatDate(entry.createdAt || undefined)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
