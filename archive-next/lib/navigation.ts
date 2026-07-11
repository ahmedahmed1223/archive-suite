export const primaryNav = [
  // ── الإدخال والمعالجة ──
  { href: "/uploads", label: "إضافة مادة", section: "capture", icon: "UploadCloud" },
  { href: "/inbox", label: "الوارد", section: "capture", icon: "Inbox" },
  { href: "/ingest", label: "الاستيراد", section: "capture", icon: "FileInput" },
  { href: "/media/jobs", label: "الوسائط", section: "capture", icon: "Film" },
  { href: "/transcriber", label: "التفريغ", section: "capture", icon: "Mic2" },
  // ── المكتبة (البحث والتصفح) ──
  { href: "/", label: "اللوحة", section: "library", icon: "Home" },
  { href: "/archive", label: "الأرشيف", section: "library", icon: "Archive" },
  { href: "/search", label: "البحث", section: "library", icon: "Search" },
  { href: "/discover", label: "الاكتشاف", section: "library", icon: "Compass" },
  { href: "/favorites", label: "المفضلة", section: "library", icon: "Star" },
  { href: "/reading-lists", label: "قوائم القراءة", section: "library", icon: "BookOpen" },
  { href: "/timeline", label: "الخط الزمني", section: "library", icon: "Clock3" },
  { href: "/graph", label: "العلاقات", section: "library", icon: "GitBranch" },
  { href: "/files", label: "الملفات", section: "library", icon: "Files" },
  // ── التنظيم ──
  { href: "/collections", label: "المجموعات", section: "organize", icon: "FolderOpen" },
  { href: "/types", label: "الأنواع", section: "organize", icon: "FileType" },
  { href: "/vocabulary", label: "المفردات", section: "organize", icon: "Library" },
  { href: "/tags", label: "الوسوم", section: "organize", icon: "Tags" },
  { href: "/duplicates", label: "المكررات", section: "organize", icon: "CopyCheck" },
  { href: "/kanban", label: "كانبان", section: "organize", icon: "Columns3" },
  { href: "/projects", label: "المشاريع", section: "organize", icon: "BriefcaseBusiness" },
  // ── المشاركة والتعاون ──
  { href: "/shares", label: "المشاركات", section: "collaborate", icon: "Share2" },
  { href: "/shares/with-me", label: "وارد المشاركة", section: "collaborate", icon: "MailCheck" },
  { href: "/collaboration", label: "التعاون", section: "collaborate", icon: "Users" },
  { href: "/broadcast", label: "البث", section: "collaborate", icon: "Radio" },
  { href: "/automation", label: "الأتمتة", section: "collaborate", icon: "Bot" },
  { href: "/copilot", label: "مساعد الأرشيف", section: "collaborate", icon: "BotMessageSquare" },
  { href: "/rights", label: "الحقوق", section: "collaborate", icon: "ShieldCheck" },
  // ── المؤشرات والمراقبة ──
  { href: "/activity", label: "النشاط", section: "insights", icon: "Activity" },
  { href: "/analytics", label: "التحليلات", section: "insights", icon: "BarChart3" },
  { href: "/reports", label: "التقارير", section: "insights", icon: "FileBarChart" },
  { href: "/status", label: "الحالة", section: "insights", icon: "Gauge" },
  { href: "/sync", label: "المزامنة", section: "insights", icon: "RefreshCw" },
  { href: "/errors", label: "الأخطاء", section: "insights", icon: "AlertTriangle" },
  // ── النظام ──
  { href: "/search/saved", label: "بحوث محفوظة", section: "system", icon: "Bookmark" },
  { href: "/plugins", label: "الإضافات", section: "system", icon: "PlugZap" },
  { href: "/backup", label: "النسخ الاحتياطي", section: "system", icon: "HardDriveDownload" },
  { href: "/data-center", label: "مركز البيانات", section: "system", icon: "Database" },
  { href: "/system/control", label: "التحكم بالنظام", section: "system", icon: "MonitorCog" },
  { href: "/first-run", label: "أول تشغيل", section: "system", icon: "Sparkles" },
  { href: "/settings", label: "الإعدادات", section: "system", icon: "Settings" },
  { href: "/help", label: "المساعدة", section: "system", icon: "HelpCircle" }
] as const;

export type NavSection = (typeof primaryNav)[number]["section"];

export const navSectionLabels: Record<NavSection, string> = {
  capture: "الإدخال",
  library: "المكتبة",
  organize: "التنظيم",
  collaborate: "المشاركة",
  insights: "المؤشرات",
  system: "النظام"
};

export function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  const siblingRoutes: Record<string, readonly string[]> = {
    "/search": ["/search/saved"],
    "/shares": ["/shares/with-me"]
  };

  if (siblingRoutes[href]?.some((sibling) => pathname === sibling || pathname.startsWith(`${sibling}/`))) {
    return false;
  }

  if (href === "/media/jobs") {
    return pathname.startsWith("/media");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
