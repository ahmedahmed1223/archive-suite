export const projectGroups = {
  loadingLabel: "جارٍ تحميل المشاريع…",
  noPermission: "لا تملك صلاحية إنشاء مشاريع عمل جديدة.",
  errors: {
    projectsLoad: "تعذر تحميل مشاريع العمل.",
    recordsLoad: "تعذر تحميل مواد المشروع.",
    create: "تعذر إنشاء المشروع.",
    saveNotes: "تعذر حفظ الملاحظات.",
    linkRecord: "تعذر ربط المادة.",
    saveOrder: "تعذر حفظ الترتيب."
  },
  feedback: {
    created: "تم إنشاء مشروع العمل.",
    notesSaved: "حُفظت ملاحظات المشروع.",
    recordLinked: "رُبطت المادة بالمشروع.",
    orderSaved: "حُفظ ترتيب المواد."
  },
  toolbar: { title: "مشاريع العمل", description: "حقائب عمل مستقلة تجمع المواد مع ملاحظات وترتيب محفوظ للخادم.", projectCount: "{count} مشاريع" },
  form: { projectName: "اسم المشروع", projectNotes: "ملاحظات المشروع", create: "إنشاء مشروع", saveNotes: "حفظ الملاحظات", recordIdPlaceholder: "معرّف المادة", linkRecord: "ربط مادة" },
  empty: { title: "لا توجد مشاريع عمل", description: "أنشئ مشروعًا لجمع المواد وترتيبها." },
  content: { projectsTitle: "المشاريع", materialsTitle: "مواد المشروع", noMaterials: "لا توجد مواد مرتبطة بعد." }
} as const;
