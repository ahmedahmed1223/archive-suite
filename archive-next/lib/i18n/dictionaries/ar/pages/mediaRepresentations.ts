export const mediaRepresentations = {
  title: "تمثيلات الوسائط",
  description: "نسخ المادة الفعلية المرتبطة بالنسخة الحالية فقط؛ لا تُعرض نسخ حفظ أو تحويل غير موجودة.",
  count: "{count} تمثيل",
  loading: "جارٍ تحميل تمثيلات الوسائط...",
  error: "تعذر تحميل تمثيلات الوسائط: {message}",
  retry: "إعادة المحاولة",
  emptyTitle: "لا توجد تمثيلات مسجلة",
  emptyDescription: "أضف مصدرًا أو شغّل معالجة وسائط لتظهر النسخ الفعلية هنا.",
  listAriaLabel: "تمثيلات الوسائط الحالية",
  types: { source: "المصدر الحالي", preservation: "نسخة حفظ", mezzanine: "نسخة وسيطة", proxy: "نسخة عرض", thumbnail: "صورة مصغرة", waveform: "موجة صوتية", text: "نص", output: "مخرج" },
  status: { pending: "قيد الانتظار", processing: "قيد المعالجة", ready: "جاهز", failed: "فشل" },
} as const;
