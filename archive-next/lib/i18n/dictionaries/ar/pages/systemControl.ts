export const systemControl = {
  pageTitle: "التحكم بالنظام",
  highRiskBadge: "إجراء عالي الخطورة",
  pageDescription:
    "إجراءات تؤثر مباشرة على المضيف. معطّلة تمامًا افتراضيًا؛ يجب تفعيلها صراحة من متغير بيئة على الخادم (SYSTEM_CONTROL_ENABLED)، وهي متاحة للمشرفين فقط، وكل محاولة (ناجحة أو مرفوضة) تُسجَّل في سجل التدقيق.",
  auditEnforcedBadge: "التدقيق مفروض",
  refreshButton: "تحديث الحالة",
  gateStatusSectionLabel: "حالة التحكم بالنظام",
  gateAvailableNote: "الصلاحية متاحة، لكن كل إجراء لا يزال يتحقق من الخادم.",
  gateRestrictedNote: "الأزرار تبقى مقيدة حتى يسمح الخادم بذلك.",
  sensitiveScopeTitle: "نطاق حساس",
  sensitiveScopeNote: "لا توجد محاكاة في الواجهة؛ التنفيذ الحقيقي يمر عبر الخادم فقط.",
  forbiddenTitle: "هذه الصفحة للمشرفين فقط",
  forbiddenNote: "لا تملك صلاحية الوصول إلى إجراءات التحكم بالنظام.",
  statusErrorTitle: "تعذر التحقق من حالة النظام",
  statusCheckFallbackError: "تعذر التحقق من حالة النظام.",
  unknownError: "خطأ غير معروف",
  disabledTitle: "إجراءات التحكم بالنظام معطّلة",
  disabledNote: "لم يتم تفعيل SYSTEM_CONTROL_ENABLED على الخادم. جميع الأزرار أدناه غير فعّالة حتى يُفعَّل المتغير صراحة من إعدادات النشر.",
  successTitle: "تم تنفيذ الإجراء: {action}",
  checkResultLink: "تحقق من نتيجة الإجراء",
  continueOnboardingLink: "متابعة رحلة الإعداد",
  actionErrorTitle: "تعذر تنفيذ الإجراء",
  actionRunFallbackError: "تعذر تنفيذ الإجراء.",
  reviewStatusLink: "راجع حالة النظام وخطوات الإصلاح",
  availableActionsHeading: "الإجراءات المتاحة",
  availableActionsNote: "كل إجراء يتحقق من التفعيل والصلاحية على الخادم قبل التنفيذ، بصرف النظر عن حالة هذه الواجهة.",
  actionsSectionLabel: "إجراءات التحكم",
  runningLabel: "جاري التنفيذ...",
  executeLabel: "تنفيذ",
  disabledButtonTitle: "غير مفعّل من إعدادات الخادم",
  confirmDialogTitle: "تأكيد تفريغ الذاكرة المؤقتة",
  confirmDialogDescription: "سيتم تنفيذ الإجراء مباشرة على الخادم وتسجيله في سجل التدقيق. قد تتأخر الاستجابة التالية مؤقتًا أثناء إعادة بناء الإعدادات المخبأة.",
  confirmDialogBody: "تأكد من أنك تريد متابعة الإجراء في بيئة الإنتاج.",
  cancelButton: "إلغاء",
  confirmClearButton: "تأكيد التفريغ",
  gateStatusLabels: {
    loading: "جار التحقق",
    enabled: "مفعلة للمشرف",
    disabled: "معطلة من الخادم",
    forbidden: "صلاحية مرفوضة",
    error: "تعذر الفحص"
  },
  actions: {
    clearCache: {
      label: "تفريغ ذاكرة التخزين المؤقت",
      description: "يفرّغ ذاكرة التخزين المؤقت وإعدادات الخادم المخبأة.",
      audit: "يسجل محاولة system_control.allowed أو blocked"
    },
    runBackup: {
      label: "تشغيل نسخة احتياطية فورية",
      description: "يُنشئ نسخة احتياطية جديدة فورًا (مطابق لزر النسخ الاحتياطي).",
      audit: "يرتبط بسجل النسخ الاحتياطي والتدقيق"
    }
  }
} as const;
