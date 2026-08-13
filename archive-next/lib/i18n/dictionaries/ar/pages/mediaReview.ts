export const mediaReview = {
  errors: {
    loadComments: "تعذر تحميل تعليقات المراجعة.",
    addComment: "تعذر إضافة التعليق.",
    updateComment: "تعذر تحديث التعليق.",
    operationFailed: "تعذر إكمال العملية"
  },
  toolbar: {
    eyebrow: "مراجعة اللقطات",
    title: "مراجعة مرئية بتعليقات زمنية",
    description: "شغّل المادة، واقفز إلى ترميز زمني محدد، وارسم مستطيلاً فوق الإطار عند الحاجة لتوثيق الملاحظة بدقة.",
    commentCount: "{count} تعليق",
    drawingMode: "وضع الرسم",
    reviewMode: "عرض التعليقات"
  },
  safetyAction: "إضافة تعليق مراجعة",
  media: {
    ariaLabel: "المشغل ونموذج التعليق",
    sourceLabel: "مسار المادة أو معرف جلسة المراجعة",
    sourcePlaceholder: "media/file.mp4",
    sourceDescription: "يستخدم نفس الحقل لتشغيل المادة وربط تعليقات المراجعة.",
    stopDrawing: "إيقاف الرسم",
    drawAnnotation: "رسم ملاحظة على الإطار",
    clearDrawing: "مسح الرسم ({count})",
    emptyTitle: "أدخل مسار مادة لبدء المراجعة.",
    emptyDescription: "استخدم نفس الحقل أعلاه لتشغيل المادة وربط تعليقات المراجعة الخاصة بها."
  },
  form: {
    title: "إضافة تعليق",
    playbackTime: "من وقت التشغيل",
    manualTime: "وقت يدوي",
    currentPlaybackTime: "استخدام وقت التشغيل الحالي",
    timecodeSeconds: "الترميز الزمني بالثواني",
    comment: "التعليق",
    commentPlaceholder: "اكتب الملاحظة هنا",
    adding: "جارٍ الإضافة",
    addComment: "إضافة التعليق"
  },
  comments: {
    ariaLabel: "تعليقات المراجعة",
    title: "التعليقات",
    loadingDescription: "جارٍ تحميل التعليقات...",
    orderedDescription: "مرتبة حسب الزمن داخل المادة.",
    errorDescription: "تعذر تحميل التعليقات.",
    emptyDescription: "لا توجد تعليقات بعد.",
    retry: "إعادة المحاولة",
    emptyTitle: "لا توجد تعليقات بعد.",
    emptyStateDescription: "ابدأ بإضافة أول تعليق من النموذج المجاور للمشغل.",
    reopen: "إعادة فتح",
    resolve: "حل"
  }
} as const;
