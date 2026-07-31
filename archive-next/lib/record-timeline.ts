// ponytail: merges data already loaded on the record page into one sorted timeline (V1-829).
// No new activity/notification system — history/comments/rights are existing endpoints.
import type { RecordComment, RecordHistoryEntry, RightsRecord } from "@/lib/archive-api";

export type TimelineEntryKind = "history" | "comment" | "rights";

export interface TimelineEntry {
  kind: TimelineEntryKind;
  label: string;
  detail: string;
  timestamp: string;
}

function historyLabel(entry: RecordHistoryEntry): string {
  return entry.event || entry.action;
}

export function buildRecordTimeline(input: {
  history: readonly RecordHistoryEntry[];
  comments: readonly RecordComment[];
  rights: RightsRecord | null;
}): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const item of input.history) {
    if (!item.createdAt) continue;
    entries.push({
      kind: "history",
      label: historyLabel(item),
      detail: item.outcome === "success" ? "" : `النتيجة: ${item.outcome}`,
      timestamp: item.createdAt
    });
  }

  for (const comment of input.comments) {
    if (!comment.createdAt) continue;
    entries.push({
      kind: "comment",
      label: `تعليق من ${comment.authorName}`,
      detail: comment.body,
      timestamp: comment.createdAt
    });
  }

  if (input.rights) {
    entries.push({
      kind: "rights",
      label: "سجل الحقوق",
      detail: `${input.rights.rightsHolder} — ${input.rights.licenseType}`,
      timestamp: input.rights.updatedAt
    });
  }

  return entries.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0));
}
