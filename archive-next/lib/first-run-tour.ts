// V1-765: an interactive alternative to the static first-run checklist —
// a short guided tour through the app's main areas. Manually triggered
// (button on /first-run), not auto-popped on mount: this app already
// auto-shows WhatsNewDialog on mount, and stacking two independent dialogs
// for a brand-new session is a race this module sidesteps entirely.
import type { AppLocale } from "@/lib/i18n/types";

export interface TourStep {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}

export const firstRunTourSteps: TourStep[] = [
  {
    title: "الأرشيف",
    description: "كل سجل يمثل عنصراً من مجموعتك — بياناته الوصفية وملفاته المرتبطة في مكان واحد.",
    href: "/archive",
    actionLabel: "افتح الأرشيف"
  },
  {
    title: "البحث",
    description: "ابحث عبر كل السجلات مع عوامل تصفية بالتاريخ والنوع والحالة، واحفظ عمليات البحث المتكررة.",
    href: "/search",
    actionLabel: "افتح البحث"
  },
  {
    title: "إضافة مادة",
    description: "ارفع ملفات مفردة أو دفعات، مع معالجة في الخلفية للملفات الكبيرة دون حجب العمل.",
    href: "/uploads",
    actionLabel: "ابدأ الرفع"
  },
  {
    title: "كانبان",
    description: "تابع سير عمل السجلات حسب الحالة، وانقلها بالسحب أو من قائمة منسدلة قابلة للوصول بالكامل.",
    href: "/kanban",
    actionLabel: "افتح كانبان"
  },
  {
    title: "الإعدادات",
    description: "خصص تفضيلاتك واللغة والمظهر، وأدر النسخ الاحتياطي والتكاملات الخارجية.",
    href: "/settings",
    actionLabel: "افتح الإعدادات"
  }
];

const firstRunTourStepsEn: TourStep[] = [
  {
    title: "Archive",
    description: "Each record brings its metadata and linked files together in one place.",
    href: "/archive",
    actionLabel: "Open archive"
  },
  {
    title: "Search",
    description: "Search all records, filter by date, type, and status, and save searches you use often.",
    href: "/search",
    actionLabel: "Open search"
  },
  {
    title: "Add item",
    description: "Upload individual files or batches while large files are processed in the background without interrupting your work.",
    href: "/uploads",
    actionLabel: "Start upload"
  },
  {
    title: "Kanban",
    description: "Track record workflows by status, then move records by dragging or with an accessible menu.",
    href: "/kanban",
    actionLabel: "Open Kanban"
  },
  {
    title: "Settings",
    description: "Customize preferences, language, and appearance, and manage backups and external integrations.",
    href: "/settings",
    actionLabel: "Open settings"
  }
];

export function getFirstRunTourSteps(locale: AppLocale = "ar"): TourStep[] {
  return locale === "en" ? firstRunTourStepsEn : firstRunTourSteps;
}

export function clampStepIndex(index: number, stepCount: number): number {
  if (stepCount <= 0) return 0;
  return Math.min(Math.max(index, 0), stepCount - 1);
}

const TOUR_STORAGE_KEY = "masar.firstRunTour.completed";

export function hasTourBeenCompleted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(TOUR_STORAGE_KEY) === "true";
}

export function markTourCompleted(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOUR_STORAGE_KEY, "true");
}
