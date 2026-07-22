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

export function bulkMacroStepTypeLabel(type: BulkMacroStep["type"]): string {
  return type === "add-tag" ? "إضافة وسم" : type === "set-workflow-status" ? "تعيين الحالة" : "حذف إلى سلة المحذوفات";
}

export function bulkMacroStatusLabel(status: string): string {
  return ({ draft: "مسودة", editing: "تحرير", review: "قيد المراجعة", approved: "معتمد", published: "منشور", archived: "مؤرشف", ready: "جاهز", missing: "مفقود", completed: "مكتمل", partial: "مكتمل جزئيًا", would_apply: "سيُطبّق", skipped: "تم التخطي" } as Record<string, string>)[status] ?? status;
}
