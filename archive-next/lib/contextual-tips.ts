import type { NavigationRole } from "@/lib/navigation";

// ponytail: contextual tips per page, persisted in localStorage
export interface Tip {
  title: string;
  description: string;
  icon?: string;
  roles?: readonly NavigationRole[];
}

export type PageKey =
  | "search"
  | "archive"
  | "collections"
  | "settings"
  | "montage"
  | "vocabulary"
  | "graph"
  | "sync"
  | "analytics"
  | "uploads"
  | "activity"
  | "first-run"
  | "media-review"
  | "files"
  | "timeline"
  | "types"
  | "transcriber"
  | "favorites"
  | "reports"
  | "media-play"
  | "status"
  | "trash"
  | "errors"
  | "kanban"
  | "tags"
  | "shares-with-me"
  | "reading-lists"
  | "duplicates"
  | "dashboard"
  | "shares"
  | "media-jobs"
  | "ingest"
  | "projects"
  | "settings-users"
  | "media-compare"
  | "system-control"
  | "discover"
  | "plugins"
  | "broadcast"
  | "inbox"
  | "notifications"
  | "help"
  | "search-saved"
  | "data-center"
  | "copilot"
  | "backup"
  | "automation"
  | "collaboration"
  | "rights";

export const pageTips: Record<PageKey, Tip[]> = {
  search: [
    {
      title: "البحث المتقدم",
      description: "استخدم عوامل التصفية لتضييق النتائج حسب التاريخ أو النوع أو الحالة",
      icon: "Filter"
    },
    {
      title: "حفظ عمليات البحث",
      description: "يمكنك حفظ عمليات البحث المفضلة لاستعادتها بسرعة لاحقاً"
    },
    {
      title: "المفاتيح السريعة",
      description: "اضغط Ctrl+K لفتح لوحة الأوامر والبحث عن السجلات مباشرة",
      icon: "Keyboard"
    },
    {
      title: "عرض النتائج",
      description: "بدّل بين عروض الجدول والبطاقات من شريط الأدوات"
    },
    {
      title: "المقاييس",
      description: "شريط المقاييس أعلاه يعرض ملخص عدد السجلات والفئات"
    }
  ],
  archive: [
    {
      title: "السجلات",
      description: "كل سجل يمثل عنصراً واحداً من مجموعتك — مع البيانات الوصفية والملفات المرتبطة",
      icon: "FileText"
    },
    {
      title: "تعديل السجلات",
      description: "انقر على سجل لعرض التفاصيل الكاملة والتعديل على البيانات الوصفية",
      icon: "Edit",
      roles: ["editor", "admin"]
    },
    {
      title: "وضع القراءة",
      description: "يمكنك فتح السجلات والملفات المرتبطة بها دون ظهور إجراءات التعديل أو الحذف",
      icon: "Eye",
      roles: ["viewer"]
    },
    {
      title: "الملفات المرتبطة",
      description: "تصفح الوسائط والملفات المرفقة بالسجل من تبويب الملفات"
    },
    {
      title: "المشاركة والحقوق",
      description: "تحكم في من يمكنه الوصول إلى السجل من خلال إنشاء روابط مشاركة",
      icon: "Share"
    },
    {
      title: "الحالات",
      description: "تتبع حالة السجل (مسودة، مراجعة، منشور) من الشريط الجانبي"
    }
  ],
  montage: [
    {
      title: "عرض المونتاج",
      description: "نسق البطاقات والصور بشكل مرئي لمقارنة السجلات وتجميعها",
      icon: "Grid"
    },
    {
      title: "إعادة الترتيب",
      description: "اسحب وأفلت البطاقات لتنظيم العناصر بالطريقة التي تريدها"
    },
    {
      title: "التصفية السريعة",
      description: "استخدم عوامل التصفية في الشريط الجانبي لإظهار مجموعات معينة فقط"
    },
    {
      title: "التصدير",
      description: "صدّر قائمة المجموعة الحالية بصيغة CSV أو JSON للمعالجة الإضافية"
    },
    {
      title: "الإضافة السريعة",
      description: "استخدم زر '+' لإنشاء سجلات جديدة أثناء العرض دون مغادرة الصفحة"
    }
  ],
  settings: [
    {
      title: "الإعدادات الشخصية",
      description: "عدّل تفضيلاتك، اللغة، والمظهر من صفحة الإعدادات",
      icon: "Settings"
    },
    {
      title: "المتقدمة",
      description: "خيارات متقدمة متاحة لتخصيص السلوك والأداء"
    },
    {
      title: "التكاملات",
      description: "أضف وأدر التطبيقات والخدمات الخارجية التي تتصل بأرشيفك"
    },
    {
      title: "النسخة الاحتياطية والاستعادة",
      description: "إنشاء نسخ احتياطية من بيانات الأرشيف واستعادتها عند الحاجة"
    }
  ],
  collections: [
    {
      title: "المجموعات",
      description: "نظم السجلات في مجموعات حسب الموضوع أو المشروع",
      icon: "Folder"
    },
    {
      title: "إنشاء مجموعة جديدة",
      description: "انقر على 'مجموعة جديدة' لإنشاء مساحة تنظيم منفصلة"
    },
    {
      title: "المشاركة بين الفريق",
      description: "شارك المجموعات مع أعضاء الفريق بمستويات وصول مختلفة"
    },
    {
      title: "الأرشفة",
      description: "أرشف المجموعات القديمة للحفاظ على قائمة عملك نظيفة"
    }
  ],
  vocabulary: [
    { title: "المفردات الموحدة", description: "أدر المصطلحات والمرادفات المستخدمة عبر تصنيف السجلات", icon: "BookOpen" },
    { title: "الاستيراد والتصدير", description: "صدّر أو استورد المفردات بصيغة CSV أو JSON مع دمج المرادفات تلقائياً" }
  ],
  graph: [
    { title: "خريطة العلاقات", description: "استكشف الروابط بين السجلات بصرياً من خلال العقد والخطوط", icon: "Share2" },
    { title: "التصفية", description: "ركّز على نوع علاقة معين لتبسيط الرسم البياني" }
  ],
  sync: [
    { title: "سجل المزامنة", description: "تابع حالة كل عملية مزامنة مع مزودي التخزين الخارجيين", icon: "RefreshCw" },
    { title: "إعادة المحاولة", description: "أعد تشغيل العمليات الفاشلة مباشرة من هذا السجل" }
  ],
  analytics: [
    { title: "تحليلات الأرشيف", description: "راقب اتجاهات النمو واستخدام التخزين عبر الزمن", icon: "BarChart2" },
    { title: "تصدير التقارير", description: "صدّر الرسوم البيانية والبيانات لمشاركتها مع فريقك" }
  ],
  uploads: [
    { title: "إضافة أرشيف", description: "اسحب وأفلت الملفات أو اخترها لبدء الاستيراد", icon: "Upload" },
    { title: "المعالجة بالخلفية", description: "تتابع الملفات الكبيرة معالجتها في الخلفية دون حجب العمل" }
  ],
  activity: [
    { title: "سجل النشاط", description: "راجع كل الإجراءات التي تمت على الأرشيف بالترتيب الزمني", icon: "Activity" },
    { title: "التصفية حسب المستخدم", description: "صفِّ السجل حسب المستخدم أو نوع الحدث" }
  ],
  "first-run": [
    { title: "مسار التهيئة", description: "أكمل خطوات الإعداد الأولى لتجهيز مساحة العمل", icon: "Rocket" },
    { title: "التخطي لاحقاً", description: "يمكنك تخطي أي خطوة والعودة إليها لاحقاً من الإعدادات" }
  ],
  "media-review": [
    { title: "المراجعة المرئية", description: "عاين الوسائط وأضف ملاحظات المراجعة قبل الاعتماد", icon: "Eye" },
    { title: "القرارات السريعة", description: "استخدم أزرار القبول والرفض لتسريع دورة المراجعة" }
  ],
  files: [
    { title: "مستعرض الملفات", description: "تصفح بنية الملفات والمجلدات المرتبطة بالأرشيف", icon: "Folder" },
    { title: "المعاينة", description: "انقر على ملف لمعاينته دون تنزيله" }
  ],
  timeline: [
    { title: "الخط الزمني", description: "اعرض السجلات مرتبة زمنياً لفهم تسلسل الأحداث", icon: "Clock" },
    { title: "التكبير", description: "كبّر أو صغّر النطاق الزمني لتغيير مستوى التفاصيل" }
  ],
  types: [
    { title: "الأنواع", description: "أدر أنواع وفئات السجلات المستخدمة في التصنيف", icon: "Tag" },
    { title: "الحقول المخصصة", description: "أضف حقولاً مخصصة لكل نوع لتوثيق بيانات إضافية" }
  ],
  transcriber: [
    { title: "التفريغ الصوتي", description: "حوّل الوسائط الصوتية والمرئية إلى نص قابل للبحث", icon: "Mic" },
    { title: "التدقيق اليدوي", description: "راجع النص المفرّغ وعدّله قبل الاعتماد النهائي" }
  ],
  favorites: [
    { title: "المفضلة", description: "احتفظ بالسجلات التي تعود إليها كثيراً في مكان واحد", icon: "Star" },
    { title: "الإزالة السريعة", description: "انقر على أيقونة النجمة لإزالة عنصر من المفضلة" }
  ],
  reports: [
    { title: "التقارير", description: "أنشئ تقارير امتثال ونمو تخزين جاهزة للمشاركة", icon: "FileBarChart" },
    { title: "الجدولة", description: "جدول توليد التقارير بشكل دوري تلقائياً" }
  ],
  "media-play": [
    { title: "مشغل الوسائط", description: "شغّل الملفات الصوتية والمرئية مباشرة داخل الأرشيف", icon: "Play" },
    { title: "علامات الوقت", description: "أضف علامات زمنية أثناء التشغيل للرجوع إليها لاحقاً" }
  ],
  status: [
    { title: "حالة النظام", description: "راقب صحة الخدمات والمهام التشغيلية في مكان واحد", icon: "Activity" },
    { title: "التنبيهات", description: "تابع أي تحذيرات تحتاج إلى تدخل سريع" }
  ],
  trash: [
    { title: "سلة المهملات", description: "استعد العناصر المحذوفة خلال فترة الاحتفاظ المحددة", icon: "Trash2" },
    { title: "الحذف النهائي", description: "احذف نهائياً فقط عند التأكد من عدم الحاجة للعنصر" }
  ],
  errors: [
    { title: "سجل الأخطاء", description: "راجع الأخطاء التي واجهها النظام لتشخيصها وحلها", icon: "AlertTriangle" },
    { title: "التصفية", description: "صفِّ حسب الشدة أو المصدر لتضييق نطاق البحث" }
  ],
  kanban: [
    { title: "كانبان", description: "نظم العمل في أعمدة حسب حالة كل سجل", icon: "Columns" },
    { title: "السحب والإفلات", description: "اسحب البطاقات بين الأعمدة لتحديث حالتها فوراً" }
  ],
  tags: [
    { title: "الوسوم", description: "أدر الوسوم المستخدمة لتصنيف السجلات عبر الأرشيف", icon: "Tag" },
    { title: "الدمج", description: "ادمج الوسوم المتشابهة لتقليل التكرار" }
  ],
  "shares-with-me": [
    { title: "مشاركات واردة", description: "استعرض العناصر التي شاركها معك الآخرون", icon: "Share2" },
    { title: "الوصول", description: "افتح العنصر مباشرة من هنا حسب صلاحيتك" }
  ],
  "reading-lists": [
    { title: "قوائم القراءة", description: "اجمع السجلات ذات الصلة في قوائم مخصصة للمراجعة لاحقاً", icon: "List" },
    { title: "الترتيب", description: "أعد ترتيب العناصر داخل القائمة حسب الأولوية" }
  ],
  duplicates: [
    { title: "المكررات", description: "اكتشف السجلات المتشابهة أو المكررة داخل الأرشيف", icon: "Copy" },
    { title: "الدمج", description: "ادمج السجلات المكررة أو تجاهل التطابق حسب الحاجة" }
  ],
  dashboard: [
    { title: "لوحة المتابعة", description: "نظرة سريعة على أحدث النشاط ومؤشرات الأرشيف", icon: "LayoutDashboard" },
    { title: "الاختصارات", description: "استخدم البطاقات السريعة للانتقال إلى الأقسام الأكثر استخداماً" }
  ],
  shares: [
    { title: "روابط المشاركة", description: "أنشئ روابط مشاركة محكومة الصلاحية والانتهاء", icon: "Share2" },
    { title: "الإلغاء", description: "ألغِ أي رابط مشاركة في أي وقت لإيقاف الوصول فوراً" }
  ],
  "media-jobs": [
    { title: "مسار الوسائط", description: "تابع مهام معالجة الوسائط قيد التنفيذ والمكتملة", icon: "ListChecks" },
    { title: "إعادة المحاولة", description: "أعد تشغيل المهام الفاشلة دون إعادة الرفع" }
  ],
  ingest: [
    { title: "استيراد المحتوى", description: "استورد دفعات من السجلات والملفات من مصادر خارجية", icon: "Import", roles: ["editor", "admin"] },
    { title: "التحقق قبل الاستيراد", description: "راجع نتائج التحقق قبل تأكيد عملية الاستيراد", roles: ["editor", "admin"] },
    { title: "وضع القراءة", description: "يمكنك مراجعة نتائج الاستيراد دون تشغيل عمليات فحص أو سحب جديدة", icon: "Eye", roles: ["viewer"] }
  ],
  projects: [
    { title: "المشاريع", description: "نظم السجلات ضمن مشاريع لها فرق وأهداف مستقلة", icon: "Briefcase" },
    { title: "الأعضاء", description: "أدر أعضاء المشروع وصلاحياتهم من هذه الصفحة" }
  ],
  "settings-users": [
    { title: "المستخدمون والأدوار", description: "أدر حسابات المستخدمين وأدوارهم داخل النظام", icon: "Users", roles: ["admin"] },
    { title: "الصلاحيات", description: "حدد صلاحيات كل دور بدقة حسب الحاجة", roles: ["admin"] },
    { title: "وضع القراءة", description: "هذه الصفحة مقتصرة على المدراء؛ لا يمكنك دعوة أعضاء أو تعديل الأدوار", icon: "Eye", roles: ["editor", "viewer"] }
  ],
  "media-compare": [
    { title: "مقارنة الوسائط", description: "قارن نسختين من ملف وسائط جنباً إلى جنب", icon: "Columns2" },
    { title: "الفروقات", description: "أبرز الفروقات بين النسختين لتسهيل المراجعة" }
  ],
  "system-control": [
    { title: "التحكم بالنظام", description: "أدر إعدادات النظام التشغيلية والخدمات المرتبطة", icon: "Settings2" },
    { title: "الحذر مطلوب", description: "بعض الإجراءات هنا تؤثر على كامل النظام فور تنفيذها" }
  ],
  discover: [
    { title: "الاكتشاف", description: "استكشف مسارات ومحتوى مقترح بناءً على اهتماماتك", icon: "Compass" },
    { title: "الحفظ", description: "احفظ ما يعجبك للرجوع إليه من المفضلة" }
  ],
  plugins: [
    { title: "الإضافات", description: "فعّل أو عطّل الإضافات التي توسع قدرات الأرشيف", icon: "Puzzle" },
    { title: "الإعدادات المخصصة", description: "لكل إضافة إعدادات خاصة بها قابلة للتخصيص" }
  ],
  broadcast: [
    { title: "محاكاة البث", description: "اختبر سيناريوهات البث قبل تطبيقها فعلياً", icon: "Radio" },
    { title: "السجل", description: "راجع سجل المحاكاة السابقة لمقارنة النتائج" }
  ],
  inbox: [
    { title: "صندوق الوارد", description: "استقبل العناصر والطلبات الجديدة الموجهة إليك", icon: "Inbox" },
    { title: "الأرشفة السريعة", description: "أرشف العناصر المعالجة لإبقاء الصندوق نظيفاً" }
  ],
  notifications: [
    { title: "الإشعارات", description: "تابع كل التنبيهات المتعلقة بنشاطك وفريقك", icon: "Bell" },
    { title: "التفضيلات", description: "خصص أنواع الإشعارات التي تريد استلامها من الإعدادات" }
  ],
  help: [
    { title: "مركز المساعدة", description: "ابحث عن إجابات وأدلة استخدام لجميع أقسام الأرشيف", icon: "HelpCircle" },
    { title: "الدعم", description: "تواصل مع الدعم الفني إذا لم تجد ما تبحث عنه" }
  ],
  "search-saved": [
    { title: "البحوث المحفوظة", description: "أعد تشغيل عمليات بحث سبق أن حفظتها بضغطة واحدة", icon: "BookmarkCheck" },
    { title: "التنظيم", description: "احذف أو أعد تسمية البحوث المحفوظة القديمة" }
  ],
  "data-center": [
    { title: "مركز البيانات", description: "راقب مساحة التخزين وتوزعها عبر مزودي الخدمة", icon: "Database" },
    { title: "التنبؤ بالنمو", description: "اطّلع على توقعات نمو التخزين المستقبلية" }
  ],
  copilot: [
    { title: "مساعد الأرشيف", description: "اطرح أسئلة عن سجلاتك واحصل على إجابات فورية بالذكاء الاصطناعي", icon: "Sparkles" },
    { title: "الاقتراحات", description: "اقبل أو ارفض الاقتراحات المولدة تلقائياً حسب الحاجة" }
  ],
  backup: [
    { title: "النسخ الاحتياطي", description: "أنشئ نسخاً احتياطية دورية من بيانات الأرشيف", icon: "HardDriveDownload", roles: ["admin"] },
    { title: "الاستعادة", description: "استعد نسخة سابقة عند حدوث خلل أو فقدان بيانات", roles: ["admin"] },
    { title: "وضع القراءة", description: "هذه الصفحة متاحة للمشرفين فقط؛ لا يمكنك إنشاء أو استعادة نسخ احتياطية", icon: "Eye", roles: ["editor", "viewer"] }
  ],
  automation: [
    { title: "الأتمتة", description: "أنشئ قواعد تلقائية تُنفذ إجراءات عند تحقق شروط معينة", icon: "Zap", roles: ["editor", "admin"] },
    { title: "الاختبار", description: "اختبر القاعدة قبل تفعيلها لتجنب نتائج غير متوقعة", roles: ["editor", "admin"] },
    { title: "وضع القراءة", description: "يمكنك مراجعة القواعد وسجل التشغيل دون إنشاء أو تعديل أو حذف قواعد", icon: "Eye", roles: ["viewer"] }
  ],
  collaboration: [
    { title: "التعاون الحي", description: "تابع من يعمل حالياً على نفس السجل معك في الوقت الفعلي", icon: "Users" },
    { title: "التعليقات", description: "أضف تعليقات مباشرة لتنسيق العمل مع الفريق" }
  ],
  rights: [
    { title: "حقوق الاستخدام", description: "حدد قيود الاستخدام والترخيص لكل سجل", icon: "Shield", roles: ["editor", "admin"] },
    { title: "الامتثال", description: "تتبع حالات انتهاء الحقوق لتفادي الاستخدام غير المصرح به" },
    { title: "وضع القراءة", description: "يمكنك مراجعة سجلات الحقوق وحالة الإنفاذ دون تسجيل حقوق جديدة", icon: "Eye", roles: ["viewer"] }
  ]
};

