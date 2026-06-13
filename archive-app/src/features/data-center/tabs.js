export const DATA_CENTER_TABS = [
  {
    id: "export",
    label: "تصدير",
    icon: "download",
    detail: "جهّز نسخة للقراءة، التحليل، أو المشاركة بدون تغيير بياناتك.",
    actionLabel: "اختيار صيغة ثم تنزيل",
    risk: "آمن"
  },
  {
    id: "import",
    label: "استيراد",
    icon: "upload",
    detail: "اقرأ الملف أولاً، راجع الجديد والمكرر، ثم ادمج أو استبدل بعد نسخة أمان.",
    actionLabel: "اختيار ملف ومعاينة",
    risk: "يحتاج تأكيد"
  },
  {
    id: "transfer",
    label: "نقل بين الأجهزة",
    icon: "refresh",
    detail: "أنشئ حزمة نقل كاملة أو delta صغيرة مع checksum وهوية الجهاز.",
    actionLabel: "إنشاء حزمة نقل",
    risk: "آمن"
  },
  {
    id: "backup",
    label: "نسخ احتياطي",
    icon: "drive",
    detail: "أنشئ نسخة محلية أو استعد نسخة قديمة عند الحاجة.",
    actionLabel: "إدارة النسخ",
    risk: "حذر عند الاستعادة"
  }
];

export const EXPORT_FORMAT_OPTIONS = [
  { id: "json", label: "JSON", detail: "كل البيانات أو البيانات المفلترة", icon: "json" },
  { id: "excel", label: "Excel", detail: "تقرير كامل متعدد الأوراق", icon: "spreadsheet" },
  { id: "csv", label: "CSV", detail: "جداول أساسية قابلة للفتح في Excel", icon: "text" },
  { id: "transfer", label: "ملف نقل", detail: "حزمة JSON بفحص سلامة", icon: "refresh" }
];
