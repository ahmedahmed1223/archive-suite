export const approvalRequests = {
  toolbar: {
    eyebrow: "اعتماد مزدوج",
    title: "طلبات الاعتماد",
    description: "تنتظر العمليات الجماعية الحساسة هنا حتى يوافق عليها العدد المطلوب من معتمدين مختلفين، ولا يمكن لمقدّم الطلب أن يكون أحدهم أبدًا.",
    refresh: "تحديث"
  },
  submit: {
    ariaLabel: "إرسال إجراء جماعي للاعتماد",
    title: "إرسال إجراء جماعي للاعتماد",
    description: "لا يمكن إرسال إلا الإجراءات الجماعية التي تحتوي خطوة مصنّفة حاليًا كحساسة في السياسة.",
    macroId: "معرّف الإجراء الجماعي",
    targets: "الأهداف (المخزن:المعرّف، المخزن:المعرّف)",
    submit: "إرسال للاعتماد",
    submitting: "جارٍ الإرسال…"
  },
  errors: {
    load: "تعذر تحميل طلبات الاعتماد.",
    submit: "تعذر إرسال طلب الاعتماد.",
    decide: "تعذر تسجيل القرار.",
    execute: "تعذر تنفيذ الطلب المعتمد."
  },
  status: {
    pending: "قيد الانتظار",
    approved: "معتمد",
    rejected: "مرفوض",
    executed: "منفَّذ"
  },
  table: {
    ariaLabel: "طلبات الاعتماد",
    id: "الطلب",
    operation: "العملية",
    status: "الحالة",
    approvals: "الموافقات",
    requestedBy: "مقدَّم من",
    actions: "الإجراءات"
  },
  actions: {
    approve: "موافقة",
    reject: "رفض",
    execute: "تنفيذ",
    selfApprovalBlocked: "أنت من قدّم هذا الطلب، ولا يمكنك اتخاذ قرار بشأنه بنفسك.",
    alreadyDecided: "سبق أن سجّلت قرارًا على هذا الطلب."
  },
  empty: "لا توجد طلبات اعتماد بعد.",
  decidedCount: "{approved} موافقة، {rejected} رفض"
} as const;
