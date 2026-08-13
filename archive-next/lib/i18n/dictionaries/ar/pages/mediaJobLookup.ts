export const mediaJobLookup = {
  validation: { jobIdRequired: "أدخل معرّف المهمة قبل الفحص.", reviewData: "راجع بيانات الفحص." },
  operations: { thumbnail: "صورة مصغرة", transcode: "تحويل صيغة", transcription: "تفريغ نصي", ocr: "استخراج نص OCR", montageExport: "تصدير مونتاج" },
  statuses: { queued: "قيد الانتظار", processing: "قيد المعالجة", completed: "مكتمل", failed: "فشل", canceled: "ملغى" },
  form: {
    ariaLabel: "فحص مهمة وسائط",
    title: "فحص مهمة محددة",
    description: "تحقق بسرعة من حالة مهمة الوسائط ونتيجتها من الخادم.",
    directCheck: "فحص مباشر",
    jobId: "معرّف المهمة",
    jobIdPlaceholder: "معرّف مهمة الوسائط",
    advancedOptions: "خيارات متقدمة للمسؤول",
    accessTokenDescription: "استخدم رمز وصول بديلًا فقط عند فحص مهمة ضمن جلسة أو بيئة مختلفة.",
    accessToken: "رمز الوصول",
    accessTokenPlaceholder: "رمز Bearer اختياري",
    checking: "جارٍ الفحص...",
    submit: "فحص حالة المهمة",
    found: "تم العثور على المهمة. الحالة الحالية: {status}، ونوع العملية: {operation}.",
    idle: "أدخل معرّف المهمة لعرض حالتها من الخادم."
  }
} as const;
