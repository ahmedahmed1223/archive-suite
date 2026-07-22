import type { ArchiveRecord, BulkMacroStep, BulkMacroTarget } from "@/lib/archive-api";

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

export function bulkMacroStepLabel(step: BulkMacroStep): string {
  if (step.type === "add-tag") return `إضافة الوسم: ${step.tag}`;
  if (step.type === "set-workflow-status") return `تعيين الحالة: ${step.status}`;
  return "حذف إلى سلة المحذوفات";
}
