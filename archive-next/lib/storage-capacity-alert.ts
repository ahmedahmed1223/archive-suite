import type { AppLocale } from "@/lib/i18n/types";

// ponytail: early-warning thresholds over an already-measured local storage metric (V1-859).
// No cloud monitoring — caller supplies usedBytes/totalBytes from the existing system status call.
export type StorageCapacityLevel = "ok" | "warning" | "critical";

export interface StorageCapacityAlert {
  level: StorageCapacityLevel;
  percentUsed: number;
  message: string | null;
}

const WARNING_THRESHOLD = 0.8;
const CRITICAL_THRESHOLD = 0.95;

export function checkStorageCapacity(usedBytes: number, totalBytes: number, locale: AppLocale = "ar"): StorageCapacityAlert {
  if (totalBytes <= 0) return { level: "ok", percentUsed: 0, message: null };

  const percentUsed = usedBytes / totalBytes;

  if (percentUsed >= CRITICAL_THRESHOLD) {
    return {
      level: "critical",
      percentUsed,
      message: locale === "en"
        ? `Staging storage is almost full (${Math.round(percentUsed * 100)}%). Free space before uploading new materials.`
        : `مساحة التجهيز شبه ممتلئة (${Math.round(percentUsed * 100)}%). حرّر مساحة قبل رفع مواد جديدة.`
    };
  }

  if (percentUsed >= WARNING_THRESHOLD) {
    return {
      level: "warning",
      percentUsed,
      message: locale === "en" ? `Staging storage is nearing capacity (${Math.round(percentUsed * 100)}%).` : `مساحة التجهيز تقترب من الامتلاء (${Math.round(percentUsed * 100)}%).`
    };
  }

  return { level: "ok", percentUsed, message: null };
}
