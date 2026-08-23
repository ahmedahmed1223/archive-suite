export const safetyPreview = {
  syntheticBadge: "بيانات تجريبية",
  operationLabels: { delete: "حذف تجريبي", restore: "استعادة تجريبية" },
  errors: {
    loadScenarios: "تعذر تحميل سيناريوهات المحاكاة.",
    noIdentifiers: "أدخل معرفًا تجريبيًا واحدًا على الأقل.",
    runPreview: "تعذر تشغيل المحاكاة."
  },
  results: {
    conflict: "تعارض",
    notFound: "غير موجود",
    simulated: "تمت المحاكاة",
    unchanged: "دون تغيير",
    conflictDetail: "لا يمكن استعادة المعرف لأن نسخة حية منه موجودة في البيئة الاصطناعية.",
    notFoundDetail: "المعرف غير موجود في بيانات المحاكاة الاصطناعية.",
    simulatedDetail: "تمت المحاكاة دون أي أثر على الإنتاج."
  },
  toolbar: {
    eyebrow: "محاكاة تجريبية",
    title: "مساحة معاينة السلامة",
    description: "محاكاة محمية تستخدم بيانات اصطناعية فقط؛ لا تُحذف أو تُستعاد أي بيانات إنتاجية.",
    refresh: "تحديث السيناريوهات",
    safetyAction: "تشغيل محاكاة حذف أو استعادة"
  },
  controls: {
    ariaLabel: "ضوابط محاكاة السلامة",
    title: "ضوابط المحاكاة",
    description: "كل المعرفات والنتائج داخل بيئة اصطناعية مؤقتة.",
    unauthorizedTitle: "لا تملك صلاحية تشغيل المحاكاة",
    unauthorizedDescription: "يمكن للمشاهد مراجعة السياسة فقط، بينما التشغيل متاح للمحرر أو المدير.",
    scenario: "السيناريو",
    operation: "العملية",
    identifiers: "المعرفات التجريبية",
    loading: "جارٍ التحميل...",
    running: "جارٍ تشغيل المحاكاة...",
    run: "تشغيل المحاكاة"
  },
  metrics: {
    ariaLabel: "مقارنة العدادات الاصطناعية",
    liveBefore: "الحي قبل",
    liveAfter: "الحي بعد",
    trashBefore: "السلة قبل",
    trashAfter: "السلة بعد"
  },
  table: {
    sectionAriaLabel: "نتائج المحاكاة الاصطناعية",
    title: "نتائج المحاكاة",
    expiresAt: "تنتهي المعاينة في {time}",
    tableAriaLabel: "نتائج عناصر المحاكاة",
    identifier: "المعرف",
    result: "النتيجة",
    details: "التفاصيل"
  }
} as const;
