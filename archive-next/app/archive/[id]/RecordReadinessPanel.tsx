"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import { getDictionary, type AppDictionary } from "@/lib/i18n/dictionaries";
import { deriveRecordSourcePath, type ArchiveRecord, type RightsRecord } from "@/lib/archive-api";
import { deriveRecordStatus } from "@/lib/record-status";

// V1-824: derived-only readiness signal (file/title/description/tags/rights/
// review), no new API and no gate on save - "review" is approximated as "the
// team has left at least one comment", since there's no dedicated review-
// status field on the record.
interface ReadinessItem {
  key: string;
  label: string;
  done: boolean;
  hint: string;
}

export function buildReadinessItems(
  record: ArchiveRecord,
  rights: RightsRecord | null,
  hasTeamComments: boolean,
  t: AppDictionary = getDictionary("ar")
): ReadinessItem[] {
  const items = t.pages.archiveDetail.readiness.items;
  return [
    {
      key: "file",
      label: items.file.label,
      done: Boolean(deriveRecordSourcePath(record)),
      hint: items.file.hint
    },
    {
      key: "title",
      label: items.title.label,
      done: Boolean(record.title?.trim()),
      hint: items.title.hint
    },
    {
      key: "description",
      label: items.description.label,
      done: Boolean(record.description?.trim()),
      hint: items.description.hint
    },
    {
      key: "tags",
      label: items.tags.label,
      done: (record.tags?.length ?? 0) > 0,
      hint: items.tags.hint
    },
    {
      key: "rights",
      label: items.rights.label,
      done: rights !== null,
      hint: items.rights.hint
    },
    {
      key: "review",
      label: items.review.label,
      done: hasTeamComments,
      hint: items.review.hint
    }
  ];
}

export function RecordReadinessPanel({
  record,
  rights,
  hasTeamComments
}: Readonly<{ record: ArchiveRecord; rights: RightsRecord | null; hasTeamComments: boolean }>) {
  const { t, locale } = useLocale();
  const copy = t.pages.archiveDetail.readiness;
  const items = buildReadinessItems(record, rights, hasTeamComments, t);
  const status = deriveRecordStatus(record, locale);
  const doneCount = items.filter((item) => item.done).length;
  const nextAction = items.find((item) => !item.done);

  return (
    <article className="panel record-readiness-panel" aria-label={copy.panelTitle}>
      <div className="panel-section-header panel-title-row">
        <div>
          <h2>{copy.panelTitle}</h2>
          <p className="helper-text">{copy.panelDescription}</p>
          <p className="helper-text">{status.reason}</p>
        </div>
        <span className="badge" data-record-status={status.kind}>{status.label}</span>
        <span className="badge">{copy.doneOfTotal.replace("{done}", String(doneCount)).replace("{total}", String(items.length))}</span>
      </div>
      <ul className="readiness-list">
        {items.map((item) => (
          <li key={item.key} className={item.done ? "readiness-item is-done" : "readiness-item"}>
            <span aria-hidden="true">{item.done ? "✓" : "○"}</span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
      {nextAction ? (
        <p className="helper-text">{copy.nextActionPrefix.replace("{hint}", nextAction.hint)}</p>
      ) : (
        <p className="helper-text">{copy.completeMessage}</p>
      )}
    </article>
  );
}
