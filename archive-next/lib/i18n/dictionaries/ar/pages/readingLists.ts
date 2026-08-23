export const readingLists = {
  toolbar: {
    eyebrow: "قوائم القراءة",
    title: "قوائم القراءة",
    description: "مساحة تشغيلية لتجميع سجلات تحتاج مراجعة أو قراءة لاحقة، مستقلة عن المجموعات حتى لا تختلط مع التصنيف الرسمي.",
    listCount: "{count} قائمة",
    remainingCount: "{count} متبقٍ",
    completedCount: "{count} مكتمل",
    officialCollections: "المجموعات الرسمية"
  },
  create: { name: "اسم القائمة", description: "وصف مختصر", submit: "إنشاء قائمة" },
  deleteDialog: { title: "حذف قائمة القراءة", message: "سيتم حذف القائمة «{name}» وكل عناصرها ({count} عنصر) نهائيًا. هل تريد المتابعة؟", confirm: "حذف" },
  errors: { recordsLoad: "تعذر تحميل سجلات الأرشيف" },
  empty: { title: "لا توجد قوائم قراءة.", description: "أنشئ قائمة لتجميع سجلات تريد مراجعتها لاحقًا." },
  layout: {
    ariaLabel: "قوائم القراءة",
    listsTitle: "القوائم",
    itemCount: "{count} عنصر",
    remove: "حذف",
    addRecord: "إضافة سجل",
    selectRecord: "اختر سجلًا...",
    add: "إضافة",
    emptyListTitle: "القائمة فارغة.",
    emptyListDescription: "أضف سجلًا من القائمة العلوية لبدء المتابعة.",
    completed: "مكتمل",
    remaining: "متبقٍ",
    record: "سجل",
    addedAt: "أضيف في {date}",
    markUnread: "إلغاء الاكتمال",
    markRead: "تمت القراءة",
    openRecord: "فتح السجل",
    removeItem: "إزالة",
    noActiveTitle: "اختر قائمة.",
    noActiveDescription: "حدد قائمة من العمود الجانبي لإدارة عناصرها."
  }
} as const;
