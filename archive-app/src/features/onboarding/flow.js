export const ONBOARDING_STEPS = [
  { id: "welcome", label: "البدء", detail: "فهم أين تحفظ البيانات وكيف تبدأ أول مهمة." },
  { id: "storage", label: "التخزين", detail: "اختيار مكان حفظ البيانات: هذا الجهاز أو خادم سحابي." },
  { id: "security", label: "الحماية", detail: "اختيار الإعداد الآمن أو البدء السريع." },
  { id: "admin", label: "المدير", detail: "تعريف كلمة مرور المدير عند اختيار الإعداد الآمن." },
  { id: "appearance", label: "المظهر", detail: "اختيار Ink Slate أو Warm Off-white ولون التفاعل." },
  { id: "interface", label: "الواجهة", detail: "شرح الشريط الجانبي، شريط السياق، مركز التحكم، ومركز البيانات." },
  { id: "shortcuts", label: "الاختصارات", detail: "أهم اختصارات لوحة المفاتيح لتسريع العمل اليومي." },
  { id: "data", label: "البيانات", detail: "كيف تحفظ نسخة احتياطية، تستورد، أو تنقل لجهاز آخر." }
];

// Storage backend options surfaced in the setup wizard. The id maps 1:1 to
// BACKEND_CHOICES in bootstrap/backendChoice.js. "local" needs no URL; the
// cloud backends need a server address the user pastes in.
export const ONBOARDING_STORAGE_OPTIONS = [
  {
    id: "postgres",
    label: "SQL على الخادم",
    detail: "موصى به. مصدر حقيقة مركزي عبر archive-server مع مراقبة صحة قاعدة البيانات.",
    needsUrl: true,
    urlPlaceholder: "https://archive.example.com"
  },
  {
    id: "local",
    label: "محلي مستقل",
    detail: "أوفلاين على هذا الجهاز فقط. مناسب للتجربة أو العمل المنفصل.",
    needsUrl: false
  },
  {
    id: "pocketbase",
    label: "خادم PocketBase",
    detail: "بديل أخفّ. خادم واحد بملف SQLite + واجهة إدارة مدمجة.",
    needsUrl: true,
    urlPlaceholder: "https://archive.example.com"
  }
];

export const ONBOARDING_SERVER_UPDATE_OPTIONS = [
  {
    id: "stable",
    label: "مستقر",
    detail: "مناسب لمعظم الفرق. يقبل تحديثات الخادم بعد اختبارها ويحافظ على توافق API الحالي.",
    badge: "موصى به"
  },
  {
    id: "preview",
    label: "تجريبي",
    detail: "لبيئات الاختبار قبل الإنتاج. استخدمه عند تجربة نسخة خادم أحدث أو ميزات قادمة.",
    badge: "اختبار"
  },
  {
    id: "legacy",
    label: "توافق قديم",
    detail: "للخوادم الأقدم مؤقتاً. يذكّر المشغل بمراجعة الترقية قبل ربط أجهزة جديدة.",
    badge: "حذر"
  }
];

// Power-user keyboard shortcuts surfaced during onboarding so first-time
// users discover them without having to dig into the Help page.
export const ONBOARDING_SHORTCUTS = [
  { keys: ["Ctrl", "K"], label: "لوحة الأوامر", detail: "بحث سريع في كل الإجراءات والصفحات." },
  { keys: ["A"], label: "إنشاء سريع", detail: "افتح نافذة إنشاء مادة أو كيان داعم من أي صفحة." },
  { keys: ["/"], label: "تركيز البحث", detail: "اقفز إلى حقل البحث في الأرشيف." },
  { keys: ["?"], label: "قائمة الاختصارات", detail: "افتح قائمة كل الاختصارات الكاملة." }
];

// Data-center capabilities introduced during onboarding so users know
// where backup, import, and transfer flows live before they need them.
export const ONBOARDING_DATA_TOPICS = [
  { id: "backup", label: "النسخ الاحتياطي", detail: "صدّر كل أرشيفك كملف JSON يمكن استعادته لاحقاً." },
  { id: "import", label: "الاستيراد", detail: "ادمج نسخة سابقة أو استورد من ملف Excel." },
  { id: "transfer", label: "النقل بين الأجهزة", detail: "أنشئ ملف نقل مع checksum لاستعادته على جهاز آخر." },
  { id: "audit", label: "سجل العمليات", detail: "تتبع من غيّر ماذا ومتى لكل عملية على الأرشيف." }
];

export const ONBOARDING_THEME_OPTIONS = [
  { id: "dark", label: "ليلي حبري", detail: "Ink Slate مريح للفهرسة الطويلة." },
  { id: "light", label: "نهاري دافئ", detail: "Warm Off-white لتقليل إجهاد العين." },
  { id: "system", label: "حسب النظام", detail: "يتبع إعداد المتصفح تلقائيًا." }
];

export const ONBOARDING_ACCENT_OPTIONS = [
  { id: "teal", label: "فيروزي هادئ", color: "#14b8a6" },
  { id: "indigo", label: "نيلي هادئ", color: "#6366f1" }
];

export const CORE_UI_TOUR_ITEMS = [
  { label: "الشريط الجانبي", detail: "مرتكز يمينًا للوصول السريع إلى الشاشات الأساسية." },
  { label: "شريط السياق", detail: "يعرض عنوان الصفحة، مسارها، الإجراء الأساسي، والمساعدة." },
  { label: "مركز التحكم", detail: "بداية يومية للجاهزية، الإضافة، البحث، والنقل." },
  { label: "مركز البيانات", detail: "تصدير، استيراد، وملف نقل لجهاز آخر." }
];
