import { summarizeCompleteness } from "../archive/completeness.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const BACKUP_STALE_DAYS = 7;
const HEALTH_STALE_DAYS = 1;

export function parseDurationSeconds(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value || typeof value !== "string") return 0;

  const parts = value.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(value) || 0;
}

export function createDashboardStats({
  videoItems = [],
  contentTypes = [],
  virtualCollections = [],
  hierarchicalTags = [],
  now = Date.now()
} = {}) {
  const activeItems = videoItems.filter((item) => !item.isDeleted);
  const completenessTypeById = new Map(contentTypes.map((type) => [type.id, type]));
  const completeness = summarizeCompleteness(activeItems, completenessTypeById);
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const totalSeconds = activeItems.reduce(
    (sum, video) => sum + parseDurationSeconds(video.metadata?.duration || video.metadata?.detectedDuration || video.duration),
    0
  );

  return {
    total: activeItems.length,
    totalHours: totalSeconds ? `${Math.round(totalSeconds / 3600)} س` : "—",
    addedThisWeek: activeItems.filter((item) => new Date(item.createdAt).getTime() >= sevenDaysAgo).length,
    recentActivity: activeItems.filter((item) => new Date(item.updatedAt).getTime() >= sevenDaysAgo).length,
    favorites: activeItems.filter((item) => item.isFavorite).length,
    deleted: videoItems.filter((item) => item.isDeleted).length,
    types: contentTypes.length,
    collections: virtualCollections.length,
    tags: hierarchicalTags.length,
    needsReview: completeness.needsReview,
    completenessAverage: completeness.averagePercent
  };
}

export function getDashboardDemoItemIds(videoItems = []) {
  return videoItems.filter((item) => item.id?.startsWith("demo-")).map((item) => item.id);
}

function getElapsedDays(value, now) {
  if (!value) return Infinity;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return Infinity;
  return Math.max(0, Math.floor((now - timestamp) / DAY_MS));
}

export function getDailyFocusItems({
  stats = {},
  settings = {},
  recentItems = [],
  isPasswordSet = true,
  sqliteError = null,
  now = Date.now()
} = {}) {
  const items = [];
  const total = Number(stats.total) || 0;
  const needsReview = Number(stats.needsReview) || 0;
  const completenessAverage = Number(stats.completenessAverage) || 0;
  const backupAgeDays = getElapsedDays(settings.lastBackupAt, now);
  const healthAgeDays = getElapsedDays(settings.systemHealth?.lastCheckAt, now);
  const latestItem = recentItems.find((item) => item && !item.isDeleted);

  if (sqliteError) {
    items.push({
      id: "storage",
      title: "تحقق من التخزين",
      detail: "هناك تنبيه في التخزين المحلي. شغل فحص النظام قبل متابعة الإدخال.",
      action: "health",
      tone: "amber",
      metric: "تنبيه"
    });
  }

  if (total === 0) {
    items.push({
      id: "first-item",
      title: "أضف أول مادة",
      detail: "ابدأ بمادة واحدة حتى تتشكل التقارير والقوائم اليومية.",
      action: "add",
      tone: "emerald",
      metric: "بداية"
    });
    items.push({
      id: "import-package",
      title: "استورد أرشيفًا سابقًا",
      detail: "افتح ملف نقل أو نسخة محفوظة مع معاينة قبل الدمج.",
      action: "import",
      tone: "cyan",
      metric: "اختياري"
    });
  }

  if (total > 0 && needsReview > 0) {
    items.push({
      id: "review",
      title: "راجع البيانات الناقصة",
      detail: `${needsReview} مواد تحتاج إكمال حقول أو تصنيف قبل الاعتماد اليومي.`,
      action: "review",
      tone: "amber",
      metric: `${completenessAverage}%`
    });
  }

  if (!isPasswordSet && settings.ui?.onboardingSecurityMode === "quick") {
    items.push({
      id: "security",
      title: "أكمل حماية المدير",
      detail: "تعيين كلمة المرور يحمي عمليات الحذف والاستيراد والاستعادة.",
      action: "security",
      tone: "violet",
      metric: "أمان"
    });
  }

  if (total > 0 && backupAgeDays >= BACKUP_STALE_DAYS) {
    items.push({
      id: "backup",
      title: settings.lastBackupAt ? "حدّث النسخة الاحتياطية" : "أنشئ نسخة احتياطية",
      detail: settings.lastBackupAt
        ? `آخر نسخة منذ ${backupAgeDays} أيام. خذ نسخة قبل تغييرات اليوم.`
        : "لا توجد نسخة احتياطية مسجلة. أنشئ نسخة قبل الاستيراد أو التحرير الكثيف.",
      action: "backup",
      tone: "cyan",
      metric: settings.lastBackupAt ? `${backupAgeDays} أيام` : "لا توجد"
    });
  }

  if (healthAgeDays >= HEALTH_STALE_DAYS) {
    items.push({
      id: "health",
      title: settings.systemHealth?.lastCheckAt ? "أعد فحص النظام" : "شغّل فحص النظام",
      detail: settings.systemHealth?.lastCheckAt
        ? "مر يوم أو أكثر منذ آخر فحص. تحقق من التخزين والنسخ قبل العمل الطويل."
        : "فحص سريع يطمئنك على التخزين، النسخ، وسلامة التشغيل.",
      action: "health",
      tone: "slate",
      metric: "فحص"
    });
  }

  if (total > 0 && latestItem) {
    items.push({
      id: "recent",
      title: "أكمل آخر مادة",
      detail: latestItem.title || "افتح آخر عنصر تم العمل عليه من لوحة التحكم.",
      action: "recent",
      tone: "emerald",
      metric: "متابعة"
    });
  }

  if (!items.length) {
    items.push({
      id: "archive",
      title: "افتح الأرشيف",
      detail: "كل المؤشرات مستقرة. انتقل مباشرة إلى الجدول للبحث والعمل.",
      action: "archive",
      tone: "emerald",
      metric: "جاهز"
    });
  }

  return items.slice(0, 4);
}

export function hasDashboardLayoutDraftChanges({
  draftLayout = [],
  currentLayout = [],
  draftHiddenWidgets = [],
  currentHiddenWidgets = [],
  draftActivePresetId = "",
  activePresetId = ""
} = {}) {
  return JSON.stringify(draftLayout) !== JSON.stringify(currentLayout)
    || JSON.stringify(draftHiddenWidgets) !== JSON.stringify(currentHiddenWidgets)
    || (draftActivePresetId || "") !== (activePresetId || "");
}
