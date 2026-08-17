import type { ArchiveType } from "@/lib/archive-api";
import type { AppLocale } from "@/lib/i18n/types";

/**
 * V3-VOCAB-001: archive-pattern template catalog. Each entry bundles the
 * record type, metadata template, and taxonomy tags for one of the archive
 * patterns this product actually serves. Applying a template only calls the
 * existing /types, /metadata-templates, and /tag-nodes endpoints — nothing
 * else — and is idempotent (see lib/vocab-templates/apply.ts).
 */
export const VOCAB_TEMPLATE_KEYS = ["broadcast", "rawFootage", "oralTestimony", "humanRights"] as const;
export type VocabTemplateKey = (typeof VOCAB_TEMPLATE_KEYS)[number];

export interface VocabTemplateTagBlueprint {
  /** The tag's own text, also its identity — tag-nodes have no separate id key. */
  tag: string;
  /** Parent tag's `tag` text, or "" for a root node. */
  parent: string;
}

export interface VocabTemplateMetadataBlueprint {
  name: string;
  typeId: string;
  tags: string[];
}

export interface VocabTemplateBlueprint {
  key: VocabTemplateKey;
  type: ArchiveType;
  metadataTemplate: VocabTemplateMetadataBlueprint;
  /** Root tags before children — apply.ts creates them in this order. */
  tags: readonly VocabTemplateTagBlueprint[];
}

const CATALOG_AR: readonly VocabTemplateBlueprint[] = [
  {
    key: "broadcast",
    type: {
      id: "pattern-broadcast-program",
      name: "برنامج تلفزيوني",
      fields: [
        { name: "قناة البث", type: "text" },
        { name: "رقم الحلقة", type: "number" },
        { name: "تاريخ البث", type: "date" },
        { name: "مقدم البرنامج", type: "text" },
        { name: "لغة البرنامج", type: "select" },
      ],
    },
    metadataTemplate: {
      name: "قالب بيانات برنامج تلفزيوني",
      typeId: "pattern-broadcast-program",
      tags: ["بث تلفزيوني"],
    },
    tags: [
      { tag: "بث تلفزيوني", parent: "" },
      { tag: "برامج", parent: "بث تلفزيوني" },
      { tag: "نشرات إخبارية", parent: "بث تلفزيوني" },
    ],
  },
  {
    key: "rawFootage",
    type: {
      id: "pattern-raw-footage",
      name: "لقطات ميدانية خام",
      fields: [
        { name: "المصور الميداني", type: "text" },
        { name: "موقع التصوير", type: "text" },
        { name: "تاريخ التصوير", type: "date" },
        { name: "جهاز التسجيل", type: "text" },
        { name: "تمت المعالجة؟", type: "boolean" },
      ],
    },
    metadataTemplate: {
      name: "قالب بيانات لقطات ميدانية خام",
      typeId: "pattern-raw-footage",
      tags: ["مواد ميدانية خام"],
    },
    tags: [
      { tag: "مواد ميدانية خام", parent: "" },
      { tag: "غير مُحرَّر", parent: "مواد ميدانية خام" },
      { tag: "بانتظار المراجعة", parent: "مواد ميدانية خام" },
    ],
  },
  {
    key: "oralTestimony",
    type: {
      id: "pattern-oral-testimony",
      name: "شهادة شفوية",
      fields: [
        { name: "اسم الراوي", type: "text" },
        { name: "صفة الراوي", type: "text" },
        { name: "تاريخ الجلسة", type: "date" },
        { name: "لغة الشهادة", type: "select" },
        { name: "تم الحصول على الموافقة؟", type: "boolean" },
      ],
    },
    metadataTemplate: {
      name: "قالب بيانات شهادة شفوية",
      typeId: "pattern-oral-testimony",
      tags: ["شهادات شفوية"],
    },
    tags: [
      { tag: "شهادات شفوية", parent: "" },
      { tag: "شهادات شهود عيان", parent: "شهادات شفوية" },
      { tag: "شهادات ناجين", parent: "شهادات شفوية" },
    ],
  },
  {
    key: "humanRights",
    type: {
      id: "pattern-human-rights-doc",
      name: "توثيق حقوقي",
      fields: [
        { name: "نوع الانتهاك", type: "select" },
        { name: "موقع الحادثة", type: "text" },
        { name: "تاريخ الحادثة", type: "date" },
        { name: "عدد المتأثرين", type: "number" },
        { name: "درجة الحساسية", type: "select" },
        { name: "تم التحقق؟", type: "boolean" },
      ],
    },
    metadataTemplate: {
      name: "قالب بيانات توثيق حقوقي",
      typeId: "pattern-human-rights-doc",
      tags: ["توثيق حقوقي"],
    },
    tags: [
      { tag: "توثيق حقوقي", parent: "" },
      { tag: "انتهاكات موثقة", parent: "توثيق حقوقي" },
      { tag: "مواد حساسة", parent: "توثيق حقوقي" },
    ],
  },
];

