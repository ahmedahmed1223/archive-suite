export const shares = {
  dialogs: {
    remove: {
      title: "حذف الرابط",
      message: "حذف هذا الرابط من سجل هذا المتصفح فقط؟ لن يؤدي ذلك إلى إبطال الرابط على الخادم.",
      confirm: "حذف"
    },
    clear: {
      title: "مسح السجل المحلي",
      message: "مسح سجل الروابط المحلية فقط؟ لن يؤدي ذلك إلى إبطال روابط المشاركة.",
      confirm: "مسح"
    }
  },
  toolbar: {
    eyebrow: "محلي على الجهاز",
    title: "روابط المشاركة",
    description: "الروابط التي أنشأها المستخدم من هذا المتصفح، مع نسخ سريع ومتابعة تاريخ الإنشاء والانتهاء.",
    localShares: "المشاركات المحلية",
    linkCount: "{count} رابط",
    incomingShares: "المشاركات الواردة",
    cleared: "تم المسح",
    clearAll: "مسح الكل"
  },
  empty: {
    title: "لم تنشئ أي روابط مشاركة بعد",
    description: "انتقل إلى صفحة الملفات وحدد عناصر لإنشاء رابط مشاركة.",
    openFiles: "فتح الملفات"
  },
  list: {
    ariaLabel: "روابط المشاركة المنشأة",
    title: "قائمة الروابط",
    description: "تدار هذه الروابط محليًا لتسهيل الرجوع والنسخ دون مزامنة عبر الأجهزة.",
    cardsAriaLabel: "بطاقات روابط المشاركة",
    share: "مشاركة",
    fallbackLink: "رابط مشاركة",
    createdAt: "الإنشاء",
    expiresAt: "الانتهاء",
    expiryDescription: "{date} — {detail} تقدير محلي حسب التاريخ المعلن؛ الإنفاذ بالخادم.",
    copied: "تم النسخ",
    copy: "نسخ",
    open: "فتح",
    remove: "حذف"
  },
  expiry: {
    estimate: "(تقدير)",
    noExpiry: { label: "بلا انتهاء", detail: "راجع صلاحية الرابط قبل مشاركته خارج الفريق." },
    invalidDate: { label: "تاريخ غير واضح", detail: "لا تعتمد الرابط حتى تتأكد من تاريخ انتهائه." },
    expired: { label: "منتهية", detail: "أنشئ رابطًا جديدًا إذا بقيت الحاجة إلى المشاركة." },
    expiresSoon: { label: "تنتهي قريبًا", detail: "تأكد من أن المستلم سيتمكن من فتحه قبل الانتهاء." },
    active: { label: "نشطة", detail: "تبقى الصلاحيات التي أنشئ بها الرابط هي المطبقة." }
  },
  table: { ariaLabel: "قائمة روابط المشاركة", item: "العنصر", link: "الرابط", createdAt: "الإنشاء", expiresAt: "الانتهاء", actions: "الإجراءات" }
} as const;
