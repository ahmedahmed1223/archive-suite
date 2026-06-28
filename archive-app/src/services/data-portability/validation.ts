export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateBackupData(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["البيانات ليست كائن صالح"] };
  }

  const obj = data as Record<string, any>;
  const version = obj.version;
  const isV2 = version === "2.0";

  if (!Array.isArray(obj.contentTypes)) {
    if (!isV2 || !obj.bookmarks) {
      errors.push("أنواع المحتوى مفقودة أو ليست مصفوفة");
    }
  } else {
    for (const type of obj.contentTypes) {
      if (!type || typeof type !== "object") continue;
      if (!type.id || typeof type.id !== "string") {
        errors.push(`نوع محتوى بدون معرف: ${JSON.stringify(type).substring(0, 50)}`);
      }
      if (!type.name || typeof type.name !== "string") {
        errors.push(`نوع محتوى بدون اسم: ${type.id}`);
      }
      if (!Array.isArray(type.fields)) {
        errors.push(`نوع محتوى "${type.id}" بدون حقول صالحة`);
      }
      if (!Array.isArray(type.subtypes)) {
        errors.push(`نوع محتوى "${type.id}" بدون أنواع فرعية صالحة`);
      }
    }
  }

  if (!Array.isArray(obj.videoItems)) {
    if (!isV2 || !obj.bookmarks) {
      errors.push("عناصر الفيديو مفقودة أو ليست مصفوفة");
    }
  } else {
    for (const item of obj.videoItems) {
      if (!item || typeof item !== "object") continue;
      if (!item.id || typeof item.id !== "string") errors.push("عنصر فيديو بدون معرف");
      if (!item.type || typeof item.type !== "string") errors.push(`عنصر فيديو "${item.id}" بدون نوع`);
      if (!item.title || typeof item.title !== "string") errors.push(`عنصر فيديو "${item.id}" بدون عنوان`);
    }
  }

  if (isV2) {
    if (obj.bookmarks !== void 0 && !Array.isArray(obj.bookmarks)) errors.push("الإشارات المرجعية ليست مصفوفة");
    if (obj.relations !== void 0 && !Array.isArray(obj.relations)) errors.push("العلاقات ليست مصفوفة");
    if (obj.virtualCollections !== void 0 && !Array.isArray(obj.virtualCollections)) errors.push("المجموعات الافتراضية ليست مصفوفة");
    if (obj.vocabulary !== void 0 && !Array.isArray(obj.vocabulary)) errors.push("المصطلحات ليست مصفوفة");
    if (obj.hierarchicalTags !== void 0 && !Array.isArray(obj.hierarchicalTags)) errors.push("الوسوم الهرمية ليست مصفوفة");
    if (obj.auditLogs !== void 0 && !Array.isArray(obj.auditLogs)) errors.push("سجل المراجعة ليس مصفوفة");
  }

  return { valid: errors.length === 0, errors };
}
