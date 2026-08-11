export const collaboration = {
  statusLabels: {
    active: "نشط",
    viewing: "يشاهد",
    reviewing: "يراجع",
    editing: "يحرر",
    idle: "خامل"
  },
  initial: {
    ready: "جاهز",
    noLocksLoaded: "لا توجد أقفال محملة بعد",
    noDocumentLoaded: "لم يتم تحميل مسودة بعد"
  },
  messages: {
    lastSync: "آخر مزامنة: {time}",
    manualUpdate: "تحديث يدوي: {time}",
    loadedLatestVersion: "تم تحميل آخر نسخة",
    newDraft: "مسودة جديدة",
    liveUpdate: "تحديث حي من {name}",
    anotherParticipant: "مشارك آخر",
    lockReserved: "تم حجز {resource} حتى {expires}",
    unspecifiedTime: "وقت غير محدد",
    lockReleased: "تم تحرير القفل.",
    noOwnedLock: "لا يوجد قفل لك على هذا المورد.",
    savedVersion: "تم حفظ النسخة {version}"
  },
  errors: {
    liveCollaboration: "تعذر تحديث التعاون الحي.",
    loadDocument: "تعذر تحميل المسودة.",
    refreshPresence: "تعذر تحديث الحضور.",
    acquireLock: "تعذر حجز المورد.",
    releaseLock: "تعذر تحرير القفل.",
    saveDocument: "تعذر حفظ المسودة."
  },
  validation: {
    selectResourceToAcquire: "اختر مورداً قبل طلب القفل.",
    selectResourceToRelease: "اختر مورداً قبل تحرير القفل.",
    selectRoomAndResource: "اختر غرفة ومورداً قبل حفظ المسودة."
  },
  toolbar: {
    syncing: "جار المزامنة",
    activeSync: "مزامنة نشطة",
    title: "التعاون الحي",
    description: "غرفة تشغيلية لإظهار الحضور النشط، وحجز موارد التحرير، وحفظ مسودة مشتركة عبر الخادم.",
    activeWindow: "نافذة النشاط {seconds} ثانية",
    activeParticipants: "{count} مشارك نشط",
    editingLocks: "{count} قفل تحرير",
    safetyAction: "مراجعة حالة التعاون"
  },
  room: {
    title: "إعداد الغرفة",
    description: "اضبط الغرفة والمورد والحالة، ثم اترك الصفحة ترسل نبضات الحضور تلقائياً.",
    roomKey: "مفتاح الغرفة",
    resource: "المورد",
    status: "الحالة",
    refreshing: "جاري التحديث",
    refreshPresence: "تحديث الحضور",
    acquiring: "جاري الحجز",
    acquireResource: "حجز المورد",
    releasing: "جاري التحرير",
    releaseLock: "تحرير القفل",
    lockStatus: "حالة القفل"
  },
  participants: {
    title: "المشاركون الآن",
    description: "آخر حضور نشط داخل الغرفة الحالية.",
    refreshError: "تعذر تحديث الحضور",
    connectionActive: "الاتصال نشط",
    emptyTitle: "لا يوجد مشاركون نشطون حالياً.",
    emptyDescription: "ستظهر هنا آخر نبضات الحضور عند دخول مشاركين إلى الغرفة.",
    unspecifiedResource: "لا يوجد مورد محدد",
    noTime: "بدون وقت"
  },
  document: {
    title: "مسودة المورد",
    description: "نص مشترك بإصدار متفائل مرتبط بالمورد الحالي.",
    contentLabel: "محتوى مسودة المورد",
    saving: "جاري الحفظ",
    save: "حفظ المسودة"
  },
  locks: {
    title: "أقفال التحرير",
    description: "تمنع الأقفال تعارض الكتابة على المورد نفسه حتى انتهاء المدة أو التحرير اليدوي.",
    emptyTitle: "لا توجد أقفال نشطة في هذه الغرفة.",
    emptyDescription: "استخدم حجز المورد لمنع تعارض التحرير عند العمل على نفس العنصر.",
    expiresAt: "ينتهي: {expires}",
    unspecified: "غير محدد"
  }
} as const;
