// ponytail: which type-specific metadata fields to show in the edit form (V1-863).
// Pure derivation over the org's existing ArchiveType.fields schema (see /types) — no new field storage.
import type { ArchiveType, ArchiveTypeField } from "@/lib/archive-api";

/** الحقول المخصصة للنوع الحالي فقط، أو [] إن لم يُعثر على النوع أو كان بلا معرّف. */
export function fieldsForType(typeId: string | undefined, types: readonly ArchiveType[]): ArchiveTypeField[] {
  if (!typeId) return [];
  return types.find((t) => t.id === typeId)?.fields ?? [];
}

/**
 * يدمج قيم الحقول الظاهرة فقط في البيانات الوصفية الحالية، ويترك كل حقل آخر
 * (تابع لنوع سابق مثلًا) كما هو بلا حذف — "الحفاظ على البيانات المخفية".
 */
export function mergeVisibleFieldValues(
  currentMetadata: Record<string, unknown>,
  visibleFields: readonly ArchiveTypeField[],
  updates: Record<string, unknown>
): Record<string, unknown> {
  const visibleNames = new Set(visibleFields.map((f) => f.name));
  const patch: Record<string, unknown> = {};
  for (const name of Object.keys(updates)) {
    if (visibleNames.has(name)) patch[name] = updates[name];
  }
  return { ...currentMetadata, ...patch };
}