export function getPageTips(page: PageKey, role?: NavigationRole): Tip[] {
  return pageTips[page].filter((tip) => !tip.roles || (role ? tip.roles.includes(role) : false));
}

const TIPS_DISMISSED_KEY = "masar.tipsDismissed";
const TIPS_SESSION_DISMISSED_KEY = "masar.tipsDismissedSession";
const TIPS_ENABLED_KEY = "masar.contextualTipsEnabled";

function getDismissedTips(): Set<PageKey> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = localStorage.getItem(TIPS_DISMISSED_KEY);
    return new Set((stored ? JSON.parse(stored) : []) as PageKey[]);
  } catch {
    return new Set();
  }
}

function setDismissedTips(dismissed: Set<PageKey>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TIPS_DISMISSED_KEY, JSON.stringify([...dismissed]));
  } catch {
    // Silent fail on storage errors
  }
}

export function isTipsDismissed(page: PageKey): boolean {
  return getDismissedTips().has(page);
}

export function dismissTips(page: PageKey): void {
  const dismissed = getDismissedTips();
  dismissed.add(page);
  setDismissedTips(dismissed);
}

export function showTipsForPage(page: PageKey): void {
  const dismissed = getDismissedTips();
  dismissed.delete(page);
  setDismissedTips(dismissed);
}

