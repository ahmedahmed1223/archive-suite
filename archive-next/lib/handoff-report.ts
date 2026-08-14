// ponytail: printable handoff summary across a set of records (V1-864), reusing
// deriveRecordStatus (V1-851) for status/missing rather than a new status pass.
import type { ArchiveRecord, RecordComment, RightsRecord } from "@/lib/archive-api";
import type { AppLocale } from "@/lib/i18n/types";
import { deriveRecordStatus } from "@/lib/record-status";

export interface HandoffRecordEntry {
  id: string;
  title: string;
  statusLabel: string;
  statusReason: string;
  rightsHolder: string | null;
  openCommentCount: number;
}

/** Comments have no resolved field, so every supplied comment is counted as open. */
export function buildHandoffEntry(
  record: ArchiveRecord,
  rights: RightsRecord | null,
  comments: readonly RecordComment[],
  locale: AppLocale = "ar",
): HandoffRecordEntry {
  const status = deriveRecordStatus(record, locale);
  return {
    id: record.id,
    title: record.title,
    statusLabel: status.label,
    statusReason: status.reason,
    rightsHolder: rights?.rightsHolder ?? null,
    openCommentCount: comments.length
  };
}

export function formatHandoffReport(entries: readonly HandoffRecordEntry[], locale: AppLocale = "ar"): string {
  if (entries.length === 0) return locale === "ar" ? "لا توجد مواد في هذا التسليم." : "There are no items in this handoff.";
  return entries
    .map((entry) => {
      const lines = locale === "ar"
        ? [
            `${entry.title} (${entry.id})`,
            `  الحالة: ${entry.statusLabel} — ${entry.statusReason}`,
            `  الحقوق: ${entry.rightsHolder ?? "غير محددة"}`,
            `  تعليقات مفتوحة: ${entry.openCommentCount}`,
          ]
        : [
            `${entry.title} (${entry.id})`,
            `  Status: ${entry.statusLabel} — ${entry.statusReason}`,
            `  Rights: ${entry.rightsHolder ?? "Not specified"}`,
            `  Open comments: ${entry.openCommentCount}`,
          ];
      return lines.join("\n");
    })
    .join("\n\n");
}
