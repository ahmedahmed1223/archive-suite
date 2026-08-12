export const shared = {
  appName: "Archive Suite",
  actions: {
    save: "حفظ",
    cancel: "إلغاء",
    retry: "إعادة المحاولة",
    confirm: "تأكيد",
    accept: "موافق",
    close: "حسنًا",
  },
  feedback: {
    loading: "جارٍ التحميل…",
    genericError: "تعذر إكمال العملية. حاول مرة أخرى.",
    noResults: "لا توجد نتائج",
    confirmActionTitle: "تأكيد الإجراء",
    promptValueTitle: "إدخال قيمة",
    alertTitle: "تنبيه",
    dismiss: "إغلاق",
  },
  languages: {
    ar: "العربية",
    en: "الإنجليزية",
  },
  switchLanguage: "التبديل إلى {language}",
  dataTable: {
    empty: "لا توجد بيانات للعرض.",
    noSort: "لا يوجد ترتيب مفعّل.",
    sortedBy: "تم ترتيب الجدول حسب {columns}.",
    ascending: "{column} تصاعديًا",
    descending: "{column} تنازليًا",
    thenSeparator: "، ثم ",
    scrollRegion: "منطقة جدول قابلة للتمرير",
    namedScrollRegion: "{label} — منطقة جدول قابلة للتمرير",
    scrollHint: "عند الحاجة، ركّز على منطقة الجدول واستخدم السهمين الأيمن والأيسر للتمرير أفقيًا.",
    columns: "الأعمدة",
    toggleSort: "تبديل ترتيب عمود {column}"
  },
  mediaPlayer: {
    playbackError: "تعذّر تشغيل هذه المادة. تحقّق من المسار ومن دعم المتصفح للصيغة.",
    empty: "لا توجد مادة محددة للتشغيل.",
    timelineAriaLabel: "خط زمن الوسائط"
  },
  mediaSourcePicker: {
    dialogAriaLabel: "اختيار مصدر المادة",
    browseTitle: "تصفح ملفات الأرشيف — {path}",
    close: "إغلاق",
    loading: "جارٍ التحميل…"
  },
  iconPicker: {
    choose: "اختر أيقونة",
    search: "بحث عن أيقونة"
  },
  changeImpactPreview: {
    introduction: "معاينة التأثير:",
    available: "متاح"
  },
  dataViewSwitcher: {
    label: "طريقة العرض"
  },
  shortcutsOverlay: {
    title: "اختصارات لوحة المفاتيح",
    description: "نظرة سريعة على اختصارات لوحة المفاتيح المتاحة حاليًا.",
    labels: {
      commandPalette: "فتح لوحة الأوامر",
      shortcutsHelp: "عرض لوحة الاختصارات",
      focusSearch: "الانتقال إلى البحث",
      newRecord: "إنشاء مادة جديدة",
      saveRecord: "حفظ التوصيف",
      focusComments: "الانتقال إلى التعليقات",
      focusTags: "الانتقال إلى الوسوم"
    }
  },
  storageBrowser: {
    panelAriaLabel: "مساحة إدارة الملفات",
    title: "إدارة الملفات",
    description: "تصفّح وحدات التخزين المتصلة ونفّذ العمليات المسموح بها فقط.",
    providerLabel: "وحدة التخزين",
    offlineSuffix: " — غير متصل",
    providerStatusAriaLabel: "حالة وحدة التخزين",
    noProvider: "لا توجد وحدة تخزين",
    statuses: {
      ready: "جاهز",
      syncing: "جارٍ المزامنة",
      offline: "غير متصل"
    },
    actionsAriaLabel: "إجراءات الملفات",
    actions: {
      upload: "رفع",
      createFolder: "مجلد جديد",
      move: "نقل"
    },
    unavailableAction: "غير متاح في وحدة التخزين المحددة",
    pathAriaLabel: "مسار وحدة التخزين",
    root: "الجذر",
    searchLabel: "بحث داخل المجلد",
    searchPlaceholder: "ابحث باسم الملف أو المجلد",
    openError: "تعذر فتح وحدة التخزين",
    loading: "جارٍ تحميل الملفات…",
    contentsAriaLabel: "محتوى وحدة التخزين",
    parentFolder: "المجلد السابق",
    open: "فتح",
    download: "تنزيل",
    noMatches: "لا توجد عناصر مطابقة في هذا المجلد."
  },
  pages: {
    notFoundTitle: "الصفحة غير موجودة.",
    notFoundDescription: "الرابط الذي فتحته غير صحيح أو أُزيلت صفحته.",
    backHome: "العودة إلى الرئيسية",
    openArchive: "فتح الأرشيف",
    pageError: "تعذر عرض الصفحة",
    pageErrorTitle: "حدث خطأ أثناء تحميل هذه الشاشة.",
    pageErrorDescription: "أعد المحاولة، أو ارجع إلى الرئيسية إذا استمر الخطأ.",
    errorReference: "مرجع الخطأ",
  },
  globalError: {
    badge: "خطأ غير متوقع",
    title: "تعذر تحميل {brand}.",
    description: "يمكنك إعادة المحاولة، وإن تكرر الخطأ فافتح سجل الأخطاء من لوحة التشغيل.",
    errorReference: "مرجع الخطأ",
    retry: "إعادة المحاولة",
    errorLog: "سجل الأخطاء"
  },
  suggestions: {
    title: "اقتراحات تحسين",
    severity: { high: "مهم", medium: "تحسين", low: "ملاحظة" },
    selectAllAriaLabel: "تحديد كل الاقتراحات",
    selectedCount: "{count} محدد",
    selectAll: "تحديد الكل",
    approveSelected: "اعتماد المحدد",
    dismissSelected: "رفض المحدد",
    selectItemAriaLabel: "تحديد {title}",
    itemCount: "{count} مادة",
    open: "فتح",
    useful: "مفيد",
    notUseful: "غير مفيد",
    dismiss: "إخفاء",
    feedbackError: "تعذر حفظ تقييم الاقتراح."
  },
} as const;
