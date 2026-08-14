"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bug, Clock3, Filter, Info, Repeat2, Sparkles, Trash2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/EmptyState";
import MetricStrip from "@/components/MetricStrip";
import PageToolbar from "@/components/PageToolbar";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  clearClientErrors,
  listClientErrors,
  recordClientError,
  type ClientErrorLogEntry,
  type ClientErrorSeverity
} from "@/lib/client-error-log";
import { groupActionErrors, redactAdminSecrets } from "@/lib/admin-action-summary";
import { getErrorWave } from "@/lib/error-rate-alert";

function loadErrors() {
  return listClientErrors();
}

function severityClass(severity: ClientErrorSeverity) {
  if (severity === "error") return "badge-danger";
  if (severity === "warning") return "badge-warning";
  return "badge-info";
}

export default function ErrorsPage() {
  const { locale, t } = useLocale();
  const copy = t.pages.errors;
  const dialogs = useConfirmDialog();
  const [errors, setErrors] = useState<ClientErrorLogEntry[]>([]);
  const [severityFilter, setSeverityFilter] = useState<ClientErrorSeverity | "">("");

  useEffect(() => {
    const refresh = () => setErrors(loadErrors());
    refresh();

    window.addEventListener("archive-next:error-log-updated", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("archive-next:error-log-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const filteredErrors = useMemo(
    () => errors.filter((entry) => !severityFilter || entry.severity === severityFilter),
    [errors, severityFilter]
  );
  const errorColumns = useMemo<Array<ColumnDef<ClientErrorLogEntry, unknown>>>(
    () => [
      {
        accessorKey: "severity",
        header: copy.table.severity,
        cell: ({ row }) => (
          <span className={`badge ${severityClass(row.original.severity)}`}>
            {copy.severity[row.original.severity]}
          </span>
        )
      },
      {
        accessorKey: "name",
        header: copy.table.event,
        cell: ({ row }) => (
          <div className="stack stack-tight">
            <strong>{row.original.name}</strong>
            <span className="helper-text">{redactAdminSecrets(row.original.message)}</span>
          </div>
        )
      },
      {
        accessorKey: "page",
        header: copy.table.page,
        cell: ({ row }) => <span className="wrap-anywhere">{row.original.page}</span>
      },
      {
        accessorKey: "source",
        header: copy.table.source
      },
      {
        accessorKey: "count",
        header: copy.table.occurrences
      },
      {
        accessorKey: "lastSeenAt",
        header: copy.table.lastSeen,
        cell: ({ row }) => <time>{new Date(row.original.lastSeenAt).toLocaleString(locale === "en" ? "en-US" : "ar-SA")}</time>
      }
    ],
    [copy, locale]
  );

  const counts = useMemo(
    () =>
      errors.reduce(
        (acc, entry) => {
          acc[entry.severity] += 1;
          acc.repeated += Math.max(0, entry.count - 1);
          return acc;
        },
        { error: 0, warning: 0, info: 0, repeated: 0 } as Record<ClientErrorSeverity, number> & { repeated: number }
      ),
    [errors]
  );
  const latestError = useMemo(
    () => filteredErrors.reduce<ClientErrorLogEntry | null>((latest, entry) => {
      if (!latest) return entry;
      return new Date(entry.lastSeenAt).getTime() > new Date(latest.lastSeenAt).getTime() ? entry : latest;
    }, null),
    [filteredErrors]
  );
  const groupedErrors = useMemo(() => groupActionErrors(filteredErrors, locale), [filteredErrors, locale]);
  const errorWave = useMemo(() => getErrorWave(errors), [errors]);

  const createManualError = () => {
    recordClientError({
      name: "ManualCheck",
      message: copy.manualLog.message,
      page: "/errors",
      source: "manual",
      severity: "info"
    });
  };

  const clearAll = async () => {
    if (
      errors.length > 0 &&
      !(await dialogs.confirm({
        title: copy.clearDialog.title,
        message: copy.clearDialog.message,
        confirmLabel: copy.clearDialog.confirm,
        destructive: true
      }))
    ) {
      return;
    }

    clearClientErrors();
  };

  return (
    <AppShell subtitle={t.pageTitles.errorLog} navLabel={t.pageTitles.errorLog} contentClassName="observability-content" tipsPage="errors">
      <PageToolbar
        icon={<Bug size={24} />}
        eyebrow={<span className="badge">{copy.toolbar.eyebrow}</span>}
        title={copy.toolbar.title}
        description={copy.toolbar.description}
        meta={
          <>
            <span className="badge">{copy.toolbar.uniqueCount.replace("{count}", String(errors.length))}</span>
            <span className="badge">{copy.toolbar.repeatedCount.replace("{count}", String(counts.repeated))}</span>
            <span className="badge badge-danger">{copy.toolbar.criticalCount.replace("{count}", String(counts.error))}</span>
          </>
        }
        actions={
          <>
            <button className="button button-secondary" type="button" onClick={createManualError}>
              <Sparkles size={16} aria-hidden="true" />
              {copy.toolbar.testLogging}
            </button>
            <button className="button button-danger" type="button" onClick={clearAll} disabled={errors.length === 0}>
              <Trash2 size={16} aria-hidden="true" />
              {copy.toolbar.clearLog}
            </button>
          </>
        }
      >
        <div className="archive-toolbar-row">
          <label className="toolbar-field">
            <span>{copy.filter.severity}</span>
            <select
              className="search-input input-narrow"
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value as ClientErrorSeverity | "")}
            >
              <option value="">{copy.filter.all}</option>
              <option value="error">{copy.filter.errors}</option>
              <option value="warning">{copy.filter.warnings}</option>
              <option value="info">{copy.filter.information}</option>
            </select>
          </label>
        </div>
      </PageToolbar>

      <MetricStrip
        ariaLabel={copy.metrics.ariaLabel}
        items={[
          {
            label: copy.metrics.criticalErrors,
            value: counts.error,
            description: copy.metrics.immediateAction,
            icon: <AlertTriangle size={20} />,
            tone: counts.error > 0 ? "danger" : "default"
          },
          {
            label: copy.metrics.warnings,
            value: counts.warning,
            description: copy.metrics.incompleteBehavior,
            icon: <Filter size={20} />,
            tone: counts.warning > 0 ? "warning" : "default"
          },
          {
            label: copy.metrics.information,
            value: counts.info,
            description: copy.metrics.diagnosticEvents,
            icon: <Info size={20} />,
            tone: "info"
          },
          {
            label: copy.metrics.repetitions,
            value: counts.repeated,
            description: latestError ? copy.metrics.lastSeen.replace("{date}", new Date(latestError.lastSeenAt).toLocaleString(locale === "en" ? "en-US" : "ar-SA")) : copy.metrics.noEvents,
            icon: <Repeat2 size={20} />,
            tone: counts.repeated > 0 ? "warning" : "success"
          }
        ]}
      />
      {errorWave.active ? (
        <section className="state-banner state-banner-error" role="alert" aria-live="assertive">
          <AlertTriangle aria-hidden="true" size={20} />
          <div>
            <strong>{copy.wave.title}</strong>
            <p className="helper-text">
              {copy.wave.description.replace("{count}", String(errorWave.count)).replace("{minutes}", String(errorWave.windowMinutes))}
            </p>
          </div>
        </section>
      ) : null}
      {groupedErrors.length ? <section className="panel panel-compact" aria-label={copy.recovery.ariaLabel}><div className="panel-title-row"><div><h2>{copy.recovery.title}</h2><p>{copy.recovery.description}</p></div></div><div className="analytics-chip-list">{groupedErrors.map((group) => <span className="badge" key={group.key}>{copy.recovery.group.replace("{label}", group.label).replace("{count}", String(group.count)).replace("{recovery}", group.recovery)}</span>)}</div></section> : null}

      {filteredErrors.length === 0 ? (
        <EmptyState
          icon={<Clock3 size={22} />}
          title={copy.empty.title}
          description={copy.empty.description}
        />
      ) : (
        <section className="workspace-panel error-log-table" aria-label={copy.table.ariaLabel}>
          <DataTable
            columns={errorColumns}
            data={filteredErrors}
            emptyMessage={copy.table.emptyMessage}
            getRowId={(entry) => entry.id}
            virtualized={filteredErrors.length > 40}
          />
          {filteredErrors.some((entry) => entry.stack) ? (
            <details className="section-divider">
              <summary className="field-note">{copy.table.stackDetails}</summary>
              <div className="stack mt-tight">
                {filteredErrors.filter((entry) => entry.stack).map((entry) => (
                  <article className="error-log-card" key={entry.id} data-severity={entry.severity}>
                    <strong>{entry.name}</strong>
                    <pre className="token-preview">{entry.stack}</pre>
                  </article>
                ))}
              </div>
            </details>
          ) : null}
        </section>
      )}
    </AppShell>
  );
}
