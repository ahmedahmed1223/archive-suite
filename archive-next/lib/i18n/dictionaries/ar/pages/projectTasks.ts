export const projectTasks = {
  columns: {
    todo: "للعمل",
    inProgress: "قيد التنفيذ",
    review: "للمراجعة",
    done: "مكتملة"
  },
  noDueDate: "بلا تاريخ استحقاق",
  createError: "تعذر إنشاء المهمة.",
  createSuccess: "تم إنشاء المهمة.",
  updateError: "تعذر تحديث الحالة.",
  toolbarTitle: "لوحة مهام المشاريع",
  toolbarDescription: "مهام مستقلة مرتبطة بمشروع، مع مكلّف واستحقاق وتاريخ تحديث وربط اختياري بسجل أرشيفي.",
  recordsKanban: "كانبان السجلات",
  projectLabel: "المشروع",
  selectProject: "اختر مشروعًا",
  taskLabel: "المهمة",
  assigneeLabel: "المكلّف",
  recordIdLabel: "معرّف المادة (اختياري)",
  dueDateLabel: "تاريخ الاستحقاق",
  addTask: "إضافة مهمة",
  unassigned: "غير مسند",
  dueDatePrefix: "الاستحقاق: {date}",
  linkedRecord: "المادة المرتبطة",
  statusAriaLabel: "حالة {title}",
  lastUpdatedPrefix: "آخر تحديث: {date}",
  emptyTitle: "لا توجد مهام بعد",
  emptyDescription: "أضف أول مهمة إلى مشروع عمل."
} as const;
