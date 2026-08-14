// ponytail: actionable safety warnings from data already loaded on the record page (V1-830).
// No AI provider — checksum/expiry/processing-status checks only.
import type { RecordAttachment, RightsRecord } from "@/lib/archive-api";
import type { AppLocale } from "@/lib/i18n/types";

export type SafetyAlertKind = "checksum-duplicate" | "rights-expired" | "upload-incomplete";

export interface SafetyAlert {
  kind: SafetyAlertKind;
  message: string;
}

function findChecksumDuplicates(attachments: readonly RecordAttachment[], locale: AppLocale): SafetyAlert[] {
  const bySum = new Map<string, RecordAttachment[]>();
  for (const attachment of attachments) {
    if (!attachment.checksumSha256) continue;
    const group = bySum.get(attachment.checksumSha256) ?? [];
    group.push(attachment);
    bySum.set(attachment.checksumSha256, group);
  }
  return [...bySum.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      kind: "checksum-duplicate" as const,
      message: locale === "en"
        ? `${group.length} attachments share the same checksum: ${group.map((a) => a.originalName).join(", ")}.`
        : `${group.length} ملفات مرفقة بنفس الـchecksum: ${group.map((a) => a.originalName).join("، ")}.`
    }));
}

export function buildSafetyAlerts(input: {
  attachments: readonly RecordAttachment[];
  rights: RightsRecord | null;
  now?: Date;
}, locale: AppLocale = "ar"): SafetyAlert[] {
  const now = input.now ?? new Date();
  const alerts: SafetyAlert[] = [...findChecksumDuplicates(input.attachments, locale)];

  if (input.rights?.expiresAt && new Date(input.rights.expiresAt) < now) {
    alerts.push({ kind: "rights-expired", message: locale === "en" ? `Rights expired on ${input.rights.expiresAt.slice(0, 10)}.` : `الحقوق منتهية منذ ${input.rights.expiresAt.slice(0, 10)}.` });
  }

  for (const attachment of input.attachments) {
    if (attachment.processingStatus !== "ready") {
      alerts.push({ kind: "upload-incomplete", message: locale === "en" ? `Upload has not completed: ${attachment.originalName} (${attachment.processingStatus}).` : `الرفع لم يكتمل بعد: ${attachment.originalName} (${attachment.processingStatus}).` });
    }
  }

  return alerts;
}
