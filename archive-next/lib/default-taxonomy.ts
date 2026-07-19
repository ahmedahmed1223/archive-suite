import type { ArchiveType } from "@/lib/archive-api";

/**
 * V1-792: default media-archive taxonomy, importable on demand from /types.
 * Import is additive only — an existing type id is never overwritten, so an
 * organization's own schema always wins.
 */
export const DEFAULT_ARCHIVE_TYPES: readonly ArchiveType[] = [
  {
    id: "news",
    name: "أخبار",
    fields: [
      { name: "المراسل", type: "text" },
      { name: "الموقع", type: "text" },
      { name: "تاريخ الحدث", type: "date" },
      { name: "عاجل", type: "boolean" },
    ],
  },
  {
    id: "program",
    name: "برامج",
    fields: [
      { name: "اسم البرنامج", type: "text" },
      { name: "رقم الحلقة", type: "number" },
      { name: "الموسم", type: "number" },
      { name: "مقدم البرنامج", type: "text" },
      { name: "تاريخ البث", type: "date" },
    ],
  },
  {
    id: "documentary",
    name: "وثائقيات",
    fields: [
      { name: "المخرج", type: "text" },
      { name: "سنة الإنتاج", type: "number" },
      { name: "الموضوع", type: "text" },
      { name: "اللغة", type: "select" },
    ],
  },
  {
    id: "interview",
    name: "مقابلات",
    fields: [
      { name: "الضيف", type: "text" },
      { name: "صفة الضيف", type: "text" },
      { name: "المحاور", type: "text" },
      { name: "تاريخ التسجيل", type: "date" },
    ],
  },
  {
    id: "report",
    name: "تقارير",
    fields: [
      { name: "المعد", type: "text" },
      { name: "الموضوع", type: "text" },
      { name: "المدة بالثواني", type: "number" },
    ],
  },
  {
    id: "raw-footage",
    name: "مواد خام",
    fields: [
      { name: "المصور", type: "text" },
      { name: "الموقع", type: "text" },
      { name: "تاريخ التصوير", type: "date" },
      { name: "الكاميرا", type: "text" },
    ],
  },
  {
    id: "promo",
    name: "برومو وفواصل",
    fields: [
      { name: "الحملة", type: "text" },
      { name: "تاريخ البدء", type: "date" },
      { name: "تاريخ الانتهاء", type: "date" },
    ],
  },
  {
    id: "archive-document",
    name: "وثائق أرشيفية",
    fields: [
      { name: "الجهة المصدرة", type: "text" },
      { name: "تاريخ الوثيقة", type: "date" },
      { name: "درجة السرية", type: "select" },
    ],
  },
];

/** Returns only the defaults whose id is not already taken — never overwrites. */
export function selectMissingDefaults(
  existingIds: Iterable<string>,
  defaults: readonly ArchiveType[] = DEFAULT_ARCHIVE_TYPES,
): ArchiveType[] {
  const taken = new Set(existingIds);
  return defaults.filter((type) => !taken.has(type.id));
}
