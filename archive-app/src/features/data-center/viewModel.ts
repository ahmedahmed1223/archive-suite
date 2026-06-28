const BACKUP_INTERVALS_MS = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000
} as const;

export function createDataCenterExportFilters({
  typeFilter = "all",
  collectionFilter = "all",
  dateFrom = "",
  dateTo = "",
  favoritesOnly = false
}: {
  typeFilter?: string;
  collectionFilter?: string;
  dateFrom?: string;
  dateTo?: string;
  favoritesOnly?: boolean;
} = {}) {
  return {
    filters: {
      type: typeFilter,
      collectionId: collectionFilter === "all" ? "" : collectionFilter,
      dateFrom,
      dateTo,
      favoriteOnly: Boolean(favoritesOnly)
    },
    compact: true
  };
}

export function getDataCenterActiveFilterLabels({
  typeFilter = "all",
  collectionFilter = "all",
  dateFrom = "",
  dateTo = "",
  favoritesOnly = false
}: {
  typeFilter?: string;
  collectionFilter?: string;
  dateFrom?: string;
  dateTo?: string;
  favoritesOnly?: boolean;
} = {}) {
  return [
    typeFilter !== "all" ? "نوع محدد" : null,
    collectionFilter !== "all" ? "مجموعة محددة" : null,
    dateFrom || dateTo ? "نطاق تاريخ" : null,
    favoritesOnly ? "المفضلة فقط" : null
  ].filter(Boolean);
}

export function createDataCenterExportSummary({
  data = {},
  estimatedSize = 0,
  filters = {},
  formatFileSize = (value: number) => String(value || 0)
}: {
  data?: Record<string, any>;
  estimatedSize?: number;
  filters?: Record<string, any>;
  formatFileSize?: (value: number) => string;
} = {}) {
  const activeFilterLabels = getDataCenterActiveFilterLabels(filters);
  return [
    { label: "العناصر", value: data.videoItems?.length || 0 },
    { label: "الأنواع", value: data.contentTypes?.length || 0 },
    { label: "المستخدمون", value: data.users?.length || 0 },
    { label: "السجلات", value: data.auditLogs?.length || 0 },
    { label: "الحجم المتوقع", value: formatFileSize(estimatedSize) },
    { label: "الفلاتر", value: activeFilterLabels.length ? activeFilterLabels.join("، ") : "بدون فلاتر" }
  ];
}

export function getNextBackupTime(schedule = "manual", lastBackupAt: string | null = null, now = Date.now()) {
  const intervalMs = BACKUP_INTERVALS_MS[schedule as keyof typeof BACKUP_INTERVALS_MS];
  if (!intervalMs) return null;

  const lastBackup = lastBackupAt ? new Date(lastBackupAt) : null;
  const baseTime = Number.isFinite(lastBackup?.getTime()) ? lastBackup!.getTime() : now;
  return new Date(baseTime + intervalMs);
}

export function formatTimeUntilBackup(nextBackupTime: string | Date | null, now = Date.now()) {
  if (!nextBackupTime) return null;

  const diff = new Date(nextBackupTime).getTime() - now;
  if (diff <= 0) return "قريباً";

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `بعد ${days} يوم و${hours % 24} ساعة`;
  if (hours > 0) return `بعد ${hours} ساعة و${minutes % 60} دقيقة`;
  return `بعد ${minutes} دقيقة`;
}
