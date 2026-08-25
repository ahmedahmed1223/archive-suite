export const workInbox = {
  toolbar: {
    eyebrow: "صندوق العمل",
    title: "عملك كله في مكان واحد",
    description:
      "مهام المشاريع المعلّقة، وجلسات المراجعة بانتظار القرار، والحقوق التي تقترب من الانتهاء، والإشعارات غير المقروءة — كل عنصر يفتح سجله الأصلي مباشرة.",
    addMaterial: "إضافة مادة",
    openDaily: "اليومي",
  },
  filters: {
    all: "الكل · {count}",
    task: "المهام · {count}",
    review: "المراجعات · {count}",
    rights: "الحقوق · {count}",
    notification: "الإشعارات · {count}",
  },
  types: {
    task: "مهمة",
    review: "مراجعة",
    rights: "حقوق",
    notification: "إشعار",
  },
  states: {
    loading: "جارٍ تحميل صندوق العمل...",
    loadFailed: "تعذر تحميل صندوق العمل",
    retry: "إعادة المحاولة",
    emptyTitle: "لا يوجد شيء هنا حاليًا.",
    emptyDescription: "ستظهر هنا المهام المعلّقة والمراجعات وحقوق الانتهاء والإشعارات فور توفرها.",
    ariaLabel: "عناصر صندوق العمل",
  },
  item: {
    due: "الاستحقاق {date}",
    noDue: "بلا موعد استحقاق",
    open: "فتح",
  },
  groups: {
    overdue: "متأخر",
    today: "اليوم",
    upcoming: "قادم",
    undated: "بلا موعد",
  },
  loadMore: "تحميل المزيد",
} as const;
