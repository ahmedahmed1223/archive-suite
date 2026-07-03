import type { ArchiveRecord } from "@/lib/archive-api";

export type WorkflowStatus = "draft" | "editing" | "review" | "approved" | "published" | "archived";

export const WORKFLOW_STATES: WorkflowStatus[] = ["draft", "editing", "review", "approved", "published", "archived"];

export const workflowStatusLabels: Record<WorkflowStatus, string> = {
  draft: "مسودة",
  editing: "تحرير",
  review: "قيد المراجعة",
  approved: "معتمد",
  published: "منشور",
  archived: "مؤرشف"
};

export function normalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .trim();
}

export function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ar-SA");
}

export function getRecordWorkflowStatus(record: ArchiveRecord): WorkflowStatus {
  const value = record.workflowStatus;
  return typeof value === "string" && (WORKFLOW_STATES as string[]).includes(value)
    ? (value as WorkflowStatus)
    : "draft";
}

export function getRecordSearchText(record: ArchiveRecord) {
  const metadata = record.metadata && typeof record.metadata === "object"
    ? Object.values(record.metadata).join(" ")
    : "";

  return normalizeText([
    record.id,
    record.uid,
    record.title,
    record.description,
    record.store,
    record.type,
    record.subtype,
    (record.tags || []).join(" "),
    metadata
  ].join(" "));
}

export function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))))
    .sort((a, b) => a.localeCompare(b, "ar"));
}

export function countBy(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ar"));
}

export function recordMatches(record: ArchiveRecord, filters: { query?: string; type?: string; tag?: string; status?: string }) {
  if (filters.type && filters.type !== "all" && record.type !== filters.type) return false;
  if (filters.tag && filters.tag !== "all" && !(record.tags || []).includes(filters.tag)) return false;
  if (filters.status && filters.status !== "all" && getRecordWorkflowStatus(record) !== filters.status) return false;
  if (!filters.query?.trim()) return true;
  return getRecordSearchText(record).includes(normalizeText(filters.query));
}
