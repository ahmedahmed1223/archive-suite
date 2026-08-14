import type { ArchiveRecord } from "@/lib/archive-api";
import { getRecordWorkflowStatus } from "@/lib/record-utils";
import type { AppLocale } from "@/lib/i18n/types";

/**
 * V1-851: one derived badge shared by the lists and the record page.
 * ponytail: derived from the existing workflow status plus the API's own
 * descriptorCompletion -- no parallel status cycle, no new stored field.
 */
export type RecordStatusKind = "archived" | "review" | "incomplete" | "draft" | "ready";

export interface RecordStatus {
  kind: RecordStatusKind;
  label: string;
  /** Why the record landed in this state, in the user's words. */
  reason: string;
}

const missingFieldLabels: Record<string, Record<AppLocale, string>> = {
  title: { ar: "العنوان", en: "Title" },
  description: { ar: "الوصف", en: "Description" },
  type: { ar: "النوع", en: "Type" },
  tags: { ar: "الوسوم", en: "Tags" }
};

function missingFieldsText(record: ArchiveRecord, locale: AppLocale): string {
  const missing = record.descriptorCompletion?.missing ?? [];
  return missing.map((field) => missingFieldLabels[field]?.[locale] ?? field).join(locale === "ar" ? "، " : ", ");
}

export interface DescribeDraft {
  title: string;
  description: string;
  type: string;
  tags: string[];
}

/**
 * V1-843: the same four fields the API scores in descriptorCompletion, judged
 * against the unsaved draft so the form and the badge never disagree.
 * ponytail: returns labels, not keys -- every caller only ever renders them.
 */
export function missingDescribeFields(draft: DescribeDraft, locale: AppLocale = "ar"): string[] {
  const missing: string[] = [];
  if (!draft.title.trim()) missing.push(missingFieldLabels.title[locale]);
  if (!draft.description.trim()) missing.push(missingFieldLabels.description[locale]);
  if (!draft.type.trim()) missing.push(missingFieldLabels.type[locale]);
  if (draft.tags.length === 0) missing.push(missingFieldLabels.tags[locale]);
  return missing;
}

export function deriveRecordStatus(record: ArchiveRecord, locale: AppLocale = "ar"): RecordStatus {
  const workflowStatus = getRecordWorkflowStatus(record);

  if (workflowStatus === "archived") {
    return locale === "ar"
      ? { kind: "archived", label: "مؤرشفة", reason: "حالة سير العمل: مؤرشفة." }
      : { kind: "archived", label: "Archived", reason: "Workflow status: archived." };
  }

  if (workflowStatus === "review") {
    return locale === "ar"
      ? { kind: "review", label: "قيد المراجعة", reason: "حالة سير العمل: قيد المراجعة." }
      : { kind: "review", label: "In review", reason: "Workflow status: in review." };
  }

  // Incompleteness outranks draft/ready: it is the actionable state, and hiding
  // it behind "منشور" is how half-described records stay half-described.
  if (record.descriptorCompletion && record.descriptorCompletion.status !== "green") {
    const fields = missingFieldsText(record, locale);
    return {
      kind: "incomplete",
      label: locale === "ar" ? "ناقصة" : "Incomplete",
      reason: fields
        ? locale === "ar" ? `ينقصها: ${fields}.` : `Missing: ${fields}.`
        : locale === "ar" ? "التوصيف غير مكتمل." : "Description is incomplete."
    };
  }

  if (workflowStatus === "draft" || workflowStatus === "editing") {
    return locale === "ar"
      ? { kind: "draft", label: "مسودة", reason: "لم تُرسل للمراجعة بعد." }
      : { kind: "draft", label: "Draft", reason: "It has not been submitted for review yet." };
  }

  return locale === "ar"
    ? { kind: "ready", label: "جاهزة", reason: "التوصيف مكتمل وحالة سير العمل معتمدة." }
    : { kind: "ready", label: "Ready", reason: "Description is complete and the workflow status is approved." };
}
