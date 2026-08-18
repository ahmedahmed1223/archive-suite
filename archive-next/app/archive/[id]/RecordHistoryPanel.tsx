"use client";

import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { AppDictionary } from "@/lib/i18n/dictionaries";
import type { RecordHistoryEntry } from "@/lib/archive-api";

function historyEventLabel(entry: RecordHistoryEntry, t: AppDictionary) {
  const eventLabels = t.pages.archiveDetail.history.eventLabels;
  const labels: Record<string, string> = {
    "record_notes.create": eventLabels.recordNoteCreate,
    "record_notes.update": eventLabels.recordNoteUpdate,
    "record_notes.delete": eventLabels.recordNoteDelete,
    "record_comments.create": eventLabels.recordCommentCreate,
    "record_comments.delete": eventLabels.recordCommentDelete,
    "relations.create": eventLabels.relationCreate,
    "relations.delete": eventLabels.relationDelete,
    "rights.upsert": eventLabels.rightsUpsert
  };

  return labels[entry.event] || entry.event;
}

function metadataObject(entry: RecordHistoryEntry) {
  return entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata)
    ? entry.metadata
    : null;
}

function auditDiffFields(entry: RecordHistoryEntry) {
  const metadata = metadataObject(entry);
  const diff = metadata?.["diff"];
  if (!diff || typeof diff !== "object" || Array.isArray(diff)) return [];
  const fields = (diff as Record<string, unknown>)["fields"];
  return Array.isArray(fields) ? fields.filter((field): field is string => typeof field === "string") : [];
}

type AuditComparison = Readonly<{
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}>;

function nonEmptyObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length
    ? value as Record<string, unknown>
    : null;
}

function auditComparison(entry: RecordHistoryEntry): AuditComparison | null {
  const metadata = metadataObject(entry);
  const diff = nonEmptyObject(metadata?.["diff"]);
  const before = nonEmptyObject(diff?.["before"]);
  const after = nonEmptyObject(diff?.["after"]);

  return before && after ? { before, after } : null;
}

function auditValue(value: unknown): string {
  if (value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  if (typeof value === "number" || typeof value === "boolean" || value === null) return String(value);

  try {
    return JSON.stringify(value) ?? "—";
  } catch {
    return "—";
  }
}

function auditRequestPayload(entry: RecordHistoryEntry) {
  const metadata = metadataObject(entry);
  const request = metadata?.["request"];
  return request && typeof request === "object" ? request : null;
}

function auditRestoreDecision(entry: RecordHistoryEntry, t: AppDictionary) {
  const metadata = metadataObject(entry);
  const decision = metadata?.["restoreDecision"];
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) return null;

  const value = decision as Record<string, unknown>;
  return {
    available: value["available"] === true,
    label: typeof value["label"] === "string" ? value["label"] : t.pages.archiveDetail.history.restoreDecisionDefaultLabel,
    reason: typeof value["reason"] === "string" ? value["reason"] : ""
  };
}

export function RecordHistoryPanel({
  entries,
  loading,
  error
}: Readonly<{
  entries: RecordHistoryEntry[];
  loading: boolean;
  error: string | null;
}>) {
  const { t, locale } = useLocale();
  const copy = t.pages.archiveDetail.history;
  return (
    <article className="panel record-history-panel">
      <div className="panel-section-header panel-title-row">
        <div>
          <h2>{copy.title}</h2>
          <p className="helper-text">{copy.description}</p>
        </div>
        <span className="badge">{entries.length} {copy.countLabel}</span>
      </div>

      {loading ? (
        <Skeleton label={copy.loadingLabel} />
      ) : null}

      {error ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.loadErrorTitle}</strong>
          <span className="helper-text">{error}</span>
        </div>
      ) : null}

      {!loading && entries.length ? (
        <ul className="record-history-list">
          {entries.map((entry) => {
            const fields = auditDiffFields(entry);
            const comparison = auditComparison(entry);
            const payload = auditRequestPayload(entry);
            const decision = auditRestoreDecision(entry, t);
            const comparisonFields = comparison
              ? [...new Set([...Object.keys(comparison.before), ...Object.keys(comparison.after)])]
              : [];

            return (
              <li key={entry.id}>
                <div>
                  <div className="helper-row">
                    <span className="badge">{historyEventLabel(entry, t)}</span>
                    <span className={`badge ${entry.outcome === "success" ? "badge-success" : "badge-error"}`}>
                      {entry.outcome}
                    </span>
                  </div>
                  {entry.createdAt ? (
                    <small className="helper-text">{new Date(entry.createdAt).toLocaleString(locale === "en" ? "en-US" : "ar-SA")}</small>
                  ) : null}
                </div>

                {decision ? (
                  <div className="audit-decision" data-available={decision.available ? "true" : "false"}>
                    <strong>{decision.label}</strong>
                    {decision.reason ? <p>{decision.reason}</p> : null}
                  </div>
                ) : null}

                {fields.length ? (
                  <div className="audit-diff">
                    <strong>{copy.diffFieldsLabel}</strong>
                    <div className="tags">
                      {fields.slice(0, 12).map((field) => (
                        <span key={field} className="tag">{field}</span>
                      ))}
                      {fields.length > 12 ? <span className="tag">+{fields.length - 12}</span> : null}
                    </div>
                  </div>
                ) : null}

                {comparison ? (
                  <div className="audit-diff">
                    <strong>{copy.comparisonLabel}</strong>
                    <table aria-label={copy.comparisonTableAriaLabel}>
                      <thead>
                        <tr>
                          <th scope="col">{copy.fieldColumn}</th>
                          <th scope="col">{copy.beforeColumn}</th>
                          <th scope="col">{copy.afterColumn}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonFields.map((field) => (
                          <tr key={field}>
                            <th scope="row">{field}</th>
                            <td>{auditValue(comparison.before[field])}</td>
                            <td>{auditValue(comparison.after[field])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {payload ? (
                  <details className="audit-payload">
                    <summary>{copy.payloadSummary}</summary>
                    <pre dir="ltr">{JSON.stringify(payload, null, 2)}</pre>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : !loading ? (
        <EmptyState
          title={copy.emptyTitle}
          description={copy.emptyDescription}
        />
      ) : null}
    </article>
  );
}