function getSessionDismissedTips(): Set<PageKey> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = sessionStorage.getItem(TIPS_SESSION_DISMISSED_KEY);
    return new Set((stored ? JSON.parse(stored) : []) as PageKey[]);
  } catch {
    return new Set();
  }
}

function setSessionDismissedTips(dismissed: Set<PageKey>): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(TIPS_SESSION_DISMISSED_KEY, JSON.stringify([...dismissed]));
  } catch {
    // Silent fail on storage errors
  }
}

/** Hidden for the current tab session only — reappears after a page refresh/new session. */
export function isTipsDismissedForSession(page: PageKey): boolean {
  return getSessionDismissedTips().has(page);
}

export function dismissTipsForSession(page: PageKey): void {
  const dismissed = getSessionDismissedTips();
  dismissed.add(page);
  setSessionDismissedTips(dismissed);
}

/** Global kill switch surfaced in Settings — overrides per-page dismiss state either way. */
export function isTipsEnabledGlobally(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(TIPS_ENABLED_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setTipsEnabledGlobally(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TIPS_ENABLED_KEY, enabled ? "true" : "false");
    if (enabled) resetAllDismissedTips();
  } catch {
    // Silent fail on storage errors
  }
}

/** Clears every permanent and session dismissal — used when re-enabling tips from Settings. */
export function resetAllDismissedTips(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TIPS_DISMISSED_KEY);
    sessionStorage.removeItem(TIPS_SESSION_DISMISSED_KEY);
  } catch {
    // Silent fail on storage errors
  }
}
