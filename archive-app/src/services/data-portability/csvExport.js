export function createArchiveCsvExportFiles(data = {}, helpers = {}) {
  const { isArchivedRecord = (record) => Boolean(record?.archivedAt || record?.isArchived) } = helpers;
  const {
    contentTypes = [],
    videoItems = [],
    virtualCollections = [],
    users = []
  } = data;
  const typeById = new Map(contentTypes.map((type) => [type.id, type]));

  return [
    {
      slug: "items",
      rows: videoItems.map((item) => ({
        "المعرف": item.id,
        "العنوان": item.title,
        "النوع": typeById.get(item.type)?.name || item.type || "",
        "النوع الفرعي": item.subtype || "",
        "المسار": item.path || "",
        "الوسوم": item.tags || [],
        "ملاحظات": item.notes || "",
        "مفضل": item.isFavorite ? "نعم" : "لا",
        "محذوف": item.isDeleted ? "نعم" : "لا",
        "الحقول": item.customFields || item.fieldValues || {},
        "تاريخ الإنشاء": item.createdAt || "",
        "تاريخ التحديث": item.updatedAt || ""
      }))
    },
    {
      slug: "content-types",
      rows: contentTypes.map((type) => ({
        "المعرف": type.id,
        "الاسم": type.name,
        "الوصف": type.description || "",
        "الأنواع الفرعية": type.subtypes?.length || 0,
        "الحقول": type.fields?.length || 0,
        "مؤرشف": isArchivedRecord(type) ? "نعم" : "لا"
      }))
    },
    {
      slug: "collections",
      rows: virtualCollections.map((collection) => ({
        "المعرف": collection.id,
        "الاسم": collection.name,
        "الوصف": collection.description || "",
        "عدد العناصر": collection.itemIds?.length || 0,
        "ذكية": collection.isSmart ? "نعم" : "لا"
      }))
    },
    {
      slug: "users",
      rows: users.map((user) => ({
        "المعرف": user.id,
        "اسم المستخدم": user.username,
        "الاسم المعروض": user.displayName,
        "الدور": user.role,
        "نشط": user.isActive ? "نعم" : "لا",
        "يتطلب إعادة تعيين": user.mustResetPassword || user.mustChangePassword ? "نعم" : "لا",
        "آخر دخول": user.lastLoginAt || "",
        "تاريخ الإنشاء": user.createdAt || ""
      }))
    }
  ];
}
