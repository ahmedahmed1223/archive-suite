export const primaryNav = [
  { href: "/", label: "الرئيسية", section: "core" },
  { href: "/archive", label: "السجلات", section: "core" },
  { href: "/uploads", label: "إضافة", section: "core" },
  { href: "/search", label: "البحث", section: "core" },
  { href: "/search/saved", label: "بحوث محفوظة", section: "core" },
  { href: "/discover", label: "الاكتشاف", section: "core" },
  { href: "/graph", label: "العلاقات", section: "core" },
  { href: "/files", label: "الملفات", section: "core" },
  { href: "/timeline", label: "الخط الزمني", section: "core" },
  { href: "/inbox", label: "الوارد", section: "core" },
  { href: "/favorites", label: "المفضلة", section: "core" },
  { href: "/reading-lists", label: "قوائم القراءة", section: "core" },
  { href: "/shares", label: "المشاركات", section: "core" },
  { href: "/shares/with-me", label: "وارد المشاركة", section: "core" },
  { href: "/types", label: "الأنواع", section: "manage" },
  { href: "/collections", label: "المجموعات", section: "manage" },
  { href: "/vocabulary", label: "المفردات", section: "manage" },
  { href: "/tags", label: "الوسوم", section: "manage" },
  { href: "/duplicates", label: "المكررات", section: "manage" },
  { href: "/kanban", label: "كانبان", section: "manage" },
  { href: "/projects", label: "المشاريع", section: "manage" },
  { href: "/media/jobs", label: "الوسائط", section: "manage" },
  { href: "/transcriber", label: "التفريغ", section: "manage" },
  { href: "/collaboration", label: "التعاون", section: "manage" },
  { href: "/automation", label: "الأتمتة", section: "manage" },
  { href: "/activity", label: "النشاط", section: "observe" },
  { href: "/analytics", label: "التحليلات", section: "observe" },
  { href: "/reports", label: "التقارير", section: "observe" },
  { href: "/status", label: "الحالة", section: "observe" },
  { href: "/sync", label: "المزامنة", section: "observe" },
  { href: "/errors", label: "الأخطاء", section: "observe" },
  { href: "/ingest", label: "الاستيراد", section: "admin" },
  { href: "/backup", label: "النسخ الاحتياطي", section: "admin" },
  { href: "/data-center", label: "مركز البيانات", section: "admin" },
  { href: "/system/control", label: "التحكم بالنظام", section: "admin" },
  { href: "/first-run", label: "أول تشغيل", section: "admin" },
  { href: "/rights", label: "الحقوق", section: "admin" },
  { href: "/settings", label: "الإعدادات", section: "admin" },
  { href: "/help", label: "المساعدة", section: "admin" }
] as const;

export type NavSection = (typeof primaryNav)[number]["section"];

export const navSectionLabels: Record<NavSection, string> = {
  core: "العمل اليومي",
  manage: "الإدارة",
  observe: "المراقبة",
  admin: "النظام"
};

export function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/media/jobs") {
    return pathname.startsWith("/media");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
