// ponytail: aggregates cleanup items from data the caller already fetched (V1-833) —
// no new analytics engine, no new API call. Reuses deriveRecordStatus (V1-851).
import type { ArchiveFile, ArchiveRecord } from "@/lib/archive-api";
import { deriveRecordStatus } from "@/lib/record-status";
import type { AppLocale } from "@/lib/i18n/types";

export type CleanupReason = "incomplete-record" | "orphan-file" | "failed-upload" | "possible-duplicate";

export interface CleanupItem {
  reason: CleanupReason;
  label: string;
  detail: string;
  actionHref: string;
}

export interface ScheduledUploadLike {
  id: string;
  status: string;
  fileName?: string;
}

/** ملف بلا مرجع سجل معروف — لا معرّف عنصر يربطه بمادة. */
function findOrphanFiles(files: readonly ArchiveFile[], recordSourcePaths: ReadonlySet<string>): ArchiveFile[] {
  return files.filter((file) => !recordSourcePaths.has(file.key));
}

function findDuplicateFiles(files: readonly ArchiveFile[]): ArchiveFile[][] {
  const bySize = new Map<string, ArchiveFile[]>();
  for (const file of files) {
    if (!file.name || file.size === undefined) continue;
    const key = `${file.name}:${file.size}`;
    const group = bySize.get(key) ?? [];
    group.push(file);
    bySize.set(key, group);
  }
  return [...bySize.values()].filter((group) => group.length > 1);
}

export function buildCleanupItems(input: {
  records: readonly ArchiveRecord[];
  files: readonly ArchiveFile[];
  recordSourcePaths: ReadonlySet<string>;
  scheduledUploads: readonly ScheduledUploadLike[];
  locale?: AppLocale;
}): CleanupItem[] {
  const items: CleanupItem[] = [];
  const locale = input.locale ?? (typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "ar");

  for (const record of input.records) {
    const status = deriveRecordStatus(record, locale);
    if (status.kind === "incomplete") {
      items.push({
        reason: "incomplete-record",
        label: record.title || record.id,
        detail: status.reason,
        actionHref: `/archive/${encodeURIComponent(record.id)}`
      });
    }
  }

  for (const file of findOrphanFiles(input.files, input.recordSourcePaths)) {
    items.push({
      reason: "orphan-file",
      label: file.name ?? file.key,
      detail: locale === "ar" ? "لا سجل مرتبط بهذا الملف." : "No record is linked to this file.",
      actionHref: `/files?q=${encodeURIComponent(file.key)}`
    });
  }

  for (const upload of input.scheduledUploads) {
    if (upload.status === "failed") {
      items.push({
        reason: "failed-upload",
        label: upload.fileName ?? upload.id,
        detail: locale === "ar" ? "فشل هذا الرفع المجدول." : "This scheduled upload failed.",
        actionHref: `/uploads/scheduled`
      });
    }
  }

  for (const group of findDuplicateFiles(input.files)) {
    for (const file of group) {
      items.push({
        reason: "possible-duplicate",
        label: file.name ?? file.key,
        detail: locale === "ar"
          ? `يطابق الاسم والحجم ${group.length - 1} ملفًا آخر.`
          : `Its name and size match ${group.length - 1} other file${group.length === 2 ? "" : "s"}.`,
        actionHref: `/files?q=${encodeURIComponent(file.name ?? file.key)}`
      });
    }
  }

  return items;
}
