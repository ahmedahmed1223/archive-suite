export const plugins = {
  filters: {
    status: { all: "كل الحالات", reviewed: "مراجعة ومقبولة", draft: "مسودة", blocked: "محظورة" },
    category: { all: "كل الفئات", metadata: "بيانات وصفية", workflow: "سير عمل", ai: "ذكاء اصطناعي", integration: "تكامل" }
  },
  risk: { low: "منخفض", medium: "متوسط", high: "عالٍ" },
  boolean: { yes: "نعم", no: "لا" },
  policy: {
    unavailableTitle: "سياسة التشغيل",
    unavailableDescription: "لم تُحمّل سياسة التشغيل بعد.",
    ariaLabel: "سياسة تشغيل الإضافات",
    title: "سياسة التشغيل",
    remoteInstall: "التثبيت البعيد",
    codeExecution: "تنفيذ كود",
    adminReview: "مراجعة مسؤول"
  },
  permissions: {
    ariaLabel: "ملخص الصلاحيات",
    title: "الصلاحيات المطلوبة",
    description: "تجميع نطاقات الصلاحيات التي تطلبها الإضافات حتى تظهر المخاطر قبل أي اعتماد.",
    pluginCount: "{count} إضافات",
    emptyTitle: "لا توجد صلاحيات",
    emptyDescription: "غيّر الفلاتر لعرض صلاحيات إضافات أخرى."
  },
  card: {
    network: "شبكة",
    fileSystem: "نظام ملفات",
    codeExecution: "تنفيذ كود",
    dataLeavesTenant: "خروج بيانات",
    adminApproval: "موافقة مسؤول",
    permissionDetails: "تفاصيل الصلاحيات",
    noPermissions: "لا توجد صلاحيات موثقة لهذه الإضافة."
  },
  toolbar: {
    eyebrow: "كتالوج آمن",
    title: "سوق الإضافات ومراجعة الصلاحيات",
    description: "استعراض إضافات مراجعة فقط مع سياسة تمنع التثبيت البعيد وتنفيذ الكود داخل هذا التشغيل المحلي.",
    readOnlyCatalog: "كتالوج للقراءة فقط",
    noCodeExecution: "لا تنفيذ كود",
    adminReview: "مراجعة مسؤول"
  },
  metrics: {
    displayed: "الإضافات المعروضة",
    reviewed: "مراجعة ومقبولة",
    blocked: "محظورة",
    highRiskScopes: "نطاقات الصلاحيات عالية المخاطر"
  },
  error: {
    title: "تعذر تحميل كتالوج الإضافات",
    description: "{error} — الكتالوج للقراءة والمراجعة فقط؛ أعد تحميل الصفحة بعد التحقق من الصلاحية."
  },
  form: { ariaLabel: "فلاتر الإضافات", status: "الحالة", category: "الفئة" },
  list: {
    ariaLabel: "قائمة الإضافات",
    loadingTitle: "جارٍ تحميل الإضافات",
    loadingDescription: "نقرأ الكتالوج المحلي وسياسة التشغيل.",
    emptyTitle: "لا توجد إضافات مطابقة",
    emptyDescription: "جرّب إزالة فلتر الحالة أو الفئة."
  }
} as const;
