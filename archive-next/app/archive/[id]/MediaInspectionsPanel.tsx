"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleAlert, FileSearch2, Loader2, RefreshCw } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { createArchiveApiClient, type ArchiveRecord, type MediaInspection } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type State =
  | { status: "loading" }
  | { status: "ready"; inspections: MediaInspection[] }
  | { status: "error"; message: string };

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

export default function MediaInspectionsPanel({ record }: Readonly<{ record: ArchiveRecord }>) {
  const { locale, t } = useLocale();
  const copy = t.pages.mediaInspections;
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    const response = await api.mediaInspections(record.id, { store: record.store });
    if (!response.ok) {
      setState({ status: "error", message: response.error });
      return;
    }
    setState({ status: "ready", inspections: response.inspections });
  }, [api, record.id, record.store]);

  useEffect(() => {
    void load();
  }, [load]);

  const latest = state.status === "ready" ? state.inspections[0] : null;

  return (
    <article className="panel media-inspections" aria-labelledby="media-inspections-title">
      <div className="panel-section-header panel-title-row">
        <div>
          <h2 id="media-inspections-title">{copy.title}</h2>
          <p className="helper-text">{copy.description}</p>
        </div>
        {latest ? (
          <span className={`badge ${latest.isCurrentVersion ? "badge-success" : "badge-warning"}`}>
            {latest.isCurrentVersion ? copy.currentVersion : copy.historicVersion}
          </span>
        ) : null}
      </div>

      {state.status === "loading" ? (
        <p className="form-status" role="status" aria-live="polite" aria-busy="true">
          <Loader2 className="status-refresh-icon is-spinning" size={16} aria-hidden="true" />
          {copy.loadingText}
        </p>
      ) : null}

      {state.status === "error" ? (
        <div className="form-status status-error" role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          <span>{copy.loadErrorPrefix.replace("{message}", state.message)}</span>
          <button type="button" className="button button-secondary button-sm" onClick={() => void load()}>
            <RefreshCw size={15} aria-hidden="true" />
            {copy.retryButton}
          </button>
        </div>
      ) : null}

      {state.status === "ready" && !latest ? (
        <EmptyState icon={<FileSearch2 size={22} />} title={copy.emptyTitle} description={copy.emptyDescription} />
      ) : null}

      {latest ? (
        <div className="media-inspections__content">
          <div className="media-inspections__summary">
            <FileSearch2 size={20} aria-hidden="true" />
            <div>
              <strong>{latest.report.formatLongName ?? (latest.report.formatNames.join(", ") || copy.unknownFormat)}</strong>
              <p>{copy.completedAt.replace("{date}", latest.completedAt ? new Date(latest.completedAt).toLocaleString(locale === "ar" ? "ar-SA" : "en-US") : copy.unknownDate)}</p>
            </div>
          </div>
          <dl className="media-inspections__facts">
            <div><dt>{copy.durationLabel}</dt><dd>{latest.report.durationSeconds === null ? "—" : `${formatNumber(latest.report.durationSeconds, locale, 2)} ${copy.secondsUnit}`}</dd></div>
            <div><dt>{copy.sizeLabel}</dt><dd>{formatBytes(latest.report.sizeBytes, locale)}</dd></div>
            <div><dt>{copy.bitRateLabel}</dt><dd>{latest.report.bitRate === null ? "—" : `${formatNumber(latest.report.bitRate / 1_000_000, locale, 2)} ${copy.megabitsUnit}`}</dd></div>
            <div><dt>{copy.streamsLabel}</dt><dd>{formatNumber(latest.report.streams.length, locale)}</dd></div>
          </dl>
          <p className="field-note">{copy.versionNote.replace("{token}", latest.versionToken)}</p>
        </div>
      ) : null}
    </article>
  );
}
