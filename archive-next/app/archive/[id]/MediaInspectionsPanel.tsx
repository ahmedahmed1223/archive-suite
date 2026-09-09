"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { CircleAlert, FileSearch2, Loader2, RefreshCw } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { createArchiveApiClient, type ArchiveRecord, type MediaInspection, type MediaProbeReport, type MediaQcReport } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useAuthSession } from "@/lib/auth-session";

type State = { status: "loading" } | { status: "ready"; inspections: MediaInspection[] } | { status: "error"; message: string };

function formatNumber(value: number | null, locale: "ar" | "en", maximumFractionDigits = 0): string {
  if (value === null) return "—";
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", { maximumFractionDigits }).format(value);
}

function formatBytes(value: number | null, locale: "ar" | "en"): string {
  if (value === null) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unit = Math.min(Math.floor(Math.log(Math.max(value, 1)) / Math.log(1024)), units.length - 1);
  return `${formatNumber(value / 1024 ** unit, locale, unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function isProbeReport(report: MediaInspection["report"]): report is MediaProbeReport { return "formatNames" in report; }
function isQcReport(report: MediaInspection["report"]): report is MediaQcReport { return "findings" in report; }

export default function MediaInspectionsPanel({ record }: Readonly<{ record: ArchiveRecord }>) {
  const { locale, t } = useLocale();
  const copy = t.pages.mediaInspections;
  const { user } = useAuthSession();
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<State>({ status: "loading" });
  const [isOverrideFormOpen, setOverrideFormOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideState, setOverrideState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [overrideError, setOverrideError] = useState("");

  const load = useCallback(async () => {
    setState({ status: "loading" });
    const response = await api.mediaInspections(record.id, { store: record.store });
    if (!response.ok) return setState({ status: "error", message: response.error });
    setState({ status: "ready", inspections: response.inspections });
  }, [api, record.id, record.store]);

  useEffect(() => { void load(); }, [load]);

  const probe = state.status === "ready" ? state.inspections.find((inspection) => inspection.inspectionType === "probe" && isProbeReport(inspection.report)) : undefined;
  const qc = state.status === "ready" ? state.inspections.find((inspection) => inspection.inspectionType === "qc" && isQcReport(inspection.report)) : undefined;
  const probeReport = probe && isProbeReport(probe.report) ? probe.report : null;
  const qcReport = qc && isQcReport(qc.report) ? qc.report : null;
  const latest = probe ?? qc;
  const qcStatusLabel = qc?.qcOverride ? copy.qcWaived : qc?.status === "passed" ? copy.qcPassed : qc?.status === "warning" ? copy.qcWarning : qc?.status === "waived" ? copy.qcWaived : copy.qcFailed;
  const qcStatusClass = qc?.qcOverride ? "badge-success" : qc?.status === "passed" ? "badge-success" : qc?.status === "warning" ? "badge-warning" : qc?.status === "waived" ? "badge" : "badge-error";
  const qcRuleLabel = (rule: string) => rule in copy.qcRules ? copy.qcRules[rule as keyof typeof copy.qcRules] : rule;
  const canOverrideQc = user?.role === "admin" && qc?.status === "failed" && qc.isCurrentVersion && !qc.qcOverride;

  async function submitOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!qc || overrideReason.trim().length < 3) return;
    setOverrideState("submitting");
    setOverrideError("");
    const response = await api.overrideMediaQc(qc.id, { reason: overrideReason.trim() });
    if (!response.ok) {
      setOverrideState("error");
      setOverrideError(response.error || copy.qcOverrideError);
      return;
    }
    setOverrideState("success");
    setOverrideFormOpen(false);
    setOverrideReason("");
    await load();
  }

  return (
    <article className="panel media-inspections" aria-labelledby="media-inspections-title">
      <div className="panel-section-header panel-title-row">
        <div><h2 id="media-inspections-title">{copy.title}</h2><p className="helper-text">{copy.description}</p></div>
        {latest ? <span className={`badge ${latest.isCurrentVersion ? "badge-success" : "badge-warning"}`}>{latest.isCurrentVersion ? copy.currentVersion : copy.historicVersion}</span> : null}
      </div>
      {state.status === "loading" ? <p className="form-status" role="status" aria-live="polite" aria-busy="true"><Loader2 className="status-refresh-icon is-spinning" size={16} aria-hidden="true" />{copy.loadingText}</p> : null}
      {state.status === "error" ? <div className="form-status status-error" role="alert"><CircleAlert size={16} aria-hidden="true" /><span>{copy.loadErrorPrefix.replace("{message}", state.message)}</span><button type="button" className="button button-secondary button-sm" onClick={() => void load()}><RefreshCw size={15} aria-hidden="true" />{copy.retryButton}</button></div> : null}
      {state.status === "ready" && !latest ? <EmptyState icon={<FileSearch2 size={22} />} title={copy.emptyTitle} description={copy.emptyDescription} /> : null}
      {probe && probeReport ? (
        <div className="media-inspections__content">
          <div className="media-inspections__summary"><FileSearch2 size={20} aria-hidden="true" /><div><strong>{probeReport.formatLongName ?? (probeReport.formatNames.join(", ") || copy.unknownFormat)}</strong><p>{copy.completedAt.replace("{date}", probe.completedAt ? new Date(probe.completedAt).toLocaleString(locale === "ar" ? "ar-SA" : "en-US") : copy.unknownDate)}</p></div></div>
          <dl className="media-inspections__facts">
            <div><dt>{copy.durationLabel}</dt><dd>{probeReport.durationSeconds === null ? "—" : `${formatNumber(probeReport.durationSeconds, locale, 2)} ${copy.secondsUnit}`}</dd></div>
            <div><dt>{copy.sizeLabel}</dt><dd>{formatBytes(probeReport.sizeBytes, locale)}</dd></div>
            <div><dt>{copy.bitRateLabel}</dt><dd>{probeReport.bitRate === null ? "—" : `${formatNumber(probeReport.bitRate / 1_000_000, locale, 2)} ${copy.megabitsUnit}`}</dd></div>
            <div><dt>{copy.streamsLabel}</dt><dd>{formatNumber(probeReport.streams.length, locale)}</dd></div>
          </dl>
          <p className="field-note">{copy.versionNote.replace("{token}", probe.versionToken)}</p>
        </div>
      ) : null}
      {qc && qcReport ? (
        <section className="media-inspections__qc" aria-labelledby="media-qc-title">
          <div className="panel-title-row"><div><h3 id="media-qc-title">{copy.qcTitle}</h3><p className="helper-text">{copy.qcDescription}</p></div><span className={`badge ${qcStatusClass}`}>{qcStatusLabel}</span></div>
          <ul className="media-inspections__findings">{qcReport.findings.map((finding, index) => <li key={`${finding.rule}-${finding.startSeconds}-${index}`} data-status={finding.status}><strong>{qcRuleLabel(finding.rule)}</strong><span className="badge">{finding.status === "passed" ? copy.qcPassed : finding.status === "warning" ? copy.qcWarning : finding.status === "waived" ? copy.qcWaived : copy.qcFailed}</span><p>{finding.evidence}</p></li>)}</ul>
          <p className="field-note">{copy.versionNote.replace("{token}", qc.versionToken)}</p>
          {qc.qcOverride ? <p className="field-note">{copy.qcOverrideNote}</p> : null}
          {canOverrideQc && !isOverrideFormOpen ? <button type="button" className="button button-secondary button-sm" onClick={() => { setOverrideFormOpen(true); setOverrideState("idle"); setOverrideError(""); }}>{copy.qcOverrideAction}</button> : null}
          {canOverrideQc && isOverrideFormOpen ? (
            <form className="media-inspections__override" onSubmit={(event) => void submitOverride(event)}>
              <label htmlFor={`qc-override-reason-${qc.id}`}>{copy.qcOverrideReasonLabel}</label>
              <textarea id={`qc-override-reason-${qc.id}`} value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} minLength={3} maxLength={2000} required rows={3} aria-describedby={`qc-override-guidance-${qc.id}`} />
              <p id={`qc-override-guidance-${qc.id}`} className="field-note">{copy.qcOverrideGuidance}</p>
              <div className="button-row"><button type="submit" className="button button-primary button-sm" disabled={overrideState === "submitting" || overrideReason.trim().length < 3}>{overrideState === "submitting" ? copy.qcOverrideSubmitting : copy.qcOverrideConfirm}</button><button type="button" className="button button-secondary button-sm" disabled={overrideState === "submitting"} onClick={() => setOverrideFormOpen(false)}>{copy.cancelButton}</button></div>
              {overrideState === "error" ? <p className="form-status status-error" role="alert">{overrideError}</p> : null}
            </form>
          ) : null}
          {overrideState === "success" ? <p className="form-status status-success" role="status">{copy.qcOverrideSuccess}</p> : null}
        </section>
      ) : null}
    </article>
  );
}
