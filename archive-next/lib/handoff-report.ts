// ponytail: printable handoff summary across a set of records (V1-864), reusing
// deriveRecordStatus (V1-851) for status/missing rather than a new status pass.
import type { ArchiveRecord, RecordComment, RightsRecord } from "@/lib/archive-api";
import { deriveRecordStatus } from "@/lib/record-status";

export interface HandoffRecordEntry {
  id: string;
  title: string;
  statusLabel: string;
  statusReason: string;
  rightsHolder: string | null;
  openCommentCount: number;
}

/** تعليق "مفتوح" = بلا حل معروف؛ لا حقل "resolved" في `RecordComment`، فكل التعليقات تُحسب. */
export function buildHandoffEntry(
  record: ArchiveRecord,
  rights: RightsRecord | null,
  comments: readonly RecordComment[]
): HandoffRecordEntry {
  const status = deriveRecordStatus(record);
  return {
    id: record.id,
    title: record.title,
    statusLabel: status.label,
    statusReason: status.reason,
    rightsHolder: rights?.rightsHolder ?? null,
    openCommentCount: comments.length
  };
}

export function formatHandoffReport(entries: readonly HandoffRecordEntry[]): string {
  if (entries.length === 0) return "لا توجد مواد في هذا التسليم.";
  return entries
    .map((entry) => {
      const lines = [
        `${entry.title} (${entry.id})`,
        `  الحالة: ${entry.statusLabel} — ${entry.statusReason}`,
        `  الحقوق: ${entry.rightsHolder ?? "غير محددة"}`,
        `  تعليقات مفتوحة: ${entry.openCommentCount}`
      ];
      return lines.join("\n");
    })
    .join("\n\n");
}
