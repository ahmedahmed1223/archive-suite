// V1-765: an interactive alternative to the static first-run checklist —
// a short guided tour through the app's main areas. Manually triggered
// (button on /first-run), not auto-popped on mount: this app already
// auto-shows WhatsNewDialog on mount, and stacking two independent dialogs
// for a brand-new session is a race this module sidesteps entirely.
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
