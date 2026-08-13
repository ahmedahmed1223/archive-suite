export const scheduledUploadsClient = {
  statusLabels: {
    scheduled: "مجدولة",
    claimed: "قيد المعالجة",
    processing: "قيد المعالجة",
    completed: "مكتملة",
    cancelled: "ملغاة",
    failed: "فشلت"
  },
  tabLabels: {
    all: "الكل",
    scheduled: "مجدولة",
    processing: "قيد المعالجة",
    completed: "مكتملة",
    failed: "فشلت",
    cancelled: "ملغاة"
  },
  tabsAriaLabel: "تصفية حسب الحالة",
  searchLabel: "بحث بالملف أو العنوان",
  loadingText: "جارٍ التحميل…",
  emptyText: "لا توجد رفعات مجدولة تطابق الفلترة الحالية.",
  openRecordButton: "فتح السجل",
  rescheduleButton: "إعادة الجدولة",
  cancelButton: "إلغاء",
  retryButton: "إعادة المحاولة",
  cancelDialogTitle: "إلغاء الرفع المجدول",
  cancelDialogDescription: 'سيُلغى جدول رفع "{fileName}" ولن تتم معالجته. يمكن الاحتفاظ بالملف الأصلي مؤقتاً بحسب سياسة الاستبقاء.',
  dialogDismiss: "تراجع",
  confirmCancelButton: "إلغاء الجدولة",
  rescheduleDialogTitle: "إعادة جدولة الرفع",
  rescheduleInputLabel: "موعد المعالجة الجديد",
  saveRescheduleButton: "حفظ الموعد الجديد"
} as const;
