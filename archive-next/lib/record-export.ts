// ponytail: readable export bundle for a single record (V1-844), built from data already
// loaded on the record page — no new API call, no files/tokens/share links included by default.
import type { ArchiveRecord, RecordHistoryEntry, RightsRecord } from "@/lib/archive-api";

export interface RecordExportBundle {
  id: string;
  title: string;
  description: string;
  type: string;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
  rights: {
    rightsHolder: string;
    licenseType: string;
    expiresAt: string | null;
  } | null;
  activity: Array<{ event: string; actorId: string | null; createdAt: string | null }>;
}

export function buildRecordExportBundle(
  record: ArchiveRecord,
  rights: RightsRecord | null,
  history: readonly RecordHistoryEntry[]
): RecordExportBundle {
  return {
    id: record.id,
    title: record.title,
    description: record.description ?? "",
    type: record.type ?? "",
    tags: record.tags ?? [],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    rights: rights
      ? { rightsHolder: rights.rightsHolder, licenseType: rights.licenseType, expiresAt: rights.expiresAt ?? null }
      : null,
    activity: history.map((entry) => ({ event: entry.event, actorId: entry.actorId, createdAt: entry.createdAt }))
  };
}

export function formatRecordExportText(bundle: RecordExportBundle): string {
  const lines = [
    `العنوان: ${bundle.title}`,
    `النوع: ${bundle.type || "—"}`,
    `الوصف: ${bundle.description || "—"}`,
    `الوسوم: ${bundle.tags.length ? bundle.tags.join("، ") : "—"}`,
    `أُنشئت: ${bundle.createdAt ?? "—"}`,
    `آخر تحديث: ${bundle.updatedAt ?? "—"}`,
    "",
    "الحقوق:",
    bundle.rights
      ? `  المالك: ${bundle.rights.rightsHolder} — الترخيص: ${bundle.rights.licenseType} — الانتهاء: ${bundle.rights.expiresAt ?? "—"}`
      : "  لا يوجد سجل حقوق",
    "",
    "سجل النشاط:",
    ...(bundle.activity.length
      ? bundle.activity.map((entry) => `  ${entry.createdAt ?? "—"} — ${entry.event}`)
      : ["  لا يوجد نشاط مسجّل"])
  ];
  return lines.join("\n");
}
