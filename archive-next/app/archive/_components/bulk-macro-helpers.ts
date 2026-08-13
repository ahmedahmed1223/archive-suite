import type { ArchiveRecord, BulkMacroStep, BulkMacroTarget } from "@/lib/archive-api";
import type { AppDictionary } from "@/lib/i18n/dictionaries";
import type { AppLocale } from "@/lib/i18n/types";

export type BulkMacroRecorderCopy = AppDictionary["pages"]["bulkMacroRecorder"];

/** Converts the current UI selection into the explicit server-authoritative target list. */
export function selectedBulkMacroTargets(records: ArchiveRecord[], selectedIds: string[]): BulkMacroTarget[] {
  const selected = new Set(selectedIds);
  const seen = new Set<string>();
  return records.flatMap((record) => {
    const store = record.store;
    if (!selected.has(record.id) || !store) return [];
    const key = `${store}\u0000${record.id}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ store, id: record.id }];
  });
}

export function bulkMacroStepLabel(step: BulkMacroStep, copy: BulkMacroRecorderCopy): string {
  if (step.type === "add-tag") return copy.addTagStep.replace("{tag}", step.tag);
  if (step.type === "set-workflow-status") return copy.setWorkflowStatusStep.replace("{status}", bulkMacroStatusLabel(step.status ?? "", copy));
  return copy.deleteStep;
}

export function bulkMacroStepTypeLabel(type: BulkMacroStep["type"], copy: BulkMacroRecorderCopy): string {
  return type === "add-tag" ? copy.addTagStepType : type === "set-workflow-status" ? copy.setWorkflowStatusStepType : copy.deleteStepType;
}

export function bulkMacroStatusLabel(status: string, copy: BulkMacroRecorderCopy): string {
  return copy.statuses[status as keyof typeof copy.statuses] ?? status;
}

export function bulkMacroReasonLabel(reason: string, copy: BulkMacroRecorderCopy): string {
  return copy.reasons[reason as keyof typeof copy.reasons] ?? reason;
}

export function bulkMacroValueLabel(value: unknown, copy: BulkMacroRecorderCopy, locale: AppLocale): string {
  if (value === null || value === undefined) return copy.emptyValue;
  if (typeof value === "string") return bulkMacroStatusLabel(value, copy);
  if (typeof value === "boolean") return value ? copy.yes : copy.no;
  if (typeof value === "number") return new Intl.NumberFormat(locale).format(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

export function bulkMacroDefinitionKey(name: string, steps: BulkMacroStep[]): string {
  return JSON.stringify({ name: name.trim(), steps });
}
