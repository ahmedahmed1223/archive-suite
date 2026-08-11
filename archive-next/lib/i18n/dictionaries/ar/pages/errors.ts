export const errors = {
  severity: { error: "خطأ", warning: "تحذير", info: "معلومة" },
  manualLog: { message: "اختبار يدوي من صفحة سجل الأخطاء." },
  clearDialog: {
    title: "مسح سجل الأخطاء",
    message: "سيتم مسح سجل الأخطاء الحالي من هذا المتصفح. هل تريد المتابعة؟",
    confirm: "مسح"
  },
  toolbar: {
    eyebrow: "سجل الأخطاء",
    title: "سجل الأخطاء والاسترداد",
    description: "مركز موحد لأعطال الواجهة، تكراراتها، ومكان ظهورها حتى يسهل ربط المشكلة بالصفحة أو سير العمل.",
    uniqueCount: "{count} خطأ فريد",
    repeatedCount: "{count} تكرار",
    criticalCount: "{count} حرج",
    testLogging: "اختبار التسجيل",
    clearLog: "مسح السجل"
  },
  filter: {
    severity: "درجة الخطورة",
    all: "الكل",
    errors: "أخطاء",
    warnings: "تحذيرات",
    information: "معلومات"
  },
  metrics: {
    ariaLabel: "مقاييس سجل الأخطاء",
    criticalErrors: "أخطاء حرجة",
    immediateAction: "تحتاج معالجة مباشرة",
    warnings: "تحذيرات",
    incompleteBehavior: "مؤشرات سلوك غير مكتمل",
    information: "معلومات",
    diagnosticEvents: "أحداث تشخيصية",
    repetitions: "التكرارات",
    lastSeen: "آخر ظهور: {date}",
    noEvents: "لا توجد أحداث"
  },
  wave: {
    title: "ارتفاع ملحوظ في معدل الأعطال",
    description: "سُجلت {count} حالة خطأ خلال آخر {minutes} دقائق. راجع الأحداث المتكررة وابدأ بخطوات الاسترداد أدناه."
  },
  recovery: {
    ariaLabel: "ملخص الاسترداد",
    title: "خطوات الاسترداد المقترحة",
    description: "تجميع محلي للأنماط المتكررة، وليس تشخيصًا من الخادم.",
    group: "{label}: {count} — {recovery}"
  },
  empty: {
    title: "لا توجد أخطاء مطابقة حاليًا.",
    description: "غيّر درجة الخطورة أو استخدم اختبار التسجيل للتأكد من أن السجل يعمل."
  },
  table: {
    ariaLabel: "نتائج سجل الأخطاء",
    severity: "الخطورة",
    event: "الحدث",
    page: "الصفحة",
    source: "المصدر",
    occurrences: "التكرار",
    lastSeen: "آخر ظهور",
    emptyMessage: "لا توجد أخطاء مطابقة.",
    stackDetails: "تفاصيل المكدس للأخطاء التي تحتوي stack trace"
  }
} as const;
