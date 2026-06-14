export const PAGE_MANIFEST = [
  { id: "dashboard", group: "daily", heavy: false, meta: { title: "مركز التحكم", breadcrumb: "الرئيسية", hint: "عمليات وتقارير مختصرة، بحث سريع، ووصول مباشر لكل مسارات الأرشيف.", helpSection: "dashboard-archive" } },
  { id: "archive", group: "daily", heavy: false, meta: { title: "الأرشيف", breadcrumb: "الرئيسية / الأرشيف", hint: "تصفية، معاينة، تحديد متعدد، وإضافة فيديو من نفس المسار.", helpSection: "dashboard-archive" } },
  { id: "discover", group: "daily", heavy: false, meta: { title: "الاكتشاف", breadcrumb: "الرئيسية / الاكتشاف", hint: "مسارات استكشف ورائج وعشوائي والأكثر نشاطاً والمنسيّون لإحياء المحتوى.", helpSection: "dashboard-archive" } },
  { id: "add", group: "daily", heavy: false, meta: { title: "إضافة فيديو", breadcrumb: "الأرشيف / إضافة", hint: "احفظ وارجع للأرشيف أو احفظ وأضف فيديو آخر بسرعة.", helpSection: "adding-videos" } },
  { id: "search", group: "daily", heavy: false, meta: { title: "البحث المتقدم", breadcrumb: "الرئيسية / البحث", hint: "ابحث ثم عد للأرشيف مع حفظ الفلاتر في الرابط.", helpSection: "searching" } },
  { id: "detail", group: "daily", heavy: false, meta: { title: "تفاصيل الفيديو", breadcrumb: "الأرشيف / التفاصيل", hint: "مراجعة البيانات، التشغيل، الوسوم، وسجل التغييرات.", helpSection: "adding-videos" } },
  { id: "collections", group: "daily", heavy: false, meta: { title: "المجموعات", breadcrumb: "العمل اليومي / المجموعات", hint: "مجموعات يدوية وذكية لتنظيم الأرشيف.", helpSection: "collections" } },
  { id: "projects", group: "production", heavy: false, meta: { title: "مشاريع المونتاج", breadcrumb: "الإنتاج / المونتاج", hint: "اجمع اللقطات في خطّ زمني بنقاط قص وصدّر JSON/EDL/MP4.", helpSection: "collections" } },
  { id: "types", group: "taxonomy", heavy: false, meta: { title: "إدارة الأنواع", breadcrumb: "التوصيف / الأنواع", hint: "أنواع، فروع، حقول مخصصة، وأيقونات.", helpSection: "content-types" } },
  { id: "vocabulary", group: "taxonomy", heavy: false, meta: { title: "القاموس", breadcrumb: "التوصيف / القاموس", hint: "مصطلحات موحدة تظهر في الاستدعاء الذكي.", helpSection: "vocabulary-autocomplete" } },
  { id: "htags", group: "taxonomy", heavy: false, meta: { title: "الوسوم الهرمية", breadcrumb: "التوصيف / الوسوم", hint: "وسوم جذرية وفرعية للاستدعاء عبر #.", helpSection: "tags" } },
  { id: "graph", group: "taxonomy", heavy: true, meta: { title: "خريطة العلاقات", breadcrumb: "التوصيف / خريطة العلاقات", hint: "شبكة تربط المواد بالوسوم المشتركة والنوع لاكتشاف الصلات.", helpSection: "collections" } },
  { id: "users", group: "administration", heavy: false, meta: { title: "المستخدمون", breadcrumb: "الإدارة / المستخدمون", hint: "أدوار وصلاحيات للاستخدام اليومي الآمن.", helpSection: "users" } },
  { id: "settings", group: "administration", heavy: true, meta: { title: "الإعدادات", breadcrumb: "الإدارة / الإعدادات", hint: "خيارات مجمعة بتبويبات مع حفظ صريح للتغييرات.", helpSection: "reports-settings" } },
  { id: "history", group: "administration", heavy: false, meta: { title: "سجل التغييرات", breadcrumb: "الإدارة / السجل", hint: "مراجعة عمليات الإنشاء والتعديل والحذف.", helpSection: "notifications-guide" } },
  { id: "activity", group: "administration", heavy: true, meta: { title: "سجل النشاط", breadcrumb: "الإدارة / النشاط", hint: "خط زمني لكل العمليات مع فروقات قبل/بعد وتراجع وإعادة متعددة المستويات.", helpSection: "notifications-guide" } },
  { id: "errors", group: "administration", heavy: true, meta: { title: "سجل الأخطاء", breadcrumb: "الإدارة / الأخطاء", hint: "أخطاء بطبقات مبسطة/تقنية، طابور عمليات معلّقة، وإعادة محاولة بضغطة.", helpSection: "notifications-guide" } },
  { id: "help", group: "administration", heavy: true, meta: { title: "المساعدة", breadcrumb: "الدليل / مركز المعرفة", hint: "مساعدة قابلة للبحث وروابط مباشرة للأقسام.", helpSection: "getting-started" } },
  { id: "backup", group: "maintenance", heavy: true, meta: { title: "مركز البيانات", breadcrumb: "الصيانة / النسخ والنقل", hint: "تصدير، استيراد، نقل لجهاز آخر، ونسخ احتياطي بخطوات واضحة.", helpSection: "transfer-export" } },
  { id: "uploader", group: "production", heavy: false, meta: { title: "رفع الملفات", breadcrumb: "الإنتاج / رفع الملفات", hint: "ارفع الوسائط إلى مخزن الملفات (محلي/سحابي) وأدِرها.", helpSection: "transfer-export" } },
  { id: "transcriber", group: "production", heavy: false, meta: { title: "التفريغ الصوتي", breadcrumb: "الإنتاج / التفريغ", hint: "حوّل الصوت/الفيديو إلى نصّ بطوابع زمنية — سحابيًّا أو محليًّا.", helpSection: "adding-videos" } },
  { id: "reports", group: "production", heavy: true, meta: { title: "التقارير", breadcrumb: "الإنتاج / التقارير", hint: "إحصاءات وسجلات نشاط تساعدك على مراجعة الأرشيف.", helpSection: "reports-settings" } },
  { id: "sync-log", group: "maintenance", heavy: true, meta: { title: "سجل المزامنة", breadcrumb: "الصيانة / المزامنة", hint: "كل عمليات تصدير ودمج حزم النقل بين الأجهزة مع تفاصيل الـ checksum.", helpSection: "transfer-export" } },
  { id: "favorites", group: "daily", heavy: false, meta: { title: "المفضلة", breadcrumb: "الرئيسية / المفضلة", hint: "العناصر والمجموعات والمجلدات المفضلة للوصول السريع.", helpSection: "dashboard-archive" } },
  { id: "reading-lists", group: "daily", heavy: false, meta: { title: "قوائم المراجعة", breadcrumb: "الرئيسية / قوائم المراجعة", hint: "شاهد لاحقاً وقوائم مراجعة مخصصة لتتبع تقدمك في مراجعة الأرشيف.", helpSection: "dashboard-archive" } },
  { id: "server-status", group: "maintenance", heavy: false, meta: { title: "حالة السيرفر", breadcrumb: "الصيانة / حالة السيرفر", hint: "مراقبة الاتصال وصحة قاعدة البيانات وزمن الاستجابة ومدة تشغيل السيرفر.", helpSection: "transfer-export" } },
  { id: "duplicates", group: "maintenance", heavy: false, meta: { title: "كشف المكررات", breadcrumb: "الصيانة / المكررات", hint: "فحص الأرشيف بحثاً عن عناصر مكررة بناءً على العنوان والرابط والحجم وبصمة الملف.", helpSection: "transfer-export" } },
  { id: "saved-searches", group: "daily", heavy: false, meta: { title: "البحوث المحفوظة", breadcrumb: "الرئيسية / البحوث المحفوظة", hint: "احفظ استعلامات البحث وشغّلها بنقرة، أو فعّل تنبيهاً عند ظهور عناصر جديدة مطابقة.", helpSection: "searching" } }
];

export const PAGE_CONTEXT_META = Object.fromEntries(
  PAGE_MANIFEST.map((page) => [page.id, page.meta])
);

export const PAGE_GROUPS = PAGE_MANIFEST.reduce((groups, page) => {
  groups[page.group] = groups[page.group] || [];
  groups[page.group].push(page.id);
  return groups;
}, {});

export const HEAVY_PAGE_IDS = PAGE_MANIFEST.filter((page) => page.heavy).map((page) => page.id);
