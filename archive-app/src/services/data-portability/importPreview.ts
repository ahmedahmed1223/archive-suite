import { normalizeArabicSearchText } from "../../utils/formatting.js";
import { stableStringifyForChecksum } from "./packageFormat.js";
import { sanitizePlainData } from "./json.js";

export interface ImportPreviewEntityConfig {
  key: string;
  label: string;
  titleKey?: string;
  ignore?: string[];
}

export interface ImportPreviewEntitySummary {
  key: string;
  label: string;
  total: number;
  newCount: number;
  duplicateCount: number;
  conflictCount: number;
  potentialDuplicateCount: number;
}

export interface ImportPreviewSummary {
  entities: ImportPreviewEntitySummary[];
  totals: {
    records: number;
    newCount: number;
    duplicateCount: number;
    conflictCount: number;
    potentialDuplicateCount: number;
  };
  hasSettings: boolean;
  hasUsers: boolean;
}

export const IMPORT_PREVIEW_ENTITIES: ImportPreviewEntityConfig[] = [
  { key: "videoItems", label: "المواد", titleKey: "title", ignore: ["updatedAt"] },
  { key: "contentTypes", label: "أنواع المحتوى", ignore: ["updatedAt"] },
  { key: "virtualCollections", label: "المجموعات", ignore: ["updatedAt"] },
  { key: "vocabulary", label: "المصطلحات", ignore: ["updatedAt"] },
  { key: "hierarchicalTags", label: "الوسوم الهرمية", ignore: ["updatedAt"] },
  { key: "bookmarks", label: "الإشارات المرجعية", ignore: ["updatedAt"] },
  { key: "relations", label: "العلاقات", ignore: ["updatedAt"] },
  { key: "users", label: "المستخدمون", ignore: ["passwordHash", "updatedAt", "lastLoginAt"] },
  { key: "auditLogs", label: "سجل المراجعة" },
  { key: "changeHistory", label: "سجل التغييرات" }
];

export function comparableImportRecord(record: any, ignoredKeys: string[] = []): string {
  const ignored = new Set(ignoredKeys);
  const clean = (value: any): any => {
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === "object") {
      return Object.keys(value).sort().reduce((output: Record<string, any>, key) => {
        if (!ignored.has(key) && value[key] !== void 0) output[key] = clean(value[key]);
        return output;
      }, {});
    }
    return value;
  };
  return stableStringifyForChecksum(clean(sanitizePlainData(record || {})));
}

export function summarizeImportEntity(config: ImportPreviewEntityConfig, importedRecords: any[], currentRecords: any[]): ImportPreviewEntitySummary {
  const imported = Array.isArray(importedRecords) ? importedRecords.filter(Boolean) : [];
  const current = Array.isArray(currentRecords) ? currentRecords.filter(Boolean) : [];
  const currentById = new Map<string, any>(
    current.map((record): [string, any] => [String(record.id || ""), record]).filter(([id]) => id)
  );
  const titleKeyName = config.titleKey;
  const currentTitles = titleKeyName
    ? new Set<string>(current.map((record) => normalizeArabicSearchText(record?.[titleKeyName] || "")).filter(Boolean))
    : new Set<string>();

  let newCount = 0;
  let duplicateCount = 0;
  let conflictCount = 0;
  let potentialDuplicateCount = 0;

  imported.forEach((record) => {
    const existing = record?.id ? currentById.get(record.id) : null;
    if (!existing) {
      newCount += 1;
      const titleKey = titleKeyName ? normalizeArabicSearchText(record?.[titleKeyName] || "") : "";
      if (titleKey && currentTitles.has(titleKey)) potentialDuplicateCount += 1;
      return;
    }
    duplicateCount += 1;
    if (comparableImportRecord(existing, config.ignore || []) !== comparableImportRecord(record, config.ignore || [])) {
      conflictCount += 1;
    }
  });

  return {
    key: config.key,
    label: config.label,
    total: imported.length,
    newCount,
    duplicateCount,
    conflictCount,
    potentialDuplicateCount
  };
}

