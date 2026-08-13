export const metadataTemplates = {
  errors: {
    loadTemplates: "تعذر تحميل مكتبة القوالب.",
    saveFieldOwners: "تعذر حفظ مالكية الحقول.",
    invalidFields: "حقول القالب يجب أن تكون كائن JSON صالحًا.",
    saveTemplate: "تعذر حفظ القالب.",
    loadVersions: "تعذر تحميل إصدارات القالب.",
    toggleTemplate: "تعذر تغيير حالة القالب.",
    publishTemplate: "تعذر نشر القالب.",
    restorePublished: "تعذر استعادة الإصدار المنشور."
  },
  toolbar: {
    eyebrow: "إدارة مركزية",
    title: "مكتبة قوالب الأقسام",
    description: "قوالب قابلة لإعادة الاستخدام حسب القسم، مع أدوار استخدام وإصدارات محفوظة. تعديل قالب لا يغيّر أي مادة محفوظة سابقًا.",
    settings: "الإعدادات",
    departmentFilter: "تصفية القسم",
    departmentPlaceholder: "مثال: news"
  },
  form: {
    editTitle: "تعديل القالب",
    newTitle: "قالب قسم جديد",
    description: "اختر القسم قبل الحفظ وحدد من يستطيع استعماله.",
    newTemplate: "قالب جديد",
    name: "الاسم",
    owningDepartment: "القسم المالك",
    itemType: "نوع المادة (اختياري)",
    defaultTags: "الوسوم الافتراضية",
    tagsPlaceholder: "خبر، عاجل",
    usageRoles: "أدوار الاستخدام",
    defaultFields: "الحقول الافتراضية (JSON)",
    enabled: "متاح للاستخدام",
    saveVersion: "حفظ إصدار جديد",
    createTemplate: "إنشاء القالب"
  },
  available: {
    title: "القوالب المتاحة",
    description: "يعرض المستخدم فقط القوالب التي يسمح بها دوره؛ ويرى المحرر أيضًا القوالب المعطّلة لإدارتها.",
    emptyTitle: "لا توجد قوالب لهذا القسم.",
    emptyDescription: "غيّر التصفية أو أضف أول قالب للقسم.",
    department: "القسم: {department}",
    general: "عام",
    draft: "المسودة {version}",
    published: "المنشور {version}",
    noTags: "بلا وسوم",
    tagSeparator: "، ",
    enabled: "مفعل",
    disabled: "معطل",
    versions: "الإصدارات",
    publishDraft: "نشر المسودة",
    edit: "تعديل",
    disable: "تعطيل",
    enable: "تفعيل"
  },
  preview: {
    title: "معاينة القيم والإصدارات",
    description: "المعاينة للقراءة فقط؛ لا تكتب أي بيانات في مادة قبل قرار المستخدم.",
    empty: "اختر «تعديل» لمعاينة قيم القالب الحالية.",
    version: "الإصدار {version}",
    restore: "استعادة كنشر"
  },
  metrics: {
    title: "مؤشرات القسم",
    templates: "{count} قالب",
    published: "{count} منشور",
    qualityRules: "{count} قاعدة جودة",
    records: "{count} مادة",
    missingFields: "الحقول الناقصة: {fields}",
    noEnabledRules: "لا توجد قواعد مفعلة"
  },
  owners: {
    title: "مالكية الحقول",
    description: "يُقترح المسؤول في طلبات المعلومات؛ لا يمنع ذلك المحرر المخوّل من التصحيح أو الإسناد الصريح.",
    fieldPlaceholder: "اسم الحقل أو * لكل الحقول",
    assigneePlaceholder: "المسؤول",
    save: "حفظ المسؤول",
    remove: "إزالة"
  },
  quality: {
    loadError: "تعذر تحميل قواعد الجودة.", saveSuccess: "حُفظت قاعدة الجودة.", saveError: "تعذر حفظ القاعدة.", previewError: "تعذرت المعاينة.", selectDepartment: "اختر القسم لعرض قواعد الجودة الخاصة به.", title: "جودة القسم", description: "المعاينة تشرح سبب عدم الجاهزية ولا تمنع تعديل السجل.", rules: "{count} قاعدة", itemType: "نوع المادة", requiredFields: "الحقول المطلوبة", requiredFieldsPlaceholder: "summary, date", previewMissing: "معاينة النقص", saveRule: "حفظ القاعدة", ready: "جاهز وفق القاعدة.", notReady: "غير جاهز: {fields}", fieldSeparator: "، "
  }
} as const;
