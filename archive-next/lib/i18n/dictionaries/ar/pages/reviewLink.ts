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
    },
    media: {
      title: "المادة قيد المراجعة",
      unavailable: "لا تتوفر مادة معروضة عبر هذا الرابط حتى الآن.",
      watermarkBanner: "نسخة مراجعة تحمل علامة مائية — غير مخصصة للتوزيع",
      downloadLabel: "تنزيل"
    },
    decision: {
      title: "قرارك",
      reviewerNameLabel: "اسمك",
      reviewerNamePlaceholder: "أدخل اسمك",
      reviewerEmailLabel: "بريدك الإلكتروني (اختياري)",
      notesLabel: "ملاحظات (اختياري)",
      notesPlaceholder: "أضف سياقًا لقرارك",
      approve: "موافقة",
      requestChanges: "طلب تعديلات",
      submitting: "جارٍ الإرسال…",
      submitted: "تم تسجيل القرار",
      approvedFull: "تمت الموافقة — اكتمل عدد الموافقات المطلوب",
      approvalsProgress: "الموافقات الواردة: {received} من {required}",
      changesRequested: "طُلبت تعديلات",
      reviewerNameRequired: "أدخل اسمك قبل إرسال القرار.",
      errorGeneric: "تعذر إرسال قرارك. قد يكون الرابط منتهي الصلاحية.",
      sessionState: "حالة المراجعة"
    }
  }
} as const;
