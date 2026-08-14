import type { ArchiveRecord } from "./archive-api";
import type { AppLocale } from "./i18n/types";

export type LocalEntityKind = "place" | "date" | "type" | "status";

export interface LocalEntity {
  kind: LocalEntityKind;
  label: string;
  count: number;
  recordIds: string[];
}

export interface LocalTagSuggestion {
  tag: string;
  count: number;
  reason: string;
  recordIds: string[];
}

export interface LocalSearchEnrichment {
  mode: "local-rules";
  queryTokens: string[];
  entities: LocalEntity[];
  suggestedTags: LocalTagSuggestion[];
  coverage: {
    totalRecords: number;
    recordsWithoutTags: number;
    recordsWithSuggestions: number;
  };
}

const PLACE_PATTERNS: Array<{ label: string; patterns: readonly string[] }> = [
  { label: "Riyadh", patterns: ["riyadh", "الرياض"] },
  { label: "Jeddah", patterns: ["jeddah", "جدة"] },
  { label: "Makkah", patterns: ["makkah", "mecca", "مكة"] },
  { label: "Madinah", patterns: ["madinah", "medina", "المدينة"] },
  { label: "Dammam", patterns: ["dammam", "الدمام"] }
];

const TAG_RULES: Array<{ tag: string; patterns: readonly string[]; reason: Record<AppLocale, string> }> = [
  { tag: "city", patterns: ["city", "urban", "riyadh", "jeddah", "الرياض", "جدة", "مدينة"], reason: { ar: "ذُكرت مدينة أو سياق حضري في السجل.", en: "A city or urban context appears in this record." } },
  { tag: "interview", patterns: ["interview", "conversation", "مقابلة", "حوار"], reason: { ar: "يبدو أن المادة مقابلة أو حوار.", en: "This material appears to be an interview or conversation." } },
  { tag: "sports", patterns: ["sports", "match", "رياضة", "مباراة"], reason: { ar: "يظهر سياق رياضي في العنوان أو الوصف.", en: "A sports context appears in the title or description." } },
  { tag: "news", patterns: ["news", "report", "package", "تقرير", "أخبار"], reason: { ar: "يظهر نمط تقرير/حزمة أخبار.", en: "This record follows a news report or package pattern." } },
  { tag: "archive", patterns: ["archive", "أرشيف", "ارشيف"], reason: { ar: "المادة مصنفة لغوياً كسياق أرشيفي.", en: "This material is linguistically classified as archival content." } }
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function recordText(record: ArchiveRecord) {
  const metadata = record.metadata && typeof record.metadata === "object" ? JSON.stringify(record.metadata) : "";

  return normalize(
    [
      record.title,
      record.description,
      record.type,
      record.subtype,
      record.workflowStatus,
      ...(Array.isArray(record.tags) ? record.tags : []),
      metadata
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function addEntity(bucket: Map<string, LocalEntity>, kind: LocalEntityKind, label: string, recordId: string) {
  const key = `${kind}:${label}`;
  const current = bucket.get(key) ?? { kind, label, count: 0, recordIds: [] };

  if (!current.recordIds.includes(recordId)) {
    current.recordIds.push(recordId);
    current.count = current.recordIds.length;
  }

  bucket.set(key, current);
}

function addTagSuggestion(bucket: Map<string, LocalTagSuggestion>, tag: string, reason: string, recordId: string) {
  const current = bucket.get(tag) ?? { tag, count: 0, reason, recordIds: [] };

  if (!current.recordIds.includes(recordId)) {
    current.recordIds.push(recordId);
    current.count = current.recordIds.length;
  }

  bucket.set(tag, current);
}

function formatByCount<T extends { count: number; label?: string; tag?: string }>(items: Iterable<T>, locale: AppLocale) {
  return Array.from(items).sort((left, right) => (right.count - left.count) || String(left.label ?? left.tag).localeCompare(String(right.label ?? right.tag), locale));
}

export function deriveLocalSearchEnrichment(records: ArchiveRecord[], query = "", locale: AppLocale = "ar"): LocalSearchEnrichment {
  const entities = new Map<string, LocalEntity>();
  const suggestedTags = new Map<string, LocalTagSuggestion>();
  const queryTokens = normalize(query).split(" ").filter(Boolean);
  let recordsWithoutTags = 0;
  const recordsWithSuggestions = new Set<string>();

  for (const record of records) {
    const id = String(record.id || record.uid || "");
    const text = recordText(record);
    const tags = Array.isArray(record.tags) ? record.tags.map((tag) => normalize(String(tag))) : [];

    if (tags.length === 0) {
      recordsWithoutTags++;
    }

    for (const place of PLACE_PATTERNS) {
      if (place.patterns.some((pattern) => text.includes(normalize(pattern)))) {
        addEntity(entities, "place", place.label, id);
      }
    }

    for (const match of text.matchAll(/\b(19\d{2}|20\d{2})\b/g)) {
      addEntity(entities, "date", match[1], id);
    }

    if (record.type) {
      addEntity(entities, "type", String(record.type), id);
    }

    const workflowStatus = typeof record.workflowStatus === "string" ? record.workflowStatus : typeof record.status === "string" ? record.status : "";
    if (workflowStatus) {
      addEntity(entities, "status", workflowStatus, id);
    }

    for (const rule of TAG_RULES) {
      if (tags.includes(normalize(rule.tag))) {
        continue;
      }

      if (rule.patterns.some((pattern) => text.includes(normalize(pattern)))) {
        addTagSuggestion(suggestedTags, rule.tag, rule.reason[locale], id);
        recordsWithSuggestions.add(id);
      }
    }
  }

  return {
    mode: "local-rules",
    queryTokens,
    entities: formatByCount(entities.values(), locale),
    suggestedTags: formatByCount(suggestedTags.values(), locale),
    coverage: {
      totalRecords: records.length,
      recordsWithoutTags,
      recordsWithSuggestions: recordsWithSuggestions.size
    }
  };
}
