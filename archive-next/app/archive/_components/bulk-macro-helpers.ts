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
  if (step.type === "set-workflow-status") return `تعيين الحالة: ${bulkMacroStatusLabel(step.status ?? "")}`;
  return "حذف إلى سلة المحذوفات";
}

export function bulkMacroStepTypeLabel(type: BulkMacroStep["type"]): string {
  return type === "add-tag" ? "إضافة وسم" : type === "set-workflow-status" ? "تعيين الحالة" : "حذف إلى سلة المحذوفات";
}

export function bulkMacroStatusLabel(status: string): string {
  return ({ draft: "مسودة", editing: "تحرير", review: "قيد المراجعة", approved: "معتمد", published: "منشور", archived: "مؤرشف", ready: "جاهز", missing: "مفقود", completed: "مكتمل", partial: "مكتمل جزئيًا", failed: "فشل", would_apply: "سيُطبّق", skipped: "تم التخطي" } as Record<string, string>)[status] ?? status;
}

export function bulkMacroReasonLabel(reason: string): string {
  return ({ deleted: "السجل محذوف", mutation_failed: "تعذر تطبيق التغيير", target_failed: "تعذرت معالجة السجل", event_dispatch_failed: "تعذر إرسال حدث التغيير" } as Record<string, string>)[reason] ?? reason;
}

export function bulkMacroValueLabel(value: unknown): string {
  if (value === null || value === undefined) return "لا يوجد";
  if (typeof value === "string") return bulkMacroStatusLabel(value);
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (typeof value === "number") return new Intl.NumberFormat("ar").format(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

export function bulkMacroDefinitionKey(name: string, steps: BulkMacroStep[]): string {
  return JSON.stringify({ name: name.trim(), steps });
}