const CATALOG_EN: readonly VocabTemplateBlueprint[] = [
  {
    key: "broadcast",
    type: {
      id: "pattern-broadcast-program",
      name: "TV Program",
      fields: [
        { name: "Broadcast channel", type: "text" },
        { name: "Episode number", type: "number" },
        { name: "Broadcast date", type: "date" },
        { name: "Presenter", type: "text" },
        { name: "Program language", type: "select" },
      ],
    },
    metadataTemplate: {
      name: "TV Program Metadata Template",
      typeId: "pattern-broadcast-program",
      tags: ["Broadcast"],
    },
    tags: [
      { tag: "Broadcast", parent: "" },
      { tag: "Programs", parent: "Broadcast" },
      { tag: "News bulletins", parent: "Broadcast" },
    ],
  },
  {
    key: "rawFootage",
    type: {
      id: "pattern-raw-footage",
      name: "Raw Field Footage",
      fields: [
        { name: "Field videographer", type: "text" },
        { name: "Filming location", type: "text" },
        { name: "Capture date", type: "date" },
        { name: "Recording device", type: "text" },
        { name: "Processed", type: "boolean" },
      ],
    },
    metadataTemplate: {
      name: "Raw Field Footage Metadata Template",
      typeId: "pattern-raw-footage",
      tags: ["Raw field material"],
    },
    tags: [
      { tag: "Raw field material", parent: "" },
      { tag: "Unedited", parent: "Raw field material" },
      { tag: "Pending review", parent: "Raw field material" },
    ],
  },
  {
    key: "oralTestimony",
    type: {
      id: "pattern-oral-testimony",
      name: "Oral Testimony",
      fields: [
        { name: "Narrator name", type: "text" },
        { name: "Narrator role", type: "text" },
        { name: "Session date", type: "date" },
        { name: "Testimony language", type: "select" },
        { name: "Consent obtained", type: "boolean" },
      ],
    },
    metadataTemplate: {
      name: "Oral Testimony Metadata Template",
      typeId: "pattern-oral-testimony",
      tags: ["Oral testimonies"],
    },
    tags: [
      { tag: "Oral testimonies", parent: "" },
      { tag: "Eyewitness accounts", parent: "Oral testimonies" },
      { tag: "Survivor accounts", parent: "Oral testimonies" },
    ],
  },
  {
    key: "humanRights",
    type: {
      id: "pattern-human-rights-doc",
      name: "Human Rights Documentation",
      fields: [
        { name: "Violation type", type: "select" },
        { name: "Incident location", type: "text" },
        { name: "Incident date", type: "date" },
        { name: "Affected count", type: "number" },
        { name: "Sensitivity level", type: "select" },
        { name: "Verified", type: "boolean" },
      ],
    },
    metadataTemplate: {
      name: "Human Rights Documentation Metadata Template",
      typeId: "pattern-human-rights-doc",
      tags: ["Human rights documentation"],
    },
    tags: [
      { tag: "Human rights documentation", parent: "" },
      { tag: "Documented violations", parent: "Human rights documentation" },
      { tag: "Sensitive material", parent: "Human rights documentation" },
    ],
  },
];

/** Returns the archive-pattern catalog in the language selected for the apply flow. */
export function getVocabTemplateCatalog(locale: AppLocale): readonly VocabTemplateBlueprint[] {
  return locale === "en" ? CATALOG_EN : CATALOG_AR;
}
