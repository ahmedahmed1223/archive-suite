export const inbox = {
  statuses: { new: "وارد جديد", triage: "قيد الفرز", ready: "جاهز للأرشفة", done: "مكتمل" },
  errors: { load: "تعذر تحميل الوارد.", update: "تعذر تحديث الحالة.", add: "تعذر إضافة العنصر.", remove: "تعذر حذف العنصر.", previewRoute: "تعذرت معاينة التوجيه.", repeatedRoute: "تم منع التوجيه المتكرر.", applyRoute: "تم منع التوجيه أو تعذر تنفيذه." },
  messages: { saving: "جار الحفظ...", added: "تمت الإضافة إلى الوارد.", addedToast: "تمت إضافة العنصر إلى الوارد.", removed: "تم حذف العنصر.", routePreview: "يمكن التوجيه إلى قسم {department}. لن يُنفذ شيء قبل التأكيد.", routed: "تم توجيه العنصر إلى قسم {department}.", routeLogged: "تم التوجيه وتسجيله في السجل." },
  toolbar: { eyebrow: "التقاط سريع", title: "صندوق الوارد", description: "التقاط سريع للمواد أو الأفكار قبل الأرشفة، محفوظ في الخادم لكل مستخدم.", items: "{count} عنصر", ready: "{count} جاهز للأرشفة", endTriage: "إنهاء الفرز السريع", startTriage: "بدء الفرز السريع", upload: "رفع ملف" },
  form: { title: "العنوان", titlePlaceholder: "مادة أو مهمة فرز", source: "المصدر", sourcePlaceholder: "مجلد، جهة، رابط...", note: "ملاحظة", add: "إضافة للوارد", all: "الكل · {count}" },
  triage: { active: "الفرز السريع مفعّل", instructions: "J/K أو الأسهم للتنقل · 1 جديد · 2 قيد الفرز · 3 جاهز · 4 مكتمل · Enter للفتح" },
  states: { loading: "جار تحميل عناصر الوارد...", loadFailed: "تعذر تحميل عناصر الوارد", retry: "إعادة المحاولة", emptyTitle: "لا توجد عناصر في هذا العرض.", emptyDescription: "أضف عنصراً سريعاً أو غيّر فلتر الحالة.", ariaLabel: "عناصر الوارد" },
  item: { source: "المصدر", note: "الملاحظة", department: "القسم", unrouted: "غير موجّه", statusFor: "حالة {title}", searchSimilar: "بحث مشابه", startArchiving: "بدء الأرشفة", openArchive: "فتح الأرشيف", remove: "حذف", targetDepartmentPlaceholder: "معرّف القسم المستهدف", targetDepartmentFor: "القسم المستهدف لـ {title}", previewRoute: "معاينة التوجيه", routeDepartment: "توجيه للقسم" }
} as const;
