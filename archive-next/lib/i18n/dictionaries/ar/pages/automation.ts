export const automation = {
  triggers: { recordCreated: "عند إنشاء سجل", recordUpdated: "عند تحديث سجل", mediaFailed: "عند فشل مهمة وسائط", scheduleDaily: "تشغيل يومي" },
  actions: { addTag: "إضافة وسم", setReview: "إرسال للمراجعة", notifyAdmin: "تنبيه المدير", createInboxItem: "إنشاء عنصر وارد" },
  feedback: { saving: "جارٍ حفظ القاعدة...", saveError: "تعذر حفظ القاعدة.", saved: "تم حفظ القاعدة في الخادم.", updateError: "تعذر تحديث القاعدة.", stopped: "تم إيقاف القاعدة.", enabled: "تم تفعيل القاعدة.", deleteError: "تعذر حذف القاعدة.", deleted: "تم حذف القاعدة.", runError: "تعذر تشغيل القاعدة.", dryRun: "محاكاة تشغيل", liveRun: "تشغيل فعلي", runCompleted: "اكتمل التشغيل." },
  deleteDialog: { title: "حذف القاعدة", message: "سيتم حذف القاعدة «{name}» ولن تعمل تلقائيًا بعد الآن. هل تريد المتابعة؟", confirm: "حذف" },
  toolbar: { eyebrow: "محرك القواعد", title: "محرّك القواعد", description: "قواعد محفوظة في الخادم مع محاكاة تشغيل وتشغيل فعلي محدود وسجل تنفيذ قابل للمراجعة.", ruleCount: "{count} قاعدة", enabledCount: "{count} مفعّلة", runCount: "{count} تشغيل", activityLink: "سجل النشاط" },
  form: { nameLabel: "اسم القاعدة", templateLabel: "البدء من نموذج جاهز", templateNone: "قاعدة فارغة", triggerLabel: "المشغّل", queryLabel: "بحث", queryPlaceholder: "شرط نصي اختياري", typeLabel: "النوع", allTypes: "كل الأنواع", tagLabel: "وسم", allTags: "كل الوسوم", statusLabel: "الحالة", allStatuses: "كل الحالات", actionLabel: "الإجراء", departmentLabel: "القسم المستهدف", optional: "اختياري", save: "حفظ القاعدة" },
  safetyAction: "معاينة قواعد الأتمتة",
  load: { errorTitle: "تعذر تحميل بيانات الأتمتة", loading: "جارٍ تحميل قواعد الأتمتة..." },
  empty: { title: "لا توجد قواعد بعد.", description: "أنشئ قاعدة محفوظة في الخادم، ثم اختبرها بمحاكاة التشغيل قبل التشغيل الفعلي." },
  rules: { ariaLabel: "قواعد الأتمتة", enabled: "مفعّلة", stopped: "متوقفة", triggerLabel: "المشغّل", conditionsLabel: "الشروط", allRecords: "كل السجلات", actionLabel: "الإجراء", lastRunLabel: "آخر تشغيل", dryRun: "محاكاة تشغيل", liveRun: "تشغيل فعلي", stop: "إيقاف", enable: "تفعيل", delete: "حذف" },
  runs: { title: "سجل تشغيل الأتمتة", dryRun: "محاكاة تشغيل", liveRun: "تشغيل فعلي", matched: "مطابق {count}", executed: "منفذ {count}" },
  runStatusLabels: { completed: "مكتمل", failed: "فشل" },
  noPermissionNote: "تحتاج إلى صلاحية إدارة الأتمتة لإنشاء القواعد أو تشغيلها فعليًا أو حذفها."
} as const;
