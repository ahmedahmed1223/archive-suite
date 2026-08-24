export const projects = {
  toolbar: {
    eyebrow: "المونتاج",
    title: "المشاريع / المونتاج",
    description: "اجمع قصاصات من مواد الأرشيف على خط زمني، ورتّبها واضبط نقاط الدخول والخروج، ثم صدّر JSON أو EDL.",
    projectCount: "{count} مشروع",
    clipCount: "{count} قصاصة",
    duration: "المدة {duration}",
    workProjects: "مشاريع العمل",
    openArchive: "فتح الأرشيف"
  },
  feedback: {
    title: "المشاريع",
    projectCreated: "تم إنشاء المشروع «{name}».",
    projectDeleted: "تم حذف المشروع «{name}».",
    invalidRange: "يجب أن تكون نقطة النهاية بعد نقطة البداية.",
    clipAdded: "تمت إضافة «{title}» إلى الخط الزمني.",
    exportMp4Queued: "تم إرسال مهمة تصدير MP4، وتجري المعالجة في الخلفية.",
    exportJson: "تم تنزيل ملف JSON للخط الزمني.",
    exportEdl: "تم تنزيل ملف EDL (CMX3600).",
    exportPremiere: "تم تنزيل ملف Premiere XML.",
    exportFcpXml: "تم تنزيل ملف FCPXML."
  },
  dialogs: {
    deleteProjectTitle: "حذف المشروع",
    deleteProjectMessage: "حذف المشروع محليًا غير قابل للتراجع: «{name}». لن تتغير أي مادة أصلية.",
    deleteClipTitle: "حذف القصاصة",
    deleteClipMessage: "حذف القصاصة من هذا الخط الزمني غير قابل للتراجع: «{title}». لن تتغير المادة الأصلية.",
    deleteConfirm: "حذف"
  },
  projectsList: {
    ariaLabel: "قائمة المشاريع",
    title: "المشاريع",
    newNamePlaceholder: "اسم مشروع جديد...",
    newNameAriaLabel: "اسم مشروع جديد",
    create: "إنشاء مشروع",
    empty: "لا توجد مشاريع بعد. أنشئ مشروعًا لبدء تجميع القصاصات. تُحفظ المشاريع محليًا في هذا المتصفح.",
    savedAriaLabel: "المشاريع المحفوظة",
    delete: "حذف",
    noSelectionTitle: "لا يوجد مشروع محدد.",
    noSelectionDescription: "أنشئ مشروعًا أو اختر واحدًا من القائمة لفتح محرر الخط الزمني."
  },
  clipSearch: {
    ariaLabel: "إضافة قصاصات من الأرشيف",
    title: "إضافة قصاصة من الأرشيف",
    resultsCount: "{count} نتيجة",
    searchPlaceholder: "ابحث في سجلات الأرشيف...",
    searchAriaLabel: "البحث في سجلات الأرشيف",
    inLabel: "البداية (ث)",
    outLabel: "النهاية (ث)",
    inAriaLabel: "نقطة البداية بالثواني",
    outAriaLabel: "نقطة النهاية بالثواني",
    searching: "جارٍ البحث...",
    search: "بحث",
    noResults: "لا توجد سجلات مطابقة.",
    unspecified: "غير محدد",
    add: "إضافة إلى الخط الزمني",
    open: "فتح"
  },
  timeline: {
    ariaLabel: "الخط الزمني للمشروع",
    title: "الخط الزمني — {name}",
    empty: "لا توجد قصاصات بعد. ابحث في الأرشيف أعلاه وأضف قصاصات إلى الخط الزمني.",
    invalidPoints: " — نقاط غير صالحة",
    inLabel: "البداية",
    outLabel: "النهاية",
    inAriaLabel: "نقطة بداية {title}",
    outAriaLabel: "نقطة نهاية {title}",
    moveUpAriaLabel: "تحريك {title} إلى الأعلى",
    moveDownAriaLabel: "تحريك {title} إلى الأسفل",
    delete: "حذف",
    deleteNote: "حذف القصاصة يغيّر الخط الزمني فقط؛ المادة الأصلية لا تتأثر."
  },
  export: {
    ariaLabel: "تصدير المشروع",
    title: "التصدير",
    validCount: "{count} قصاصة صالحة",
    json: "تصدير JSON",
    edl: "تصدير EDL",
    premiere: "تصدير Premiere XML",
    fcpXml: "تصدير FCPXML",
    mp4: "تصدير MP4",
    mp4Hint: "يعمل تصدير MP4 كمهمة خادم غير متزامنة تجمع القصاصات عبر ffmpeg في الخلفية دون حجب الطلب.",
    pathResolutionError: "تعذر تحديد مسار الملف لبعض القصاصات: {titles}. لا يمكن المتابعة حتى تحتوي كل قصاصة على مسار ملف صالح.",
    status: "حالة تصدير MP4: {status}",
    statusLabels: {
      queued: "قيد الانتظار",
      processing: "قيد المعالجة",
      completed: "مكتمل",
      failed: "فشل",
      canceled: "أُلغي"
    },
    download: "تنزيل ملف MP4",
    failed: "فشل التصدير: {error}",
    running: "جارٍ التنفيذ في الخلفية..."
  },
  changeImpactEntity: "المشروع"
} as const;
