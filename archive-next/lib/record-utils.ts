import type { ArchiveRecord } from "@/lib/archive-api";
import { formatArabicDate } from "@/lib/arabic-format";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { AppLocale } from "@/lib/i18n/types";

export type WorkflowStatus = "draft" | "editing" | "review" | "approved" | "published" | "archived";

export const WORKFLOW_STATES: WorkflowStatus[] = ["draft", "editing", "review", "approved", "published", "archived"];

export function getWorkflowStatusLabels(locale: AppLocale = "ar"): Record<WorkflowStatus, string> {
  return getDictionary(locale).pages.archiveList.workflowStatus;
}

// Kept for callers that render the Arabic-default interface without locale context.
export const workflowStatusLabels = getWorkflowStatusLabels();

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

export function formatDate(value?: string, fallback = "-", locale: AppLocale = "ar") {
  if (locale === "ar") return formatArabicDate(value, fallback);
  if (!value) return fallback;

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? fallback
    : new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
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

export function uniqueSorted(values: Array<string | null | undefined>, locale: AppLocale = "ar") {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))))
    .sort((a, b) => a.localeCompare(b, locale));
}

export function countBy(values: string[], locale: AppLocale = "ar") {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], locale));
}

export function recordMatches(record: ArchiveRecord, filters: { query?: string | null; type?: string; tag?: string; status?: string }) {
  if (filters.type && filters.type !== "all" && record.type !== filters.type) return false;
  if (filters.tag && filters.tag !== "all" && !(record.tags || []).includes(filters.tag)) return false;
  if (filters.status && filters.status !== "all" && getRecordWorkflowStatus(record) !== filters.status) return false;
  if (!filters.query?.trim()) return true;
  return getRecordSearchText(record).includes(normalizeText(filters.query));
}
