import type { ArchiveType } from "@/lib/archive-api";
import type { AppLocale } from "@/lib/i18n/types";

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

const DEFAULT_ARCHIVE_TYPES_EN: readonly ArchiveType[] = [
  {
    id: "news",
    name: "News",
    fields: [
      { name: "Correspondent", type: "text" },
      { name: "Location", type: "text" },
      { name: "Event date", type: "date" },
      { name: "Breaking news", type: "boolean" },
    ],
  },
  {
    id: "program",
    name: "Programs",
    fields: [
      { name: "Program name", type: "text" },
      { name: "Episode number", type: "number" },
      { name: "Season", type: "number" },
      { name: "Presenter", type: "text" },
      { name: "Broadcast date", type: "date" },
    ],
  },
  {
    id: "documentary",
    name: "Documentaries",
    fields: [
      { name: "Director", type: "text" },
      { name: "Production year", type: "number" },
      { name: "Subject", type: "text" },
      { name: "Language", type: "select" },
    ],
  },
  {
    id: "interview",
    name: "Interviews",
    fields: [
      { name: "Guest", type: "text" },
      { name: "Guest title", type: "text" },
      { name: "Interviewer", type: "text" },
      { name: "Recording date", type: "date" },
    ],
  },
  {
    id: "report",
    name: "Reports",
    fields: [
      { name: "Producer", type: "text" },
      { name: "Subject", type: "text" },
      { name: "Duration in seconds", type: "number" },
    ],
  },
  {
    id: "raw-footage",
    name: "Raw footage",
    fields: [
      { name: "Camera operator", type: "text" },
      { name: "Location", type: "text" },
      { name: "Filming date", type: "date" },
      { name: "Camera", type: "text" },
    ],
  },
  {
    id: "promo",
    name: "Promos and interstitials",
    fields: [
      { name: "Campaign", type: "text" },
      { name: "Start date", type: "date" },
      { name: "End date", type: "date" },
    ],
  },
  {
    id: "archive-document",
    name: "Archival documents",
    fields: [
      { name: "Issuing organization", type: "text" },
      { name: "Document date", type: "date" },
      { name: "Classification", type: "select" },
    ],
  },
];

/** Common Arabic media-archive tags, importable from /vocabulary (kind: tag). */
export const DEFAULT_VOCABULARY_TAGS: readonly string[] = [
  "سياسة",
  "اقتصاد",
  "رياضة",
  "ثقافة",
  "صحة",
  "تعليم",
  "تكنولوجيا",
  "بيئة",
  "محلي",
  "دولي",
  "عاجل",
  "حصري",
  "أرشيفي",
  "مباشر",
];

const DEFAULT_VOCABULARY_TAGS_EN: readonly string[] = [
  "Politics",
  "Economy",
  "Sports",
  "Culture",
  "Health",
  "Education",
  "Technology",
  "Environment",
  "Local",
  "International",
  "Breaking news",
  "Exclusive",
  "Archive",
  "Live",
];

/** Returns the starter archive types in the language selected for the import. */
export function getDefaultArchiveTypes(locale: AppLocale): readonly ArchiveType[] {
  return locale === "en" ? DEFAULT_ARCHIVE_TYPES_EN : DEFAULT_ARCHIVE_TYPES;
}

/** Returns the starter vocabulary tags in the language selected for the import. */
export function getDefaultVocabularyTags(locale: AppLocale): readonly string[] {
  return locale === "en" ? DEFAULT_VOCABULARY_TAGS_EN : DEFAULT_VOCABULARY_TAGS;
}

/** Returns only the default tags not already present (case/whitespace-insensitive). */
export function selectMissingVocabularyTags(
  existingTerms: Iterable<string>,
  defaults: readonly string[] = DEFAULT_VOCABULARY_TAGS,
): string[] {
  const normalize = (value: string) => value.trim().toLowerCase();
  const taken = new Set([...existingTerms].map(normalize));
  return defaults.filter((term) => !taken.has(normalize(term)));
}

/** Returns only the defaults whose id is not already taken — never overwrites. */
export function selectMissingDefaults(
  existingIds: Iterable<string>,
  defaults: readonly ArchiveType[] = DEFAULT_ARCHIVE_TYPES,
): ArchiveType[] {
  const taken = new Set(existingIds);
  return defaults.filter((type) => !taken.has(type.id));
}
