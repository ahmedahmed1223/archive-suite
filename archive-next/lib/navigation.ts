export const primaryNav = [
  { href: "/", label: "الرئيسية", section: "core", icon: "Home" },
  { href: "/archive", label: "الأرشيف", section: "core", icon: "Archive" },
  { href: "/uploads", label: "إضافة مادة", section: "core", icon: "UploadCloud" },
  { href: "/search", label: "البحث", section: "core", icon: "Search" },
  { href: "/search/saved", label: "بحوث محفوظة", section: "core", icon: "Bookmark" },
  { href: "/discover", label: "الاكتشاف", section: "core", icon: "Compass" },
  { href: "/graph", label: "العلاقات", section: "core", icon: "GitBranch" },
  { href: "/files", label: "الملفات", section: "core", icon: "Files" },
  { href: "/timeline", label: "الخط الزمني", section: "core", icon: "Clock3" },
  { href: "/inbox", label: "الوارد", section: "core", icon: "Inbox" },
  { href: "/favorites", label: "المفضلة", section: "core", icon: "Star" },
  { href: "/reading-lists", label: "قوائم القراءة", section: "core", icon: "BookOpen" },
  { href: "/shares", label: "المشاركات", section: "core", icon: "Share2" },
  { href: "/shares/with-me", label: "وارد المشاركة", section: "core", icon: "MailCheck" },
  { href: "/types", label: "الأنواع", section: "manage", icon: "FileType" },
  { href: "/collections", label: "المجموعات", section: "manage", icon: "FolderOpen" },
  { href: "/vocabulary", label: "المفردات", section: "manage", icon: "Library" },
  { href: "/tags", label: "الوسوم", section: "manage", icon: "Tags" },
  { href: "/duplicates", label: "المكررات", section: "manage", icon: "CopyCheck" },
  { href: "/kanban", label: "كانبان", section: "manage", icon: "Columns3" },
  { href: "/projects", label: "المشاريع", section: "manage", icon: "BriefcaseBusiness" },
  { href: "/media/jobs", label: "الوسائط", section: "manage", icon: "Film" },
  { href: "/transcriber", label: "التفريغ", section: "manage", icon: "Mic2" },
  { href: "/collaboration", label: "التعاون", section: "manage", icon: "Users" },
  { href: "/automation", label: "الأتمتة", section: "manage", icon: "Bot" },
  { href: "/activity", label: "النشاط", section: "observe", icon: "Activity" },
  { href: "/analytics", label: "التحليلات", section: "observe", icon: "BarChart3" },
  { href: "/reports", label: "التقارير", section: "observe", icon: "FileBarChart" },
  { href: "/status", label: "الحالة", section: "observe", icon: "Gauge" },
  { href: "/sync", label: "المزامنة", section: "observe", icon: "RefreshCw" },
  { href: "/errors", label: "الأخطاء", section: "observe", icon: "AlertTriangle" },
  { href: "/ingest", label: "الاستيراد", section: "admin", icon: "FileInput" },
  { href: "/backup", label: "النسخ الاحتياطي", section: "admin", icon: "HardDriveDownload" },
  { href: "/data-center", label: "مركز البيانات", section: "admin", icon: "Database" },
  { href: "/system/control", label: "التحكم بالنظام", section: "admin", icon: "MonitorCog" },
  { href: "/first-run", label: "أول تشغيل", section: "admin", icon: "Sparkles" },
  { href: "/rights", label: "الحقوق", section: "admin", icon: "ShieldCheck" },
  { href: "/settings", label: "الإعدادات", section: "admin", icon: "Settings" },
  { href: "/help", label: "المساعدة", section: "admin", icon: "HelpCircle" }
] as const;

export type NavSection = (typeof primaryNav)[number]["section"];

export const navSectionLabels: Record<NavSection, string> = {
  core: "العمل اليومي",
  manage: "التنظيم",
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
