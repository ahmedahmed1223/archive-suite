export const graph = {
  unavailableDate: "غير محدد",
  canvasAriaLabel: "خريطة علاقات السجلات",
  nodePanel: { emptyTitle: "تفاصيل العقدة", emptyDescription: "اختر عقدة من الرسم لعرض روابطها وتفاصيلها التشغيلية.", record: "سجل", connections: "{count} صلات", identifier: "المعرف", lastUpdated: "آخر تحديث", openRecord: "فتح السجل", nearbyLinks: "الروابط القريبة", deleteRelation: "حذف العلاقة", noVisibleLinks: "لا توجد روابط ظاهرة ضمن الفلاتر الحالية." },
  relationForm: { sourceTargetRequired: "اختر مصدر العلاقة والهدف.", selfRelation: "لا يمكن ربط السجل بنفسه.", saved: "تم حفظ العلاقة.", saveFailed: "تعذر حفظ العلاقة.", title: "إضافة علاقة يدوية", from: "من", sourcePlaceholder: "اختر السجل المصدر", type: "نوع العلاقة", to: "إلى", targetPlaceholder: "اختر السجل الهدف", note: "ملاحظة", notePlaceholder: "سبب العلاقة أو سياقها", save: "حفظ العلاقة" },
  errors: { load: "تعذر تحميل خريطة العلاقات.", save: "تعذر حفظ العلاقة.", delete: "تعذر حذف العلاقة." },
  toolbar: { eyebrow: "خريطة العلاقات", title: "خريطة العلاقات", description: "اربط مواد الأرشيف يدوياً، واستكشف الروابط المستنتجة من الوسوم والأنواع في مساحة واحدة.", nodes: "{count} عقدة", connections: "{count} صلة", manual: "{count} يدوية", inferred: "{count} مستنتجة", refresh: "تحديث", searchPlaceholder: "بحث داخل العقد", searchAriaLabel: "بحث داخل عقد خريطة العلاقات", tagFilterAriaLabel: "تصفية بالوسم", allTags: "كل الوسوم", layoutAriaLabel: "نمط التخطيط", layoutAuto: "تلقائي", layoutOrganic: "عضوي", layoutConcentric: "حلقات", layoutCircle: "دائرة" },
  lenses: { ariaLabel: "عدسات تجميع خريطة العلاقات حسب النوع", recordCount: "{count} سجل" },
  loading: "جارٍ تحميل خريطة العلاقات...",
  loadErrorTitle: "تعذر تحميل العلاقات",
  emptyGraph: { title: "لا توجد سجلات كافية لرسم العلاقات", description: "أضف مواد إلى الأرشيف ثم عد إلى هذه الصفحة لرؤية الشبكة.", addRecord: "إضافة سجل" },
  workspace: { ariaLabel: "مساحة خريطة العلاقات", allNetwork: "كل الشبكة", focusSelected: "تركيز على المحدد", loadMore: "تحميل أكثر", filteredNodes: "{count} عقدة ضمن الفلاتر الحالية", noMatchingNodes: "لا توجد عقد مطابقة", noMatchingNodesDescription: "خفف فلاتر النوع أو الوسم لرؤية الشبكة.", cannotCreate: "لا تملك صلاحية إنشاء علاقات جديدة بين السجلات." },
} as const;
