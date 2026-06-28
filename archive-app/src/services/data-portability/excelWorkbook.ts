import {
  appendArchiveExcelPayloadSheet,
  createTransferPackage
} from "./packageOperations.js";

function defaultIconSpec(iconSpec: any, fallbackIcon = "📁"): any {
  if (iconSpec && typeof iconSpec === "object") return iconSpec;
  return { type: "emoji", value: fallbackIcon };
}

export function createArchiveExcelWorkbook(XLSX: any, state: any = {}, helpers: any = {}): any {
  const {
    isArchivedRecord = (record: any) => Boolean(record?.archivedAt || record?.isArchived),
    getFieldStorageKey = (field: any) => field?.id || field?.name || field?.label || "",
    getMetadataValue = (item: any, field: any) => item?.metadata?.[getFieldStorageKey(field)],
    getVisibleFields = (fields: any[] = []) => fields.filter((field) => !isArchivedRecord(field)),
    normalizeIconSpec = defaultIconSpec,
    buildHierarchicalTagPath = (tag: any) => tag?.name || "",
    fieldTypeLabels = {}
  } = helpers;

  const {
    contentTypes = [],
    videoItems = [],
    bookmarks = [],
    relations = [],
    virtualCollections = [],
    vocabulary = [],
    hierarchicalTags = [],
    users = [],
    auditLogs = [],
    changeHistory = []
  } = state;

  const workbook = XLSX.utils.book_new();
  workbook.Workbook = { Views: [{ RTL: true }] };
  workbook.Props = {
    Title: "Video Archive Export",
    Subject: "Video archive data export",
    Author: "Video Archive",
    CreatedDate: new Date()
  };

  const typeById = new Map<string, any>(contentTypes.map((type: any): [string, any] => [type.id, type]));
  const itemById = new Map<string, any>(videoItems.map((item: any): [string, any] => [item.id, item]));
  const usedSheetNames = new Set<string>();
  const sheetIndex: any[] = [];

  const safeSheetName = (name: any) => {
    const base = String(name || "ورقة").replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "ورقة";
    let candidate = base;
    let index = 2;
    while (usedSheetNames.has(candidate)) {
      const suffix = ` ${index++}`;
      candidate = base.slice(0, 31 - suffix.length) + suffix;
    }
    usedSheetNames.add(candidate);
    return candidate;
  };

  const formatCell = (value: any, field: any) => {
    if (value === void 0 || value === null) return "";
    if (Array.isArray(value)) return value.join("، ");
    if (field?.type === "checkbox") return value ? "نعم" : "لا";
    if (field?.type === "select" || field?.type === "radio") {
      const option = field.options?.find((item: any) => item.value === value);
      return option?.label || String(value);
    }
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const formatDateCell = (value: any) => value ? new Date(value).toLocaleString("ar-EG") : "";

  const getSubtypeNameForItem = (item: any) => {
    const type = typeById.get(item.type);
    return type?.subtypes?.find((subtype: any) => subtype.id === item.subtype)?.name || item.subtype || "";
  };

  const collectFieldsForItems = (items: any[]) => {
    const seen = new Map<string, any>();
    items.forEach((item: any) => {
      const type = typeById.get(item.type);
      const subtype = type?.subtypes?.find((sub: any) => sub.id === item.subtype);
      [...(type?.fields || []), ...(subtype?.fields || [])].forEach((field: any) => {
        const key = getFieldStorageKey(field);
        if (key && !seen.has(key)) seen.set(key, field);
      });
    });
    return Array.from(seen.values());
  };

  const buildRows = (items: any[]) => {
    const fields = collectFieldsForItems(items);
    return items.map((item: any) => {
      const type = typeById.get(item.type);
      const row: Record<string, any> = {
        "المعرف": item.id,
        "العنوان": item.title,
        "النوع": type?.name || item.type,
        "حالة النوع": isArchivedRecord(type) ? "مؤرشف" : "نشط",
        "النوع الفرعي": getSubtypeNameForItem(item),
        "المسار": item.path || "",
        "الوسوم": Array.isArray(item.tags) ? item.tags.join("، ") : "",
        "ملاحظات": item.notes || "",
        "مفضّل": item.isFavorite ? "نعم" : "لا",
        "محذوف": item.isDeleted ? "نعم" : "لا",
        "تاريخ الإنشاء": formatDateCell(item.createdAt),
        "تاريخ التحديث": formatDateCell(item.updatedAt)
      };
      fields.forEach((field: any) => {
        const label = `${field.label || field.name}${isArchivedRecord(field) ? " (مؤرشف)" : ""}`;
        row[label] = formatCell(getMetadataValue(item, field), field);
      });
      return row;
    });
  };

  const appendSheet = (name: any, rows: any[]) => {
    const sheetName = safeSheetName(name);
    const worksheet = rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([["لا توجد بيانات"]]);
    worksheet["!rtl"] = true;
    const headers = rows.length ? Object.keys(rows[0]) : ["لا توجد بيانات"];
    worksheet["!cols"] = headers.map((header) => {
      const maxValueLength = rows.slice(0, 100).reduce((max, row) => Math.max(max, String(row?.[header] ?? "").length), String(header).length);
      return { wch: Math.min(Math.max(maxValueLength + 3, 14), 52) };
    });
    if (rows.length) {
      worksheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: headers.length - 1 } }) };
    }
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    sheetIndex.push({ "الورقة": sheetName, "عدد الصفوف": rows.length });
  };

  const getProgramName = (item: any) => {
    const parent = item.parentId ? itemById.get(item.parentId) : null;
    if (parent?.title) return parent.title;
    const metadata = item.metadata || {};
    const explicitKey = Object.keys(metadata).find((key) => {
      const normalized = key.toLowerCase();
      return normalized.includes("program") || normalized.includes("series") || key.includes("برنامج");
    });
    const value = explicitKey ? metadata[explicitKey] : "";
    if (Array.isArray(value)) return value[0] || "";
    return value ? String(value) : "";
  };

  appendSheet("01_كل_العناصر", buildRows(videoItems));
  contentTypes.forEach((type: any) => {
    const items = videoItems.filter((item: any) => item.type === type.id);
    if (items.length) appendSheet(`نوع_${type.name}`, buildRows(items));
    (type.subtypes || []).forEach((subtype: any) => {
      const subtypeItems = items.filter((item: any) => item.subtype === subtype.id);
      if (subtypeItems.length) appendSheet(`فرعي_${type.name}_${subtype.name}`, buildRows(subtypeItems));
    });
  });

  const programGroups = videoItems.reduce((groups: Map<string, any[]>, item: any) => {
    const programName = getProgramName(item);
    if (!programName) return groups;
    if (!groups.has(programName)) groups.set(programName, []);
    groups.get(programName)!.push(item);
    return groups;
  }, new Map<string, any[]>());
  programGroups.forEach((items: any[], programName: string) => appendSheet(`برنامج_${programName}`, buildRows(items)));

  const fieldRows = contentTypes.flatMap((type: any) => [
    ...(type.fields || []).map((field: any) => ({ type, subtype: null, field })),
    ...(type.subtypes || []).flatMap((subtype: any) => (subtype.fields || []).map((field: any) => ({ type, subtype, field })))
  ]).map(({ type, subtype, field }: any) => ({
    "النوع": type.name,
    "النوع الفرعي": subtype?.name || "",
    "الحقل": field.label,
    "مفتاح التخزين": getFieldStorageKey(field),
    "نوع الحقل": fieldTypeLabels[field.type]?.ar || field.type,
    "مطلوب": field.required ? "نعم" : "لا",
    "قابل للبحث": field.searchable ? "نعم" : "لا",
    "متعدد القيم": field.multiple ? "نعم" : "لا",
    "مصادر الاستدعاء": field.type === "url" ? "" : "القاموس @، الوسوم #",
    "الخيارات": Array.isArray(field.options) ? field.options.map((option: any) => option.label ? `${option.label} (${option.value})` : option.value).join("، ") : "",
    "وصف الحقل": field.description || "",
    "الحالة": isArchivedRecord(field) ? "مؤرشف" : "نشط"
  }));

  appendSheet("أنواع المحتوى", contentTypes.map((type: any) => ({
    "المعرف": type.id,
    "الاسم": type.name,
    "الأيقونة": type.icon || "",
    "نوع الأيقونة": normalizeIconSpec(type.iconSpec, type.icon || "📁").type,
    "قيمة الأيقونة": normalizeIconSpec(type.iconSpec, type.icon || "📁").value,
    "مصدر الأيقونة": normalizeIconSpec(type.iconSpec, type.icon || "📁").sourceName || "",
    "اللون": type.color || "",
    "له غلاف": type.coverImage ? "نعم" : "لا",
    "قيمة الغلاف": type.coverImage ? String(type.coverImage).startsWith("data:") ? "صورة مضمنة" : type.coverImage : "",
    "وضع الغلاف": type.coverFit || "cover",
    "اسم ملف الغلاف": type.coverSourceName || "",
    "تاريخ تحديث الغلاف": formatDateCell(type.coverUpdatedAt),
    "الحالة": isArchivedRecord(type) ? "مؤرشف" : "نشط",
    "عدد الحقول": getVisibleFields(type.fields || []).length,
    "عدد الحقول المؤرشفة": (type.fields || []).filter((field: any) => isArchivedRecord(field)).length,
    "عدد الأنواع الفرعية": getVisibleFields(type.subtypes || []).length
  })));

  appendSheet("الأنواع_الفرعية", contentTypes.flatMap((type: any) => (type.subtypes || []).map((subtype: any) => ({
    "معرف النوع": type.id,
    "النوع": type.name,
    "معرف النوع الفرعي": subtype.id,
    "الاسم": subtype.name,
    "الاسم بالإنجليزية": subtype.nameEn || "",
    "الأيقونة": subtype.icon || "",
    "نوع الأيقونة": normalizeIconSpec(subtype.iconSpec, subtype.icon || type.icon || "📁").type,
    "قيمة الأيقونة": normalizeIconSpec(subtype.iconSpec, subtype.icon || type.icon || "📁").value,
    "مصدر الأيقونة": normalizeIconSpec(subtype.iconSpec, subtype.icon || type.icon || "📁").sourceName || "",
    "له غلاف": subtype.coverImage ? "نعم" : "لا",
    "قيمة الغلاف": subtype.coverImage ? String(subtype.coverImage).startsWith("data:") ? "صورة مضمنة" : subtype.coverImage : "",
    "وضع الغلاف": subtype.coverFit || "cover",
    "اسم ملف الغلاف": subtype.coverSourceName || "",
    "تاريخ تحديث الغلاف": formatDateCell(subtype.coverUpdatedAt),
    "الحالة": isArchivedRecord(subtype) ? "مؤرشف" : "نشط",
    "عدد الحقول": getVisibleFields(subtype.fields || []).length,
    "عدد الحقول المؤرشفة": (subtype.fields || []).filter((field: any) => isArchivedRecord(field)).length
  }))));

  appendSheet("تعريفات_الحقول", fieldRows);

  if (bookmarks.length > 0) {
    appendSheet("الإشارات المرجعية", bookmarks.map((bookmark: any) => ({
      "المعرف": bookmark.id,
      "معرف العنصر": bookmark.itemId,
      "الطابع الزمني": bookmark.timestamp,
      "التسمية": bookmark.label,
      "الوصف": bookmark.description || "",
      "تاريخ الإنشاء": formatDateCell(bookmark.createdAt)
    })));
  }

  if (relations.length > 0) {
    appendSheet("العلاقات", relations.map((relation: any) => ({
      "المعرف": relation.id,
      "المصدر": relation.sourceId,
      "الهدف": relation.targetId,
      "نوع العلاقة": relation.relationType,
      "التسمية": relation.label || ""
    })));
  }

  if (virtualCollections.length > 0) {
    appendSheet("المجموعات", virtualCollections.map((collection: any) => ({
      "نوع المجموعة": collection.type || "manual",
      "المعرف": collection.id,
      "الاسم": collection.name,
      "الوصف": collection.description || "",
      "عدد العناصر": collection.itemIds?.length || 0,
      "معرفات العناصر": Array.isArray(collection.itemIds) ? collection.itemIds.join(", ") : "",
      "الأيقونة": collection.icon || "",
      "نوع الأيقونة": normalizeIconSpec(collection.iconSpec, collection.icon || "📁").type,
      "قيمة الأيقونة": normalizeIconSpec(collection.iconSpec, collection.icon || "📁").value,
      "مصدر الأيقونة": normalizeIconSpec(collection.iconSpec, collection.icon || "📁").sourceName || "",
      "اللون": collection.color || "",
      "له غلاف": collection.coverImage ? "نعم" : "لا",
      "قيمة الغلاف": collection.coverImage ? String(collection.coverImage).startsWith("data:") ? "صورة مضمنة" : collection.coverImage : "",
      "وضع الغلاف": collection.coverFit || "cover",
      "اسم ملف الغلاف": collection.coverSourceName || "",
      "تاريخ تحديث الغلاف": formatDateCell(collection.coverUpdatedAt),
      "قواعد المجموعة الذكية": collection.filterRules ? JSON.stringify(collection.filterRules) : ""
    })));
  }

  if (vocabulary.length > 0) {
    appendSheet("المصطلحات", vocabulary.map((entry: any) => ({
      "المعرف": entry.id,
      "المصطلح": entry.term,
      "الفئة": entry.category,
      "الوصف": entry.description || "",
      "الأسماء البديلة": entry.aliases?.join("، ") || ""
    })));
  }

  if (hierarchicalTags.length > 0) {
    const tagMap = new Map(hierarchicalTags.map((tag: any) => [tag.id, tag]));
    appendSheet("الوسوم الهرمية", hierarchicalTags.map((tag: any) => ({
      "المعرف": tag.id,
      "الاسم": tag.name,
      "المسار الكامل": buildHierarchicalTagPath(tag, tagMap),
      "الوالد": tag.parentId || "",
      "اللون": tag.color || "",
      "الترتيب": tag.order
    })));
  }

  appendSheet("المستخدمون", users.map((user: any) => ({
    "المعرف": user.id,
    "اسم المستخدم": user.username,
    "الاسم المعروض": user.displayName,
    "الدور": user.role,
    "نشط": user.isActive ? "نعم" : "لا",
    "آخر دخول": formatDateCell(user.lastLoginAt),
    "تاريخ الإنشاء": formatDateCell(user.createdAt)
  })));

  if (auditLogs.length > 0) {
    appendSheet("سجل المراجعة", auditLogs.slice(0, 5000).map((log: any) => ({
      "المعرف": log.id,
      "المستخدم": log.username,
      "نوع الحدث": log.eventType,
      "الهدف": log.targetId || "",
      "التفاصيل": log.details || "",
      "التاريخ": formatDateCell(log.timestamp)
    })));
  }

  if (changeHistory.length > 0) {
    appendSheet("سجل التغييرات", changeHistory.slice(0, 5000).map((history: any) => ({
      "المعرف": history.id,
      "معرف العنصر": history.itemId || "",
      "الإجراء": history.action || "",
      "العنوان القديم": history.oldValue?.title || "",
      "العنوان الجديد": history.newValue?.title || "",
      "القيمة القديمة": history.oldValue ? JSON.stringify(history.oldValue) : "",
      "القيمة الجديدة": history.newValue ? JSON.stringify(history.newValue) : "",
      "التاريخ": formatDateCell(history.timestamp)
    })));
  }

  const exportChecksum = createTransferPackage(state, "Excel").checksum;
  const indexSheet = XLSX.utils.json_to_sheet([
    { "الورقة": "تاريخ التصدير", "عدد الصفوف": formatDateCell(new Date().toISOString()) },
    { "الورقة": "Checksum", "عدد الصفوف": exportChecksum },
    { "الورقة": "إجمالي المواد", "عدد الصفوف": videoItems.length },
    { "الورقة": "أنواع المحتوى", "عدد الصفوف": contentTypes.length },
    { "الورقة": "المجموعات", "عدد الصفوف": virtualCollections.length },
    { "الورقة": "المصطلحات", "عدد الصفوف": vocabulary.length },
    { "الورقة": "الوسوم الهرمية", "عدد الصفوف": hierarchicalTags.length },
    { "الورقة": "سجل التغييرات", "عدد الصفوف": changeHistory.length },
    { "الورقة": "سجل المراجعة", "عدد الصفوف": auditLogs.length },
    ...sheetIndex
  ]);
  indexSheet["!rtl"] = true;
  indexSheet["!cols"] = [{ wch: 32 }, { wch: 72 }];
  XLSX.utils.book_append_sheet(workbook, indexSheet, "00_الفهرس", true);
  workbook.SheetNames = ["00_الفهرس", ...workbook.SheetNames.filter((name: string) => name !== "00_الفهرس")];

  appendArchiveExcelPayloadSheet(XLSX, workbook, state);
  return { workbook, sheetIndex, checksum: exportChecksum };
}
