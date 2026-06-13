import { normalizeArabicSearchText } from "../../utils/formatting.js";

export const TYPE_COLORS = ["#6366f1", "#10b981", "#14b8a6", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#6b7280"];

export const FIELD_TYPE_OPTIONS = [
  { id: "text", label: "نص" },
  { id: "textarea", label: "فقرة" },
  { id: "number", label: "رقم" },
  { id: "date", label: "تاريخ" },
  { id: "select", label: "قائمة" },
  { id: "multiselect", label: "قائمة متعددة" },
  { id: "tags", label: "وسوم" },
  { id: "checkbox", label: "اختيار" },
  { id: "url", label: "رابط" },
  { id: "duration", label: "مدة" },
  { id: "thumbnail", label: "صورة مصغرة" },
  { id: "localFile", label: "ملف محلي" },
  { id: "rating", label: "تقييم" }
];

const FIELD_TYPE_IDS = new Set(FIELD_TYPE_OPTIONS.map((item) => item.id));

export function normalizeFieldStorageKey(value = "") {
  const key = String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\u0600-\u06FF-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return key || `field_${Date.now().toString(36)}`;
}

export function createCustomFieldValue(partial = {}) {
  const name = normalizeFieldStorageKey(partial.name || partial.storageKey || partial.label || "field");
  return {
    id: partial.id || `field_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    storageKey: normalizeFieldStorageKey(partial.storageKey || name),
    label: String(partial.label || "حقل جديد").trim(),
    type: FIELD_TYPE_IDS.has(partial.type) ? partial.type : "text",
    required: !!partial.required,
    searchable: partial.searchable ?? true,
    hidden: !!partial.hidden,
    multiple: !!partial.multiple,
    defaultValue: partial.defaultValue,
    options: Array.isArray(partial.options) ? partial.options : parseFieldOptions(partial.options),
    placeholder: partial.placeholder || "",
    description: partial.description || "",
    order: Number.isFinite(Number(partial.order)) ? Number(partial.order) : 0,
    groupId: partial.groupId,
    group: typeof partial.group === "string" ? partial.group.trim() : "",
    requiredToSave: !!partial.requiredToSave,
    showWhen: normalizeShowWhen(partial.showWhen),
    status: partial.status || "active",
    archivedAt: partial.archivedAt,
    archivedBy: partial.archivedBy
  };
}

/**
 * Group custom fields by their `group` (tab) name, preserving first-seen
 * order of both groups and fields. Ungrouped fields fall into "عام".
 * Returns [{ name, fields }]. A single returned group means the caller can
 * render a flat list (no tabs needed).
 */
export function groupCustomFields(fields = []) {
  const order = [];
  const map = new Map();
  for (const field of fields) {
    const key = (field.group || "").trim() || "عام";
    if (!map.has(key)) { map.set(key, []); order.push(key); }
    map.get(key).push(field);
  }
  return order.map((name) => ({ name, fields: map.get(name) }));
}

/** Normalize a conditional-visibility rule to { fieldKey, equals } or null. */
export function normalizeShowWhen(showWhen) {
  if (!showWhen || typeof showWhen !== "object") return null;
  const fieldKey = String(showWhen.fieldKey || "").trim();
  if (!fieldKey) return null;
  return { fieldKey, equals: showWhen.equals === undefined ? "" : showWhen.equals };
}

/**
 * A field is visible unless it declares a showWhen rule that does not match
 * the current metadata. Comparison is string-based (and array-membership for
 * multi-value fields) so it works for select/text/checkbox values alike.
 */
export function isFieldVisible(field, metadata = {}) {
  const rule = field?.showWhen;
  if (!rule || !rule.fieldKey) return true;
  const actual = metadata?.[rule.fieldKey];
  const expected = rule.equals;
  if (Array.isArray(actual)) return actual.map((value) => String(value)).includes(String(expected));
  if (typeof actual === "boolean") return String(actual) === String(expected);
  return String(actual ?? "") === String(expected ?? "");
}

export function getVisibleFields(fields = [], metadata = {}) {
  return fields.filter((field) => isFieldVisible(field, metadata));
}

function isFieldValueEmpty(value) {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function getFieldKey(field = {}) {
  return field.storageKey || field.name || field.id || "";
}

export function hasMeaningfulFieldValue(value) {
  return !isFieldValueEmpty(value);
}

/**
 * Visible fields flagged required / requiredToSave that are still empty.
 * Hidden (showWhen-failed) fields never block — you can't fill what you
 * can't see. Used by the Add/Detail save paths for a hard validation gate.
 */
export function getMissingRequiredFields(fields = [], metadata = {}) {
  return getVisibleFields(fields, metadata).filter((field) => {
    if (!field.required && !field.requiredToSave) return false;
    return isFieldValueEmpty(metadata?.[field.storageKey || field.name]);
  });
}

export function createSubtypeValue(partial = {}) {
  return {
    id: partial.id || `subtype_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: String(partial.name || "نوع فرعي جديد").trim(),
    nameEn: partial.nameEn || "",
    fields: Array.isArray(partial.fields) ? partial.fields : [],
    order: Number.isFinite(Number(partial.order)) ? Number(partial.order) : 0,
    status: partial.status || "active",
    coverImage: partial.coverImage || null,
    coverFit: partial.coverFit || "cover",
    coverSourceName: partial.coverSourceName || "",
    coverUpdatedAt: partial.coverUpdatedAt || null,
    archivedAt: partial.archivedAt,
    archivedBy: partial.archivedBy
  };
}

export function createContentTypeValue(partial = {}) {
  const now = new Date().toISOString();
  return {
    id: partial.id || `type_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: String(partial.name || "نوع جديد").trim(),
    nameEn: partial.nameEn || "",
    icon: partial.icon || "📁",
    iconSpec: partial.iconSpec || { type: "emoji", value: partial.icon || "📁" },
    color: partial.color || "#6366f1",
    coverImage: partial.coverImage || null,
    coverFit: partial.coverFit || "cover",
    coverSourceName: partial.coverSourceName || "",
    coverUpdatedAt: partial.coverUpdatedAt || null,
    subtypes: Array.isArray(partial.subtypes) ? partial.subtypes : [],
    fields: Array.isArray(partial.fields) ? partial.fields : [],
    order: Number.isFinite(Number(partial.order)) ? Number(partial.order) : 0,
    status: partial.status || "active",
    archivedAt: partial.archivedAt,
    archivedBy: partial.archivedBy,
    createdAt: partial.createdAt || now,
    updatedAt: now
  };
}

const DEFAULT_ARCHIVE_CONTENT_TYPE_DEFINITIONS = [
  {
    id: "type_raw-footage",
    name: "مواد خام",
    nameEn: "raw-footage",
    icon: "🎞️",
    color: "#14b8a6",
    fields: [
      { id: "field_raw_local_file", label: "الملف المحلي", storageKey: "localFile", type: "localFile", order: 0, description: "اختر الملف الأصلي من الجهاز لحفظ بياناته داخل المادة." },
      { id: "field_raw_source", label: "المصدر", storageKey: "source", type: "text", order: 1 },
      { id: "field_raw_recorded_at", label: "تاريخ التسجيل", storageKey: "recordedAt", type: "date", order: 2 }
    ],
    subtypes: ["لقطة ميدانية", "B-roll", "أرشيف قديم"]
  },
  {
    id: "type_interviews",
    name: "مقابلات",
    nameEn: "interviews",
    icon: "🎙️",
    color: "#10b981",
    fields: [
      { id: "field_interview_local_file", label: "ملف المقابلة", storageKey: "localFile", type: "localFile", order: 0 },
      { id: "field_interview_guest", label: "الضيف", storageKey: "guest", type: "text", order: 1 },
      { id: "field_interview_location", label: "الموقع", storageKey: "location", type: "text", order: 2 },
      { id: "field_interview_rating", label: "تقييم المقابلة", storageKey: "rating", type: "rating", order: 3 }
    ],
    subtypes: ["كاملة", "مقتطفات", "عن بعد"]
  },
  {
    id: "type_reports",
    name: "تقارير",
    nameEn: "reports",
    icon: "🧾",
    color: "#3b82f6",
    fields: [
      { id: "field_report_local_file", label: "ملف التقرير", storageKey: "localFile", type: "localFile", order: 0 },
      { id: "field_report_subject", label: "الموضوع", storageKey: "subject", type: "text", order: 1 },
      { id: "field_report_status", label: "الحالة", storageKey: "status", type: "select", options: ["مسودة", "جاهز", "منشور"], order: 2 },
      { id: "field_report_review_status", label: "حالة المراجعة", storageKey: "reviewStatus", type: "select", options: ["يحتاج مراجعة", "قيد المراجعة", "معتمد"], order: 3 }
    ],
    subtypes: ["إخباري", "تحقيقي", "تحليلي"]
  },
  {
    id: "type_programs",
    name: "برامج وحلقات",
    nameEn: "programs",
    icon: "📺",
    color: "#8b5cf6",
    fields: [
      { id: "field_program_local_file", label: "ملف الحلقة", storageKey: "localFile", type: "localFile", order: 0 },
      { id: "field_program_name", label: "اسم البرنامج", storageKey: "programName", type: "text", order: 1 },
      { id: "field_episode_number", label: "رقم الحلقة", storageKey: "episodeNumber", type: "number", order: 2 },
      { id: "field_program_rating", label: "تقييم الحلقة", storageKey: "rating", type: "rating", order: 3 },
      { id: "field_program_review_status", label: "حالة المراجعة", storageKey: "reviewStatus", type: "select", options: ["يحتاج مراجعة", "قيد المراجعة", "معتمد"], order: 4 }
    ],
    subtypes: ["حلقة كاملة", "برومو", "مقطع من الحلقة"]
  },
  {
    id: "type_social-clips",
    name: "مقاطع قصيرة",
    nameEn: "social-clips",
    icon: "⚡",
    color: "#f59e0b",
    fields: [
      { id: "field_clip_local_file", label: "ملف المقطع", storageKey: "localFile", type: "localFile", order: 0 },
      { id: "field_clip_platform", label: "المنصة", storageKey: "platform", type: "select", options: ["YouTube", "TikTok", "Instagram", "X"], order: 1 },
      { id: "field_clip_rating", label: "تقييم المقطع", storageKey: "rating", type: "rating", order: 2 }
    ],
    subtypes: ["عمودي", "أفقي", "مربع"]
  },
  {
    id: "type_documents",
    name: "وثائق وملفات",
    nameEn: "documents",
    icon: "📁",
    color: "#6b7280",
    fields: [
      { id: "field_document_local_file", label: "الملف المحلي", storageKey: "localFile", type: "localFile", order: 0 },
      { id: "field_document_owner", label: "الجهة المالكة", storageKey: "owner", type: "text", order: 1 }
    ],
    subtypes: ["مستند داعم", "صورة مصغرة", "ملف مشروع"]
  }
];

export function getDefaultArchiveContentTypes() {
  return DEFAULT_ARCHIVE_CONTENT_TYPE_DEFINITIONS.map((type, typeIndex) => createContentTypeValue({
    ...type,
    order: typeIndex,
    fields: (type.fields || []).map((field) => createCustomFieldValue(field)),
    subtypes: (type.subtypes || []).map((name, subtypeIndex) => createSubtypeValue({
      id: `${type.id}_subtype_${subtypeIndex + 1}`,
      name,
      order: subtypeIndex
    }))
  }));
}

export function getMissingDefaultArchiveContentTypes(contentTypes = []) {
  const existingKeys = new Set((contentTypes || []).flatMap((type) => [
    type.id,
    normalizeArabicSearchText(type.name),
    normalizeArabicSearchText(type.nameEn)
  ].filter(Boolean)));

  return getDefaultArchiveContentTypes().filter((type) => !existingKeys.has(type.id)
    && !existingKeys.has(normalizeArabicSearchText(type.name))
    && !existingKeys.has(normalizeArabicSearchText(type.nameEn)));
}

export function parseFieldOptions(value = "") {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value).split(/[,،\n]/).map((item) => item.trim()).filter(Boolean);
}

const ARABIC_SLUG_WORDS = new Map([
  ["تقارير", "reports"],
  ["تقرير", "report"],
  ["يومي", "daily"],
  ["يومية", "daily"],
  ["مقابلات", "interviews"],
  ["مقابلة", "interview"],
  ["محاضرات", "lectures"],
  ["محاضرة", "lecture"],
  ["أخبار", "news"],
  ["خبر", "news"],
  ["صور", "photos"],
  ["صورة", "photo"],
  ["مستندات", "documents"],
  ["مستند", "document"],
  ["وثائق", "documents"],
  ["وثيقة", "document"],
  ["مواد", "assets"],
  ["مادة", "asset"],
  ["خام", "raw"],
  ["مشاريع", "projects"],
  ["مشروع", "project"]
]);

const FIELD_OPTION_TYPES = new Set(["select", "tags", "radio", "multiselect"]);
const VALUE_COMPATIBLE_FIELD_TYPES = new Set(["text", "textarea", "tags", "select", "multiselect", "radio"]);

function typeComparableKey(value = "") {
  return normalizeArabicSearchText(value).trim();
}

function getAllTypeFields(type = {}) {
  return [
    ...(Array.isArray(type.fields) ? type.fields : []),
    ...(Array.isArray(type.subtypes) ? type.subtypes.flatMap((subtype) => subtype.fields || []) : [])
  ];
}

function suggestWords(value = "") {
  const normalized = String(value || "").trim();
  if (!normalized) return [];
  if (typeComparableKey(normalized) === "تقارير يومية") return ["daily", "reports"];
  return normalized.split(/[\s_-]+/).map((word) => {
    const cleaned = word.replace(/[^\p{L}\p{N}]+/gu, "");
    return ARABIC_SLUG_WORDS.get(cleaned) || cleaned.normalize("NFKD").replace(/[^\w-]+/g, "");
  }).filter(Boolean);
}

export function suggestSafeTypeSlug(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "content-type";
  const words = suggestWords(raw);
  const slug = words.join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || normalizeFieldStorageKey(raw).toLowerCase().replace(/_+/g, "-") || "content-type";
}

export function validateContentTypeDraft(draft = {}, {
  contentTypes = [],
  previousType = null,
  videoItems = []
} = {}) {
  const conflicts = [];
  const warnings = [];
  const draftId = draft.id || previousType?.id || "";
  const draftName = typeComparableKey(draft.name);
  const draftNameEn = typeComparableKey(draft.nameEn);
  const allFields = getAllTypeFields(draft);
  const fieldsByKey = new Map();
  const previousFieldsByKey = new Map(getAllTypeFields(previousType || {}).map((field) => [field.storageKey || field.name || field.id, field]));
  const fieldKeys = new Set();

  for (const type of contentTypes || []) {
    if (!type || type.id === draftId) continue;
    const sameName = draftName && typeComparableKey(type.name) === draftName;
    const sameNameEn = draftNameEn && typeComparableKey(type.nameEn) === draftNameEn;
    if (sameName || sameNameEn) {
      conflicts.push({
        code: "duplicate-type-name",
        severity: "error",
        message: "اسم النوع مستخدم بالفعل. اختر اسماً أو اسماً داخلياً مختلفاً.",
        field: sameName ? "name" : "nameEn"
      });
      break;
    }
  }

  if (!draftName) {
    conflicts.push({
      code: "missing-type-name",
      severity: "error",
      message: "اكتب اسم النوع قبل الحفظ.",
      field: "name"
    });
  }

  for (const field of allFields) {
    const key = field.storageKey || field.name || field.id;
    const normalizedKey = typeComparableKey(key);
    if (!normalizedKey) continue;
    fieldKeys.add(key);
    if (!fieldsByKey.has(normalizedKey)) fieldsByKey.set(normalizedKey, []);
    fieldsByKey.get(normalizedKey).push(field);

    if (FIELD_OPTION_TYPES.has(field.type) && Array.isArray(field.options) && field.options.some((option) => !String(option || "").trim())) {
      conflicts.push({
        code: "empty-field-option",
        severity: "error",
        fieldId: field.id,
        message: `حقل "${field.label || key}" يحتوي خياراً فارغاً. احذفه أو اكتب قيمة واضحة.`
      });
    }

    if (field.showWhen?.fieldKey && !fieldKeys.has(field.showWhen.fieldKey) && !allFields.some((other) => (other.storageKey || other.name || other.id) === field.showWhen.fieldKey)) {
      conflicts.push({
        code: "missing-showwhen-field",
        severity: "error",
        fieldId: field.id,
        message: `شرط إظهار "${field.label || key}" يشير إلى حقل غير موجود.`
      });
    }

    const previousField = previousFieldsByKey.get(key);
    if (previousField && previousField.type !== field.type) {
      const impact = analyzeFieldImpact(field, (videoItems || []).filter((item) => item.type === draftId));
      if (impact.affectedCount > 0 && (!VALUE_COMPATIBLE_FIELD_TYPES.has(previousField.type) || !VALUE_COMPATIBLE_FIELD_TYPES.has(field.type) || previousField.type !== field.type)) {
        warnings.push({
          code: "field-type-has-values",
          severity: "warning",
          fieldId: field.id,
          message: `تغيير نوع "${field.label || key}" يؤثر على ${impact.affectedCount} مادة لديها قيمة محفوظة.`,
          impact
        });
      }
    }
  }

  for (const [key, fields] of fieldsByKey.entries()) {
    if (fields.length > 1) {
      conflicts.push({
        code: "duplicate-field-key",
        severity: "error",
        fieldIds: fields.map((field) => field.id),
        message: `المفتاح الداخلي "${key}" مستخدم في أكثر من حقل. غيّر أحد المفاتيح.`
      });
    }
  }

  const all = [...conflicts, ...warnings];
  return {
    canSave: conflicts.length === 0,
    conflicts: all,
    errors: conflicts,
    warnings,
    suggestedNameEn: suggestSafeTypeSlug(draft.name || draft.nameEn)
  };
}

export function getFilteredContentTypes(contentTypes = [], query = "", includeArchived = false) {
  const normalizedQuery = normalizeArabicSearchText(query);
  return [...contentTypes]
    .filter((type) => includeArchived || type.status !== "archived")
    .filter((type) => {
      if (!normalizedQuery) return true;
      return [
        type.name,
        type.nameEn,
        type.id,
        ...(type.subtypes || []).map((subtype) => subtype.name)
      ].some((value) => normalizeArabicSearchText(value).includes(normalizedQuery));
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.name || "").localeCompare(String(b.name || ""), "ar"));
}

export function getTypeUsageCounts(contentTypes = [], videoItems = []) {
  return Object.fromEntries(contentTypes.map((type) => [
    type.id,
    videoItems.filter((item) => item.type === type.id && !item.isDeleted).length
  ]));
}

export function analyzeFieldImpact(field = {}, videoItems = []) {
  const key = getFieldKey(field);
  const affectedItems = (videoItems || []).filter((item) => {
    if (item?.isDeleted) return false;
    return hasMeaningfulFieldValue(item?.metadata?.[key]);
  });
  return {
    fieldId: field.id || key,
    key,
    label: field.label || key,
    affectedCount: affectedItems.length,
    sampleItems: affectedItems.slice(0, 5).map((item) => ({
      id: item.id,
      title: item.title || item.name || "مادة بدون عنوان",
      value: item?.metadata?.[key]
    }))
  };
}

export function analyzeTypeImpact(type = {}, videoItems = []) {
  const affectedItems = (videoItems || []).filter((item) => item.type === type.id && !item.isDeleted);
  const fields = type.fields || [];
  const fieldImpacts = fields.map((field) => analyzeFieldImpact(field, affectedItems));
  const subtypeCounts = Object.fromEntries((type.subtypes || []).map((subtype) => [
    subtype.id,
    affectedItems.filter((item) => item.subtype === subtype.id).length
  ]));
  const filledFieldCount = fieldImpacts.reduce((sum, impact) => sum + impact.affectedCount, 0);
  return {
    typeId: type.id,
    typeName: type.name || "نوع محتوى",
    affectedCount: affectedItems.length,
    filledFieldCount,
    fieldImpacts,
    subtypeCounts,
    sampleItems: affectedItems.slice(0, 6).map((item) => ({
      id: item.id,
      title: item.title || item.name || "مادة بدون عنوان",
      subtype: item.subtype || ""
    }))
  };
}

export function getFieldsForSelection(contentTypes = [], typeId, subtypeId) {
  const type = contentTypes.find((item) => item.id === typeId);
  if (!type) return [];
  const subtype = (type.subtypes || []).find((item) => item.id === subtypeId);
  return [
    ...(type.fields || []),
    ...((subtype?.fields || []))
  ].filter((field) => field.status !== "archived" && !field.hidden)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
