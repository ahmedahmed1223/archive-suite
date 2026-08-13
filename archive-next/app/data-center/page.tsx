"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, Database, Gauge, HardDriveDownload, ServerCog, Settings, ShieldCheck, UploadCloud, Workflow } from "lucide-react";
import AppShell from "@/components/AppShell";
import MetricStrip from "@/components/MetricStrip";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type DrProbe, type SystemMetrics } from "@/lib/archive-api";
import { assessQueues, type QueueStatus } from "@/lib/queue-health";
import { useLocale } from "@/lib/i18n/LocaleProvider";

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

function formatDate(value: string | null, locale: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === "ar" ? "ar-SA" : "en-US");
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

function formatAge(seconds: number, locale: string): string {
  if (seconds <= 0) return "-";
  const value = seconds < 60 ? seconds : seconds < 3600 ? Math.floor(seconds / 60) : Math.floor(seconds / 3600);
  const unit = seconds < 60 ? "second" : seconds < 3600 ? "minute" : "hour";
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", { style: "unit", unit, unitDisplay: "short" }).format(value);
}

const HUB_LINKS = [
  { href: "/uploads", icon: UploadCloud }, { href: "/ingest", icon: Workflow }, { href: "/backup", icon: HardDriveDownload }, { href: "/status", icon: Gauge }, { href: "/settings", icon: Settings }, { href: "/system/control", icon: ServerCog }
] as const;

export default function DataCenterPage() {
  const { locale, t } = useLocale();
  const copy = t.pages.dataCenter;
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
        setSummary({ status: "error", message: response.error || copy.errorLoad });
        return;
      }
      setSummary({ status: "ready", metrics: response.metrics, dr: response.dr });
    } catch (error) {
      setSummary({ status: "error", message: error instanceof Error ? error.message : copy.unknown });
    }
  }, [copy.errorLoad, copy.unknown]);

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
    <AppShell subtitle={t.pageTitles.dataCenter} navLabel={t.pageTitles.dataCenter} contentClassName="observability-content" tipsPage="data-center">
      <PageToolbar
        icon={<Database size={24} />}
        eyebrow={<span className="badge">{copy.hub}</span>}
        title={copy.hub}
        description={copy.description}
        meta={
          <span className={summary.status === "ready" ? "badge badge-success" : "badge"}>
            {summary.status === "ready" ? copy.connected : summary.status === "loading" ? copy.checking : copy.review}
          </span>
        }
        actions={
          <button type="button" className="button button-secondary" onClick={() => void loadSummary()} disabled={summary.status === "loading"}>
            {copy.refresh}
          </button>
        }
      />

      {summary.status === "forbidden" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.forbidden}</strong><p>{copy.forbiddenDescription}</p>
        </div>
      ) : null}

      {summary.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.error}</strong>
          <p>{summary.message}</p>
        </div>
      ) : null}

      {summary.status === "ready" ? (
        <MetricStrip
          ariaLabel={copy.summary}
          items={[
            {
              label: copy.memory,
              value: `${memoryPercent}%`,
              description: `${formatBytes(summary.metrics.memory.usedBytes)} / ${formatBytes(summary.metrics.memory.totalBytes)}`,
              icon: <Gauge size={20} />,
              tone: memoryPercent > 85 ? "warning" : "success"
            },
            {
              label: copy.disk,
              value: `${diskPercent}%`,
              description: `${formatBytes(summary.metrics.disk.usedBytes)} / ${formatBytes(summary.metrics.disk.totalBytes)}`,
              icon: <Archive size={20} />,
              tone: diskPercent > 85 ? "warning" : "info"
            },
            {
              label: copy.queues,
              value: summary.metrics.queueDepth,
              description: `${copy.queueStatus[queueHealth.status]} — ${copy.activeQueues.replace("{count}", String(summary.metrics.queues.length))}`,
              icon: <Workflow size={20} />,
              tone: QUEUE_TONE[queueHealth.status]
            },
            {
              label: copy.backup,
              value: summary.dr.lastBackupName ? copy.available : copy.none,
              description: summary.dr.lastBackupName ? formatDate(summary.dr.lastBackupAt, locale) : copy.backupStart,
              icon: <ShieldCheck size={20} />,
              tone: summary.dr.lastBackupName ? "success" : "warning"
            }
          ]}
        />
      ) : null}

      {summary.status === "ready" && summary.metrics.queues.length > 0 ? (
        <section className="workspace-panel" aria-label={copy.queuesHealth}>
          <div className="panel-title-row">
            <div>
              <h2>{copy.queuesHealth}</h2>
              <p>{copy.queueDescription}</p>
            </div>
            <span className="badge">{copy.queueStatus[queueHealth.status]}</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{copy.queueColumns.name}</th><th scope="col">{copy.queueColumns.status}</th><th scope="col">{copy.queueColumns.pending}</th><th scope="col">{copy.queueColumns.failed}</th><th scope="col">{copy.queueColumns.oldest}</th>
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
                      <span className={`badge badge-${QUEUE_TONE[status]}`}>{copy.queueStatus[status]}</span>
                      {health?.reasons.length ? (
                        <span className="helper-text"> {health.reasons.map((reason) => copy.queueReason[reason as keyof typeof copy.queueReason] ?? reason).join(copy.queueSeparator)}</span>
                      ) : null}
                    </td>
                    <td>{queue.depth}</td>
                    <td>{queue.failed}</td>
                    <td>{formatAge(queue.oldestJobAgeSec, locale)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="workspace-panel data-center-hub" aria-label={copy.hub}>
        <div className="panel-title-row">
          <div>
            <h2>{copy.paths}</h2><p>{copy.pathsDescription}</p>
          </div>
          <span className="badge">{HUB_LINKS.length} {copy.pathsCount}</span>
        </div>
        <div className="data-center-link-grid">
          {HUB_LINKS.map((link, index) => (
            <a key={link.href} href={link.href} className="data-center-link-card">
              <span className="data-center-link-card__icon" aria-hidden="true">
                <link.icon size={20} />
              </span>
              <span className="badge">{copy.links[index].meta}</span>
              <strong>{copy.links[index].title}</strong>
              <p className="helper-text">{copy.links[index].description}</p>
            </a>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
