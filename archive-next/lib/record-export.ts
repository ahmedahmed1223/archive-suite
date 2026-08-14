// ponytail: readable export bundle for a single record (V1-844), built from data already
// loaded on the record page — no new API call, no files/tokens/share links included by default.
import type { ArchiveRecord, RecordHistoryEntry, RightsRecord } from "@/lib/archive-api";
import type { AppLocale } from "@/lib/i18n/types";

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

export function formatRecordExportText(bundle: RecordExportBundle, locale: AppLocale = "ar"): string {
  const isArabic = locale === "ar";
  const lines = [
    `${isArabic ? "العنوان" : "Title"}: ${bundle.title}`,
    `${isArabic ? "النوع" : "Type"}: ${bundle.type || "—"}`,
    `${isArabic ? "الوصف" : "Description"}: ${bundle.description || "—"}`,
    `${isArabic ? "الوسوم" : "Tags"}: ${bundle.tags.length ? bundle.tags.join(isArabic ? "، " : ", ") : "—"}`,
    `${isArabic ? "أُنشئت" : "Created"}: ${bundle.createdAt ?? "—"}`,
    `${isArabic ? "آخر تحديث" : "Last updated"}: ${bundle.updatedAt ?? "—"}`,
    "",
    isArabic ? "الحقوق:" : "Rights:",
    bundle.rights
      ? isArabic ? `  المالك: ${bundle.rights.rightsHolder} — الترخيص: ${bundle.rights.licenseType} — الانتهاء: ${bundle.rights.expiresAt ?? "—"}` : `  Holder: ${bundle.rights.rightsHolder} — License: ${bundle.rights.licenseType} — Expires: ${bundle.rights.expiresAt ?? "—"}`
      : isArabic ? "  لا يوجد سجل حقوق" : "  No rights record",
    "",
    isArabic ? "سجل النشاط:" : "Activity log:",
    ...(bundle.activity.length
      ? bundle.activity.map((entry) => `  ${entry.createdAt ?? "—"} — ${entry.event}`)
      : [isArabic ? "  لا يوجد نشاط مسجّل" : "  No recorded activity"])
  ];
  return lines.join("\n");
}
