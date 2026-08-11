export const timeline = {
  eyebrow: "ترتيب زمني", title: "الخط الزمني", description: "عرض السجلات حسب تاريخ الإنشاء أو التحديث، مع تغيير دقة التجميع بين اليوم والشهر والسنة.",
  day: "يوم", month: "شهر", year: "سنة", refresh: "تحديث", granularity: "دقة التجميع", loading: "جار تحميل السجلات", loadingDescription: "يتم جلب السجلات من الخادم وتجهيزها للعرض الزمني.", loadError: "تعذر تحميل الخط الزمني", unknownError: "خطأ غير معروف", loadFailed: "فشل تحميل السجلات: {message}",
  noRecords: "لا توجد سجلات حتى الآن", noRecordsDescription: "أضف سجلات إلى الأرشيف لعرضها هنا مرتبة على الخط الزمني.", openArchive: "فتح الأرشيف", totalRecords: "إجمالي السجلات", periods: "الفترات", displayGranularity: "دقة العرض", groups: "مجموعات الخط الزمني", record: "سجل", records: "سجلات", untitledType: "بدون نوع", range: "النطاق: {value}", recordCount: "{count} سجل", periodCount: "{count} فترة",
  months: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
} as const;