export function createImportPreviewSummary(payload: any, currentState: Record<string, any> = {}, options: { normalizePayload?: (value: any) => any } = {}): ImportPreviewSummary {
  const normalizePayload = typeof options.normalizePayload === "function" ? options.normalizePayload : (value: any) => value || {};
  const normalizedPayload = normalizePayload(payload || {});
  const entities = IMPORT_PREVIEW_ENTITIES.map((config) => summarizeImportEntity(config, normalizedPayload[config.key], currentState[config.key]));
  const totals = entities.reduce((acc, entity) => {
    acc.records += entity.total;
    acc.newCount += entity.newCount;
    acc.duplicateCount += entity.duplicateCount;
    acc.conflictCount += entity.conflictCount;
    acc.potentialDuplicateCount += entity.potentialDuplicateCount;
    return acc;
  }, { records: 0, newCount: 0, duplicateCount: 0, conflictCount: 0, potentialDuplicateCount: 0 });

  return {
    entities,
    totals,
    hasSettings: !!normalizedPayload.settings,
    hasUsers: (normalizedPayload.users || []).length > 0
  };
}

export function formatImportPreviewSummary(summary: ImportPreviewSummary, options: { title?: string; fileName?: string; fileSize?: number; packageInfo?: { sourceDeviceName?: string; exportedAt?: string; checksum?: string } } = {}, helpers: { formatFileSize?: (value: number) => string } = {}): string {
  const formatFileSize = typeof helpers.formatFileSize === "function" ? helpers.formatFileSize : (value: number) => `${value} بايت`;
  const lines = [`معاينة ${options.title || "الاستيراد"}:`];

  if (options.fileName) lines.push(`الملف: ${options.fileName}`);
  if (options.fileSize) lines.push(`الحجم: ${formatFileSize(options.fileSize)}`);
  if (options.packageInfo?.sourceDeviceName) lines.push(`الجهاز المصدر: ${options.packageInfo.sourceDeviceName}`);
  if (options.packageInfo?.exportedAt) lines.push(`تاريخ التصدير: ${new Date(options.packageInfo.exportedAt).toLocaleString("ar-EG")}`);
  if (options.packageInfo?.checksum) lines.push(`checksum: ${String(options.packageInfo.checksum).slice(0, 16)}...`);
  lines.push("");

  const visibleEntities = summary.entities.filter((entity) => entity.total > 0 || entity.duplicateCount > 0 || entity.conflictCount > 0 || entity.potentialDuplicateCount > 0);
  if (visibleEntities.length === 0) {
    lines.push("لا توجد سجلات قابلة للاستيراد في الملف.");
  } else {
    visibleEntities.forEach((entity) => {
      const duplicateText = entity.potentialDuplicateCount ? `، تشابه عنوان ${entity.potentialDuplicateCount}` : "";
      lines.push(`${entity.label}: ${entity.total} | جديد ${entity.newCount} | مكرر ${entity.duplicateCount}${duplicateText} | متعارض ${entity.conflictCount}`);
    });
  }

  lines.push("");
  lines.push(`الإجمالي: ${summary.totals.records} سجل | جديد ${summary.totals.newCount} | مكرر ${summary.totals.duplicateCount} | متعارض ${summary.totals.conflictCount}`);
  if (summary.hasSettings) lines.push("الإعدادات: موجودة في الملف وسيتم دمجها مع الإعدادات الحالية.");
  if (summary.hasUsers) lines.push("المستخدمون المستوردون سيبقون معطلين حتى إعادة تعيين كلمات المرور.");
  lines.push("سيتم إنشاء نسخة احتياطية تلقائية قبل الاستيراد.");
  lines.push("");
  lines.push("هل تريد المتابعة؟");
  return lines.join("\n");
}
