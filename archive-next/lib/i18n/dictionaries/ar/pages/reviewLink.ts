export const reviewLink = {
  sectionAriaLabel: "رابط المراجعة العامة",
  eyebrow: "مراجعة عامة",
  title: "رابط مراجعة عام",
  description: "يعرض بيانات المراجعة والتعليقات المسموحة لهذا الرابط فقط، مع إبقاء الرمز والصلاحيات محكومة من الخادم.",
  protectedCommentsBadge: "تعليقات محمية",
  limitedPublicAccessBadge: "صلاحية عامة محدودة",
  contentTitle: "محتوى المراجعة",
  contentDescription: "اعرض التعليقات والملاحظات على هذا السجل في سياق آمن.",
  viewer: {
    loading: "جارٍ تحميل رابط المراجعة",
    loadingDescription: "يتم جلب التعليقات والبيانات المسموحة لهذا الرابط.",
    error: "تعذر تحميل رابط المراجعة",
    content: "محتوى رابط المراجعة",
    notice: "رابط مراجعة عام؛ لا يتيح إدارة الأصل أو تغيير صلاحياته.",
    asset: "المادة",
    permission: "الصلاحية",
    expires: "ينتهي",
    expiryEstimate: "تقدير الصلاحية",
    expiryHint: "تقدير محلي حسب التاريخ المعلن؛ الإنفاذ بالخادم.",
    empty: "لا توجد تعليقات متاحة لهذا الرابط.",
    expiryLabels: {
      noExpiry: "بلا انتهاء",
      unavailable: "تاريخ غير واضح",
      expired: "منتهية",
      soon: "تنتهي قريبًا",
      active: "نشطة"
    }
  }
} as const;
