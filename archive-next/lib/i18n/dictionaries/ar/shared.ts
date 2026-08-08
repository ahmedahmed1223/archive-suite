export const shared = {
  appName: "Archive Suite",
  actions: {
    save: "حفظ",
    cancel: "إلغاء",
    retry: "إعادة المحاولة",
  },
  feedback: {
    loading: "جارٍ التحميل…",
    genericError: "تعذر إكمال العملية. حاول مرة أخرى.",
  },
  languages: {
    ar: "العربية",
    en: "الإنجليزية",
  },
  pages: {
    notFoundTitle: "الصفحة غير موجودة.",
    notFoundDescription: "الرابط الذي فتحته غير صحيح أو أُزيلت صفحته.",
    backHome: "العودة إلى الرئيسية",
    openArchive: "فتح الأرشيف",
    pageError: "تعذر عرض الصفحة",
    pageErrorTitle: "حدث خطأ أثناء تحميل هذه الشاشة.",
    pageErrorDescription: "أعد المحاولة، أو ارجع إلى الرئيسية إذا استمر الخطأ.",
    errorReference: "مرجع الخطأ",
  },
} as const;
