import type { NavigationRole } from "@/lib/navigation";
import type { AppLocale } from "@/lib/i18n/types";

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
      description: "انقر على 'مجموعة جديدة' لإنشاء مساحة تنظيم منفصلة",
      roles: ["editor", "admin"]
    },
    {
      title: "المشاركة بين الفريق",
      description: "شارك المجموعات مع أعضاء الفريق بمستويات وصول مختلفة"
    },
    {
      title: "الأرشفة",
      description: "أرشف المجموعات القديمة للحفاظ على قائمة عملك نظيفة",
      roles: ["editor", "admin"]
    },
    {
      title: "وضع القراءة",
      description: "يمكنك عرض المجموعات المحفوظة دون إنشاء أو حذف مجموعات",
      icon: "Eye",
      roles: ["viewer"]
    }
  ],
  vocabulary: [
    { title: "المفردات الموحدة", description: "أدر المصطلحات والمرادفات المستخدمة عبر تصنيف السجلات", icon: "BookOpen", roles: ["editor", "admin"] },
    { title: "الاستيراد والتصدير", description: "صدّر أو استورد المفردات بصيغة CSV أو JSON مع دمج المرادفات تلقائياً", roles: ["editor", "admin"] },
    { title: "وضع القراءة", description: "يمكنك تصفح المفردات المحفوظة دون إضافة أو حذف مصطلحات", icon: "Eye", roles: ["viewer"] }
  ],
  graph: [
    { title: "خريطة العلاقات", description: "استكشف الروابط بين السجلات بصرياً من خلال العقد والخطوط", icon: "Share2" },
    { title: "التصفية", description: "ركّز على نوع علاقة معين لتبسيط الرسم البياني" },
    { title: "إضافة علاقات", description: "أنشئ أو احذف علاقات يدوية بين السجلات من لوحة العقدة المحددة", roles: ["editor", "admin"] },
    { title: "وضع القراءة", description: "يمكنك استكشاف العلاقات القائمة دون إنشاء أو حذف علاقات جديدة", icon: "Eye", roles: ["viewer"] }
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
    { title: "المعاينة", description: "انقر على ملف لمعاينته دون تنزيله" },
    { title: "فحص التخزين والمشاركة", description: "أعد فحص التخزين أو أنشئ روابط مشاركة للملفات المحددة", roles: ["editor", "admin"] },
    { title: "وضع القراءة", description: "يمكنك تصفح الملفات ومعاينتها دون فحص التخزين أو إنشاء مشاركات", icon: "Eye", roles: ["viewer"] }
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
    { title: "سلة المهملات", description: "استعد العناصر المحذوفة خلال فترة الاحتفاظ المحددة", icon: "Trash2", roles: ["editor", "admin"] },
    { title: "الحذف النهائي", description: "احذف نهائياً فقط عند التأكد من عدم الحاجة للعنصر — مقتصر على المدراء", roles: ["admin"] },
    { title: "وضع القراءة", description: "يمكنك مراجعة العناصر المحذوفة دون استعادتها أو حذفها نهائياً", icon: "Eye", roles: ["viewer"] }
  ],
  errors: [
    { title: "سجل الأخطاء", description: "راجع الأخطاء التي واجهها النظام لتشخيصها وحلها", icon: "AlertTriangle" },
    { title: "التصفية", description: "صفِّ حسب الشدة أو المصدر لتضييق نطاق البحث" }
  ],
  kanban: [
    { title: "كانبان", description: "نظم العمل في أعمدة حسب حالة كل سجل", icon: "Columns", roles: ["editor", "admin"] },
    { title: "السحب والإفلات", description: "اسحب البطاقات بين الأعمدة لتحديث حالتها فوراً", roles: ["editor", "admin"] },
    { title: "وضع القراءة", description: "يمكنك عرض حالة كل سجل ضمن سير العمل دون نقله بين الأعمدة", icon: "Eye", roles: ["viewer"] }
  ],
  tags: [
    { title: "الوسوم", description: "أدر الوسوم المستخدمة لتصنيف السجلات عبر الأرشيف", icon: "Tag", roles: ["editor", "admin"] },
    { title: "الدمج", description: "ادمج الوسوم المتشابهة لتقليل التكرار", roles: ["editor", "admin"] },
    { title: "وضع القراءة", description: "يمكنك تصفح الوسوم وتكراراتها دون تعديل الأيقونة أو اللون أو الأب", icon: "Eye", roles: ["viewer"] }
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

type TipCopy = Pick<Tip, "title" | "description">;

const englishTipCopy: Record<PageKey, readonly TipCopy[]> = {
  search: [
    { title: "Advanced search", description: "Use filters to narrow results by date, type, or status." },
    { title: "Save searches", description: "Save frequently used searches so you can return to them quickly." },
    { title: "Keyboard shortcuts", description: "Press Ctrl+K to open the command palette and search records directly." },
    { title: "Result view", description: "Switch between table and card views from the toolbar." },
    { title: "Metrics", description: "The metrics bar above summarizes record and category counts." }
  ],
  archive: [
    { title: "Records", description: "Each record represents one item in your collection, with metadata and linked files." },
    { title: "Edit records", description: "Select a record to view its full details and edit its metadata." },
    { title: "Read-only mode", description: "Open records and their linked files without edit or delete actions." },
    { title: "Linked files", description: "Browse media and files attached to a record from the Files tab." },
    { title: "Sharing and rights", description: "Control who can access a record by creating share links." },
    { title: "Statuses", description: "Track a record's status—draft, in review, or published—from the sidebar." }
  ],
  montage: [
    { title: "Montage view", description: "Arrange cards and images visually to compare and group records." },
    { title: "Reorder", description: "Drag and drop cards to organize items the way you need." },
    { title: "Quick filtering", description: "Use the sidebar filters to show only selected groups." },
    { title: "Export", description: "Export the current group list as CSV or JSON for further work." },
    { title: "Quick add", description: "Use the + button to create records without leaving the view." }
  ],
  settings: [
    { title: "Personal settings", description: "Manage your preferences, language, and appearance from Settings." },
    { title: "Advanced", description: "Advanced options are available to tailor behavior and performance." },
    { title: "Integrations", description: "Add and manage external applications and services connected to your archive." },
    { title: "Backup and restore", description: "Create backups of archive data and restore them when needed." }
  ],
  collections: [
    { title: "Record groups", description: "Organize records into groups by topic or project." },
    { title: "Create a collection", description: "Select New collection to create a separate organizational space." },
    { title: "Team sharing", description: "Share collections with team members using different access levels." },
    { title: "Archive", description: "Archive older collections to keep your working list tidy." },
    { title: "Read-only mode", description: "View saved collections without creating or deleting them." }
  ],
  vocabulary: [
    { title: "Controlled vocabulary", description: "Manage terms and synonyms used to classify records." },
    { title: "Import and export", description: "Export or import vocabulary as CSV or JSON, merging synonyms automatically." },
    { title: "Read-only mode", description: "Browse saved vocabulary without adding or deleting terms." }
  ],
  graph: [
    { title: "Relationship map", description: "Explore links between records visually through nodes and lines." },
    { title: "Filter", description: "Focus on one relationship type to simplify the graph." },
    { title: "Add relationships", description: "Create or remove manual links between records from the selected node panel." },
    { title: "Read-only mode", description: "Explore existing relationships without creating or removing links." }
  ],
  sync: [
    { title: "Sync history", description: "Follow the status of each synchronization with external storage providers." },
    { title: "Retry", description: "Restart failed operations directly from this history." }
  ],
  analytics: [
    { title: "Archive analytics", description: "Monitor growth trends and storage use over time." },
    { title: "Export reports", description: "Export charts and data to share with your team." }
  ],
  uploads: [
    { title: "Add to archive", description: "Drag and drop files, or choose them to start importing." },
    { title: "Background processing", description: "Large files continue processing in the background without interrupting your work." }
  ],
  activity: [
    { title: "Activity log", description: "Review every action taken in the archive in chronological order." },
    { title: "Filter by user", description: "Filter the log by user or event type." }
  ],
  "first-run": [
    { title: "Setup journey", description: "Complete the initial setup steps to prepare your workspace." },
    { title: "Skip for now", description: "Skip any step and return to it later from Settings." }
  ],
  "media-review": [
    { title: "Visual review", description: "Preview media and add review notes before approval." },
    { title: "Quick decisions", description: "Use Accept and Reject to speed up the review cycle." }
  ],
  files: [
    { title: "File browser", description: "Browse the file and folder structure associated with the archive." },
    { title: "Preview", description: "Select a file to preview it without downloading it." },
    { title: "Check storage and share", description: "Recheck storage or create share links for selected files." },
    { title: "Read-only mode", description: "Browse and preview files without checking storage or creating shares." }
  ],
  timeline: [
    { title: "Timeline", description: "View records in chronological order to understand the sequence of events." },
    { title: "Zoom", description: "Zoom the time range in or out to change the level of detail." }
  ],
  types: [
    { title: "Types", description: "Manage record types and categories used for classification." },
    { title: "Custom fields", description: "Add custom fields to each type to capture additional information." }
  ],
  transcriber: [
    { title: "Transcription", description: "Turn audio and video into searchable text." },
    { title: "Manual review", description: "Review and edit the transcript before final approval." }
  ],
  favorites: [
    { title: "Favorites", description: "Keep records you return to often in one place." },
    { title: "Quick removal", description: "Select the star icon to remove an item from Favorites." }
  ],
  reports: [
    { title: "Reports", description: "Create compliance and storage-growth reports ready to share." },
    { title: "Scheduling", description: "Schedule reports to be generated automatically at regular intervals." }
  ],
  "media-play": [
    { title: "Media player", description: "Play audio and video files directly within the archive." },
    { title: "Time markers", description: "Add time markers while playing media so you can return to them later." }
  ],
  status: [
    { title: "System status", description: "Monitor service health and operational tasks in one place." },
    { title: "Alerts", description: "Follow warnings that need prompt attention." }
  ],
  trash: [
    { title: "Trash", description: "Restore deleted items during the configured retention period." },
    { title: "Delete permanently", description: "Permanently delete an item only when you are sure it is no longer needed; this is restricted to administrators." },
    { title: "Read-only mode", description: "Review deleted items without restoring or permanently deleting them." }
  ],
  errors: [
    { title: "Error log", description: "Review system errors to diagnose and resolve them." },
    { title: "Filter", description: "Filter by severity or source to narrow the results." }
  ],
  kanban: [
    { title: "Kanban", description: "Organize work in columns based on each record's status." },
    { title: "Drag and drop", description: "Drag cards between columns to update their status immediately." },
    { title: "Read-only mode", description: "View each record's workflow status without moving it between columns." }
  ],
  tags: [
    { title: "Tags", description: "Manage tags used to classify records throughout the archive." },
    { title: "Merge", description: "Merge similar tags to reduce duplication." },
    { title: "Read-only mode", description: "Browse tags and duplicates without editing the icon, color, or parent." }
  ],
  "shares-with-me": [
    { title: "Shared with me", description: "View items that other people have shared with you." },
    { title: "Access", description: "Open an item directly from here according to your permissions." }
  ],
  "reading-lists": [
    { title: "Reading lists", description: "Group related records into custom lists for later review." },
    { title: "Ordering", description: "Reorder items within a list by priority." }
  ],
  duplicates: [
    { title: "Duplicates", description: "Find similar or duplicate records in the archive." },
    { title: "Merge", description: "Merge duplicate records or ignore a match when appropriate." }
  ],
  dashboard: [
    { title: "Dashboard", description: "Get a quick view of recent activity and archive indicators." },
    { title: "Shortcuts", description: "Use quick cards to move to the sections you use most." }
  ],
  shares: [
    { title: "Share links", description: "Create share links with access and expiry controls." },
    { title: "Revoke", description: "Revoke a share link at any time to stop access immediately." }
  ],
  "media-jobs": [
    { title: "Media queue", description: "Follow media-processing jobs that are running or complete." },
    { title: "Retry", description: "Restart failed jobs without uploading the files again." }
  ],
  ingest: [
    { title: "Content ingest", description: "Import batches of records and files from external sources." },
    { title: "Validate before importing", description: "Review validation results before confirming an import." },
    { title: "Read-only mode", description: "Review import results without starting new validation or retrieval operations." }
  ],
  projects: [
    { title: "Projects", description: "Organize records into projects with independent teams and goals." },
    { title: "Members", description: "Manage project members and their permissions from this page." }
  ],
  "settings-users": [
    { title: "Users and roles", description: "Manage user accounts and roles in the system." },
    { title: "Permissions", description: "Set each role's permissions precisely as needed." },
    { title: "Read-only mode", description: "This page is restricted to administrators; you cannot invite members or edit roles." }
  ],
  "media-compare": [
    { title: "Compare media", description: "Compare two versions of a media file side by side." },
    { title: "Differences", description: "Highlight differences between versions to make review easier." }
  ],
  "system-control": [
    { title: "System control", description: "Manage operational settings and connected services." },
    { title: "Use caution", description: "Some actions here affect the entire system as soon as they run." }
  ],
  discover: [
    { title: "Discover", description: "Explore recommended paths and content based on your interests." },
    { title: "Save", description: "Save what interests you so you can return to it from Favorites." }
  ],
  plugins: [
    { title: "Plugins", description: "Enable or disable plugins that extend the archive's capabilities." },
    { title: "Custom settings", description: "Each plugin has its own settings that you can customize." }
  ],
  broadcast: [
    { title: "Broadcast simulation", description: "Test broadcast scenarios before applying them for real." },
    { title: "History", description: "Review previous simulation history to compare outcomes." }
  ],
  inbox: [
    { title: "Inbox", description: "Receive new items and requests addressed to you." },
    { title: "Quick archive", description: "Archive processed items to keep your inbox tidy." }
  ],
  notifications: [
    { title: "Notifications", description: "Follow alerts related to your activity and team." },
    { title: "Preferences", description: "Choose the notification types you want to receive in Settings." }
  ],
  help: [
    { title: "Help center", description: "Find answers and user guides for every archive area." },
    { title: "Support", description: "Contact technical support if you cannot find what you need." }
  ],
  "search-saved": [
    { title: "Saved searches", description: "Run a search you saved earlier with one click." },
    { title: "Organize", description: "Delete or rename older saved searches." }
  ],
  "data-center": [
    { title: "Data center", description: "Monitor storage capacity and distribution across service providers." },
    { title: "Growth forecast", description: "View projections for future storage growth." }
  ],
  copilot: [
    { title: "Archive assistant", description: "Ask questions about your records and get immediate answers with AI." },
    { title: "Suggestions", description: "Accept or reject automatically generated suggestions as needed." }
  ],
  backup: [
    { title: "Backup", description: "Create regular backups of archive data." },
    { title: "Restore", description: "Restore a previous backup when something goes wrong or data is lost." },
    { title: "Read-only mode", description: "This page is for administrators only; you cannot create or restore backups." }
  ],
  automation: [
    { title: "Automation", description: "Create rules that run actions automatically when specified conditions are met." },
    { title: "Test", description: "Test a rule before enabling it to avoid unexpected results." },
    { title: "Read-only mode", description: "Review rules and run history without creating, editing, or deleting rules." }
  ],
  collaboration: [
    { title: "Live collaboration", description: "See who is working on the same record with you in real time." },
    { title: "Comments", description: "Add comments directly to coordinate work with your team." }
  ],
  rights: [
    { title: "Usage rights", description: "Set usage and licensing restrictions for each record." },
    { title: "Compliance", description: "Track rights expiry to prevent unauthorized use." },
    { title: "Read-only mode", description: "Review rights records and enforcement status without registering new rights." }
  ]
};

export function getPageTips(page: PageKey, role?: NavigationRole, locale: AppLocale = "ar"): Tip[] {
  const localizedTips = locale === "en"
    ? pageTips[page].map((tip, index) => ({ ...tip, ...englishTipCopy[page][index] }))
    : pageTips[page];

  return localizedTips.filter((tip) => !tip.roles || (role ? tip.roles.includes(role) : false));
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
