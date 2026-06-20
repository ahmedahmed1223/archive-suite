/**
 * Central catalog of all user-facing settings.
 * Each entry describes one setting: where it lives in the settings object,
 * which tab of SettingsPage owns it, how to label/describe it, and
 * whether it is sensitive (excluded from export).
 *
 * Used by SettingsHubPage for search, category navigation, and
 * import/export diff preview.
 */

/** @typedef {'boolean'|'select'|'text'|'number'|'shortcut'|'object'} SettingType */

/**
 * @typedef {Object} SettingEntry
 * @property {string}      id
 * @property {string}      category
 * @property {string}      tab           - SettingsPage tab id
 * @property {string}      label
 * @property {string}      description
 * @property {string}      path          - dot-notation path in the settings object
 * @property {SettingType} type
 * @property {*}           default
 * @property {boolean}     [restartRequired]
 * @property {boolean}     [sensitive]   - exclude from export/import
 * @property {string[]}    [keywords]    - extra search terms
 */

/** @type {SettingEntry[]} */
export const SETTINGS_REGISTRY = [
  // ── General ────────────────────────────────────────────────────────────────
  {
    id: "autoSave",
    category: "general",
    tab: "general",
    label: "الحفظ التلقائي",
    description: "حفظ التغييرات تلقائياً دون الحاجة للضغط على زر حفظ.",
    path: "autoSave",
    type: "boolean",
    default: true,
    keywords: ["save", "auto", "حفظ"],
  },
  {
    id: "language",
    category: "general",
    tab: "general",
    label: "اللغة",
    description: "لغة واجهة التطبيق (العربية الافتراضية).",
    path: "language",
    type: "select",
    default: "ar",
    keywords: ["lang", "arabic", "english", "locale", "لغة"],
  },
  {
    id: "numberSystem",
    category: "general",
    tab: "general",
    label: "نظام الأرقام",
    description: "أرقام عربية (٠١٢) أو لاتينية (012).",
    path: "numberSystem",
    type: "select",
    default: "latn",
    keywords: ["numbers", "arabic numerals", "أرقام"],
  },
  {
    id: "itemsPerPage",
    category: "general",
    tab: "general",
    label: "عدد العناصر في الصفحة",
    description: "عدد عناصر الأرشيف المعروضة في كل صفحة.",
    path: "itemsPerPage",
    type: "number",
    default: 24,
    keywords: ["pagination", "page size", "عناصر", "صفحة"],
  },
  {
    id: "defaultView",
    category: "general",
    tab: "general",
    label: "عرض العناصر الافتراضي",
    description: "نوع العرض الافتراضي عند فتح الأرشيف: شبكة، قائمة، جدول، معرض.",
    path: "defaultView",
    type: "select",
    default: "grid",
    keywords: ["grid", "list", "table", "gallery", "view", "عرض"],
  },
  {
    id: "autocompleteTriggers",
    category: "general",
    tab: "general",
    label: "أحرف تفعيل الإكمال التلقائي",
    description: "الحرف الذي يُفعّل اقتراحات المفردات (@) والوسوم (#).",
    path: "autocompleteTriggers",
    type: "object",
    default: { vocabulary: "@", tags: "#" },
    keywords: ["autocomplete", "trigger", "مفردات", "وسوم"],
  },
  {
    id: "editInSidePanel",
    category: "general",
    tab: "general",
    label: "التعديل السريع في اللوحة الجانبية",
    description: "عند التفعيل، تفتح عملية التعديل لوحة جانبية منزلقة بدلاً من صفحة التفاصيل الكاملة.",
    path: "ui.editInSidePanel",
    type: "boolean",
    default: false,
    keywords: ["edit", "side panel", "drawer", "quick edit", "تعديل", "لوحة", "جانبي"],
  },

  // ── Appearance ──────────────────────────────────────────────────────────────
  {
    id: "theme",
    category: "appearance",
    tab: "appearance",
    label: "السمة",
    description: "الوضع الداكن أو الفاتح أو التلقائي حسب إعداد النظام.",
    path: "theme",
    type: "select",
    default: "dark",
    keywords: ["dark", "light", "mode", "وضع", "ليلي", "نهاري", "مظهر"],
  },
  {
    id: "accentColor",
    category: "appearance",
    tab: "appearance",
    label: "لون التمييز",
    description: "اللون الرئيسي المستخدم في الأزرار والروابط والتمييز.",
    path: "accentColor",
    type: "select",
    default: "teal",
    keywords: ["color", "accent", "brand", "لون", "ألوان"],
  },
  {
    id: "visualDensity",
    category: "appearance",
    tab: "appearance",
    label: "كثافة العرض",
    description: "مسافات واجهة المستخدم: مضغوطة، مريحة، أو واسعة.",
    path: "ui.visualDensity",
    type: "select",
    default: "comfortable",
    keywords: ["density", "compact", "comfortable", "كثافة", "مسافات"],
  },
  {
    id: "daisyTheme",
    category: "appearance",
    tab: "appearance",
    label: "ثيم DaisyUI",
    description: "ثيم الألوان التفصيلي المطبّق على المكونات.",
    path: "ui.daisyTheme",
    type: "select",
    default: "business",
    keywords: ["daisy", "theme", "palette", "ثيم"],
  },

  // ── Security ───────────────────────────────────────────────────────────────
  {
    id: "enableSessionTimeout",
    category: "security",
    tab: "security",
    label: "انتهاء جلسة تلقائي",
    description: "قفل التطبيق تلقائياً بعد فترة خمول.",
    path: "enableSessionTimeout",
    type: "boolean",
    default: true,
    keywords: ["timeout", "lock", "idle", "session", "قفل", "جلسة"],
  },
  {
    id: "sessionTimeout",
    category: "security",
    tab: "security",
    label: "مدة انتهاء الجلسة (دقيقة)",
    description: "عدد دقائق الخمول قبل قفل التطبيق تلقائياً.",
    path: "sessionTimeout",
    type: "number",
    default: 30,
    keywords: ["timeout", "minutes", "idle", "دقائق", "خمول"],
  },
  {
    id: "contentWarningsEnabled",
    category: "security",
    tab: "security",
    label: "تحذيرات المحتوى",
    description: "عرض تحذير قبل حذف العناصر أو العمليات الخطيرة.",
    path: "contentWarningsEnabled",
    type: "boolean",
    default: true,
    keywords: ["warning", "confirm", "delete", "تحذير", "تأكيد"],
  },
  {
    id: "encryptedFields",
    category: "security",
    tab: "security",
    label: "الحقول المشفرة",
    description: "قائمة الحقول التي تُشفَّر عند التخزين.",
    path: "encryptedFields",
    type: "object",
    default: [],
    sensitive: true,
    keywords: ["encrypt", "fields", "تشفير", "حقول"],
  },

  // ── Data / Backup ──────────────────────────────────────────────────────────
  {
    id: "autoBackup",
    category: "data",
    tab: "data",
    label: "النسخ الاحتياطي التلقائي",
    description: "إنشاء نسخ احتياطية دورية تلقائياً.",
    path: "autoBackup",
    type: "boolean",
    default: true,
    keywords: ["backup", "auto", "نسخ", "احتياطي"],
  },
  {
    id: "backupInterval",
    category: "data",
    tab: "data",
    label: "تكرار النسخ الاحتياطي (دقيقة)",
    description: "الفاصل الزمني بين النسخ الاحتياطية التلقائية بالدقائق.",
    path: "backupInterval",
    type: "number",
    default: 60,
    keywords: ["backup interval", "frequency", "تكرار", "فترة"],
  },
  {
    id: "backupSchedule",
    category: "data",
    tab: "data",
    label: "جدول النسخ الاحتياطي",
    description: "يدوي، يومي، أسبوعي، أو شهري.",
    path: "backupSchedule",
    type: "select",
    default: "manual",
    keywords: ["schedule", "daily", "weekly", "monthly", "جدول"],
  },
  {
    id: "backupNotify",
    category: "data",
    tab: "data",
    label: "إشعار النسخ الاحتياطي",
    description: "إظهار إشعار عند اكتمال النسخ الاحتياطي.",
    path: "backupNotify",
    type: "boolean",
    default: true,
    keywords: ["notification", "backup", "إشعار"],
  },
  {
    id: "maxAuditLogEntries",
    category: "data",
    tab: "data",
    label: "الحد الأقصى لسجلات المراجعة",
    description: "أقصى عدد إدخالات يُحتفظ بها في سجل المراجعة.",
    path: "maxAuditLogEntries",
    type: "number",
    default: 1000,
    keywords: ["audit", "log", "entries", "سجل", "مراجعة"],
  },

  // ── Notifications ──────────────────────────────────────────────────────────
  {
    id: "notifications.persistImportant",
    category: "notifications",
    tab: "general",
    label: "الاحتفاظ بالإشعارات المهمة",
    description: "عدم إخفاء الإشعارات المهمة تلقائياً.",
    path: "notifications.persistImportant",
    type: "boolean",
    default: true,
    keywords: ["notification", "persist", "إشعار", "احتفاظ"],
  },
  {
    id: "notifications.durationMs",
    category: "notifications",
    tab: "general",
    label: "مدة عرض الإشعار (مللي ثانية)",
    description: "المدة الافتراضية لعرض الإشعارات قبل اختفائها.",
    path: "notifications.durationMs",
    type: "number",
    default: 5500,
    keywords: ["notification", "duration", "toast", "مدة", "إشعار"],
  },
  {
    id: "notifications.desktopEnabled",
    category: "notifications",
    tab: "general",
    label: "إشعارات سطح المكتب",
    description: "إرسال إشعارات نظام سطح المكتب عند الإجراءات الهامة.",
    path: "notifications.desktopEnabled",
    type: "boolean",
    default: false,
    keywords: ["desktop", "push", "system", "notification", "سطح المكتب", "إشعارات"],
  },
  {
    id: "notifications.retentionDays",
    category: "notifications",
    tab: "general",
    label: "مدة الاحتفاظ بالإشعارات (يوم)",
    description: "عدد الأيام التي تُحتفظ فيها الإشعارات قبل حذفها.",
    path: "notifications.retentionDays",
    type: "number",
    default: 30,
    keywords: ["retention", "days", "history", "احتفاظ", "أيام"],
  },

  // ── Shortcuts ──────────────────────────────────────────────────────────────
  ...[
    ["openSearch", "فتح البحث", "Alt+K"],
    ["openCommandPalette", "فتح لوحة الأوامر", "Ctrl+K"],
    ["showShortcuts", "عرض الاختصارات", "Ctrl+/"],
    ["toggleNotifications", "تبديل الإشعارات", "Ctrl+Shift+M"],
    ["openBackup", "فتح النسخ الاحتياطي", "Ctrl+B"],
    ["openDashboard", "فتح لوحة المعلومات", "Ctrl+D"],
    ["lockApp", "قفل التطبيق", "Ctrl+Shift+L"],
    ["logout", "تسجيل الخروج", "Ctrl+Alt+L"],
    ["undo", "تراجع", "Ctrl+Z"],
    ["redo", "إعادة", "Ctrl+Y"],
    ["viewGrid", "عرض الشبكة", "Ctrl+1"],
    ["viewList", "عرض القائمة", "Ctrl+2"],
    ["viewTable", "عرض الجدول", "Ctrl+3"],
    ["viewGallery", "عرض المعرض", "Ctrl+4"],
    ["viewKanban", "فتح لوحات المشاريع", "Ctrl+5"],
    ["deleteSelected", "حذف المحدد", "Delete"],
  ].map(([key, label, def]) => ({
    id: `shortcut.${key}`,
    category: "shortcuts",
    tab: "shortcuts",
    label: `اختصار: ${label}`,
    description: `اختصار لوحة المفاتيح لـ "${label}". الافتراضي: ${def}`,
    path: `keyboardShortcuts.${key}`,
    type: "shortcut",
    default: def,
    keywords: ["shortcut", "keyboard", "hotkey", "اختصار", key.toLowerCase(), label],
  })),

  // ── Advanced / Startup ─────────────────────────────────────────────────────
  {
    id: "ui.startupMode",
    category: "advanced",
    tab: "maintenance",
    label: "وضع الإقلاع",
    description: "أداء الإقلاع: متوازن، سريع (يتخطى الفحوصات)، أو آمن (أبطأ وأكثر أماناً).",
    path: "ui.startupMode",
    type: "select",
    default: "balanced",
    keywords: ["startup", "boot", "performance", "إقلاع", "أداء"],
    restartRequired: true,
  },
  {
    id: "ui.routingMode",
    category: "advanced",
    tab: "maintenance",
    label: "وضع التوجيه",
    description: "Hash routing (افتراضي لـ SPA) أو History API.",
    path: "ui.routingMode",
    type: "select",
    default: "hash",
    keywords: ["routing", "hash", "history", "توجيه"],
    restartRequired: true,
  },
  {
    id: "ui.serverUpdatePolicy",
    category: "advanced",
    tab: "maintenance",
    label: "سياسة تحديثات الخادم",
    description: "stable = تحديثات مستقرة فقط، beta = تحديثات تجريبية مبكرة.",
    path: "ui.serverUpdatePolicy",
    type: "select",
    default: "stable",
    keywords: ["update", "server", "beta", "stable", "تحديث"],
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/** All unique categories in the registry */
export const SETTINGS_CATEGORIES = [
  ...new Set(SETTINGS_REGISTRY.map((e) => e.category)),
];

/** Labels per category (Arabic) */
export const SETTINGS_CATEGORY_LABELS = {
  general:       "عام",
  appearance:    "المظهر",
  security:      "الأمان",
  data:          "البيانات والنسخ",
  notifications: "الإشعارات",
  shortcuts:     "الاختصارات",
  advanced:      "متقدم",
};

/** Lucide icon name per category (used by hub cards) */
export const SETTINGS_CATEGORY_ICONS = {
  general:       "Settings",
  appearance:    "Palette",
  security:      "Shield",
  data:          "Database",
  notifications: "Bell",
  shortcuts:     "Keyboard",
  advanced:      "Wrench",
};

/**
 * Search entries by query string (label + description + keywords + path).
 * Returns entries ranked by match quality (label match first).
 * @param {string} query
 * @returns {SettingEntry[]}
 */
export function searchSettings(query) {
  if (!query?.trim()) return [];
  const q = query.trim().toLowerCase();
  const labelMatch = [];
  const otherMatch = [];
  for (const entry of SETTINGS_REGISTRY) {
    const inLabel = entry.label.toLowerCase().includes(q);
    const inDesc  = entry.description.toLowerCase().includes(q);
    const inPath  = entry.path.toLowerCase().includes(q);
    const inKw    = entry.keywords?.some((k) => k.toLowerCase().includes(q));
    if (inLabel) { labelMatch.push(entry); continue; }
    if (inDesc || inPath || inKw) otherMatch.push(entry);
  }
  return [...labelMatch, ...otherMatch];
}

/**
 * Get entries for a specific category.
 * @param {string} category
 * @returns {SettingEntry[]}
 */
export function getSettingsByCategory(category) {
  return SETTINGS_REGISTRY.filter((e) => e.category === category);
}

/**
 * Read a nested value from the settings object by dot-notation path.
 * @param {object} settings
 * @param {string} path
 * @returns {*}
 */
export function getSettingValue(settings, path) {
  return path.split(".").reduce((obj, key) => obj?.[key], settings);
}

/**
 * Collect all non-sensitive settings entries as a plain export object.
 * The shape matches the app's settings object so it can be merged with
 * mergeAppSettings().
 * @param {object} settings
 * @returns {object}
 */
export function buildExportPayload(settings) {
  const payload = {};
  for (const entry of SETTINGS_REGISTRY) {
    if (entry.sensitive) continue;
    const val = getSettingValue(settings, entry.path);
    if (val === undefined) continue;
    const parts = entry.path.split(".");
    let cur = payload;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]]) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = val;
  }
  return payload;
}

/**
 * Compute a diff between current settings and an import payload.
 * Returns only entries where the value differs.
 * @param {object} current
 * @param {object} incoming
 * @returns {{ entry: SettingEntry, currentValue: *, nextValue: * }[]}
 */
export function diffSettings(current, incoming) {
  const diffs = [];
  for (const entry of SETTINGS_REGISTRY) {
    if (entry.sensitive) continue;
    const cur  = getSettingValue(current, entry.path);
    const next = getSettingValue(incoming, entry.path);
    if (next === undefined) continue;
    const same =
      typeof cur === "object" || typeof next === "object"
        ? JSON.stringify(cur) === JSON.stringify(next)
        : cur === next;
    if (!same) {
      diffs.push({ entry, currentValue: cur, nextValue: next });
    }
  }
  return diffs;
}
