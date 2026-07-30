import type { ArchiveRecord } from "@/lib/archive-api";
import { getRecordWorkflowStatus } from "@/lib/record-utils";

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

const missingFieldLabels: Record<string, string> = {
  title: "العنوان",
  description: "الوصف",
  type: "النوع",
  tags: "الوسوم"
};

function missingFieldsText(record: ArchiveRecord): string {
  const missing = record.descriptorCompletion?.missing ?? [];
  return missing.map((field) => missingFieldLabels[field] ?? field).join("، ");
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
export function missingDescribeFields(draft: DescribeDraft): string[] {
  const missing: string[] = [];
  if (!draft.title.trim()) missing.push(missingFieldLabels.title);
  if (!draft.description.trim()) missing.push(missingFieldLabels.description);
  if (!draft.type.trim()) missing.push(missingFieldLabels.type);
  if (draft.tags.length === 0) missing.push(missingFieldLabels.tags);
  return missing;
}

export function deriveRecordStatus(record: ArchiveRecord): RecordStatus {
  const workflowStatus = getRecordWorkflowStatus(record);

  if (workflowStatus === "archived") {
    return { kind: "archived", label: "مؤرشفة", reason: "حالة سير العمل: مؤرشفة." };
  }

  if (workflowStatus === "review") {
    return { kind: "review", label: "قيد المراجعة", reason: "حالة سير العمل: قيد المراجعة." };
  }

  // Incompleteness outranks draft/ready: it is the actionable state, and hiding
  // it behind "منشور" is how half-described records stay half-described.
  if (record.descriptorCompletion && record.descriptorCompletion.status !== "green") {
    const fields = missingFieldsText(record);
    return {
      kind: "incomplete",
      label: "ناقصة",
      reason: fields ? `ينقصها: ${fields}.` : "التوصيف غير مكتمل."
    };
  }

  if (workflowStatus === "draft" || workflowStatus === "editing") {
    return { kind: "draft", label: "مسودة", reason: "لم تُرسل للمراجعة بعد." };
  }

  return { kind: "ready", label: "جاهزة", reason: "التوصيف مكتمل وحالة سير العمل معتمدة." };
}
