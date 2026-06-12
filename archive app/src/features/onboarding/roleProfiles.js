export const ROLE_PROFILE_IDS = ["admin", "editor", "viewer"];

export const ROLE_PROFILES = [
  {
    id: "admin",
    label: "مسؤول",
    badge: "تشغيل وصيانة",
    description: "يركز على صحة النظام، المستخدمين، النسخ الاحتياطي، وسجل النشاط.",
    priorityPages: ["dashboard", "server-status", "backup", "settings", "users", "activity", "history"],
    quietPages: [],
    startPage: "dashboard",
    steps: [
      { id: "health", label: "افحص الجاهزية", page: "server-status", detail: "ابدأ من الاتصال وصحة التخزين والخدمات." },
      { id: "backup", label: "أمّن البيانات", page: "backup", detail: "صدّر نسخة أو جهز ملف نقل قبل تغييرات كبيرة." },
      { id: "audit", label: "راجع النشاط", page: "activity", detail: "تابع العمليات والرجوع والتغييرات الحرجة." }
    ]
  },
  {
    id: "editor",
    label: "محرر",
    badge: "إضافة وتوصيف",
    description: "يركز على إضافة المواد، التوصيف، الاكتشاف، والمراجعة اليومية.",
    priorityPages: ["dashboard", "add", "archive", "discover", "search", "collections", "types", "htags"],
    quietPages: ["users", "server-status", "sync-log"],
    startPage: "add",
    steps: [
      { id: "add", label: "أضف مادة", page: "add", detail: "ابدأ بنموذج الإضافة أو الإنشاء السريع." },
      { id: "describe", label: "وحّد التوصيف", page: "types", detail: "راجع الأنواع والحقول قبل تراكم المواد." },
      { id: "discover", label: "راجع المقترحات", page: "discover", detail: "استخدم الرائج والمنسي لاختيار ما يحتاج مراجعة." }
    ]
  },
  {
    id: "viewer",
    label: "مشاهد",
    badge: "بحث ومراجعة",
    description: "يركز على البحث، المفضلة، قوائم المراجعة، واستكشاف المحتوى دون تعقيد إداري.",
    priorityPages: ["dashboard", "search", "archive", "discover", "favorites", "reading-lists", "help"],
    quietPages: ["users", "settings", "backup", "activity", "history", "server-status", "sync-log"],
    startPage: "search",
    steps: [
      { id: "search", label: "ابحث بسرعة", page: "search", detail: "ابدأ من البحث المتقدم أو الفلاتر المحفوظة." },
      { id: "save", label: "احفظ ما يهمك", page: "favorites", detail: "اجمع العناصر المهمة في المفضلة أو قوائم المراجعة." },
      { id: "learn", label: "افتح الدليل", page: "help", detail: "استخدم المساعدة لمعرفة اختصارات العمل اليومي." }
    ]
  }
];

const ROLE_PROFILE_SET = new Set(ROLE_PROFILE_IDS);

export function normalizeRoleProfileId(profileId = "editor") {
  return ROLE_PROFILE_SET.has(profileId) ? profileId : "editor";
}

export function getRoleProfile(profileId = "editor") {
  const normalized = normalizeRoleProfileId(profileId);
  return ROLE_PROFILES.find((profile) => profile.id === normalized) || ROLE_PROFILES[1];
}

export function resolveRoleProfileId({ settings = {}, currentUser = null } = {}) {
  const settingProfile = settings?.ui?.roleProfile;
  if (ROLE_PROFILE_SET.has(settingProfile)) return settingProfile;
  if (ROLE_PROFILE_SET.has(currentUser?.role)) return currentUser.role;
  return "editor";
}

export function orderPageIdsForRoleProfile(pageIds = [], profileId = "editor") {
  const available = Array.isArray(pageIds) ? pageIds.filter(Boolean) : [];
  const profile = getRoleProfile(profileId);
  const priority = profile.priorityPages.filter((pageId) => available.includes(pageId));
  const rest = available.filter((pageId) => !priority.includes(pageId));
  return [...priority, ...rest];
}

export function getRoleProfileStepPages(profileId = "editor") {
  return getRoleProfile(profileId).steps.map((step) => step.page);
}

export function getRoleProfileQuietPages(profileId = "editor") {
  return [...getRoleProfile(profileId).quietPages];
}
