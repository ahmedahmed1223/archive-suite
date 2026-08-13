import { getDictionary } from "./i18n/dictionaries";

const navItemMeta = [
  // ── الإدخال والمعالجة ──
  { href: "/uploads", section: "capture", icon: "UploadCloud" },
  { href: "/uploads/scheduled", section: "capture", icon: "CalendarClock" },
  { href: "/inbox", section: "capture", icon: "Inbox" },
  { href: "/ingest", section: "capture", icon: "FileInput" },
  { href: "/media/jobs", section: "capture", icon: "Film" },
  { href: "/transcriber", section: "capture", icon: "Mic2" },
  // ── المكتبة (البحث والتصفح) ──
  { href: "/", section: "library", icon: "Home" },
  { href: "/daily", section: "library", icon: "Sunrise" },
  { href: "/archive", section: "library", icon: "Archive" },
  { href: "/search", section: "library", icon: "Search" },
  { href: "/discover", section: "library", icon: "Compass" },
  { href: "/favorites", section: "library", icon: "Star" },
  { href: "/reading-lists", section: "library", icon: "BookOpen" },
  { href: "/timeline", section: "library", icon: "Clock3" },
  { href: "/graph", section: "library", icon: "GitBranch" },
  { href: "/map", section: "library", icon: "Map" },
  { href: "/files", section: "library", icon: "Files" },
  // ── التنظيم ──
  { href: "/collections", section: "organize", icon: "FolderOpen" },
  { href: "/types", section: "organize", icon: "FileType" },
  { href: "/vocabulary", section: "organize", icon: "Library" },
  { href: "/tags", section: "organize", icon: "Tags" },
  { href: "/duplicates", section: "organize", icon: "CopyCheck" },
  { href: "/trash", section: "organize", icon: "Trash2" },
  { href: "/kanban", section: "organize", icon: "Columns3" },
  { href: "/projects", section: "organize", icon: "BriefcaseBusiness" },
  // ── المشاركة والتعاون ──
  { href: "/shares", section: "collaborate", icon: "Share2" },
  { href: "/shares/with-me", section: "collaborate", icon: "MailCheck" },
  { href: "/collaboration", section: "collaborate", icon: "Users" },
  { href: "/broadcast", section: "collaborate", icon: "Radio" },
  { href: "/automation", section: "collaborate", icon: "Bot" },
  { href: "/copilot", section: "collaborate", icon: "BotMessageSquare" },
  { href: "/rights", section: "collaborate", icon: "ShieldCheck" },
  { href: "/safety-preview", section: "collaborate", icon: "ShieldCheck" },
  // ── المؤشرات والمراقبة ──
  { href: "/activity", section: "insights", icon: "Activity" },
  { href: "/analytics", section: "insights", icon: "BarChart3" },
  { href: "/reports", section: "insights", icon: "FileBarChart" },
  { href: "/status", section: "insights", icon: "Gauge" },
  { href: "/sync", section: "insights", icon: "RefreshCw" },
  { href: "/errors", section: "insights", icon: "AlertTriangle" },
  // ── النظام ──
  { href: "/search/saved", section: "system", icon: "Bookmark" },
  { href: "/plugins", section: "system", icon: "PlugZap" },
  { href: "/backup", section: "system", icon: "HardDriveDownload" },
  { href: "/data-center", section: "system", icon: "Database" },
  { href: "/system/control", section: "system", icon: "MonitorCog" },
  { href: "/first-run", section: "system", icon: "Sparkles" },
  { href: "/settings", section: "system", icon: "Settings" },
  { href: "/help", section: "system", icon: "HelpCircle" }
] as const;

export type NavSection = (typeof navItemMeta)[number]["section"];
export type NavigationRole = "admin" | "editor" | "viewer";
export type NavigationItem = (typeof navItemMeta)[number] & { label: string };

function localizeNavItems(locale: "ar" | "en"): NavigationItem[] {
  const labels = getDictionary(locale).nav.items;
  return navItemMeta.map((item) => ({ ...item, label: labels[item.href] ?? item.href }));
}

export const primaryNav: NavigationItem[] = localizeNavItems("ar");

export const navSectionLabels: Record<NavSection, string> = getDictionary("ar").nav.sections;

export function getLocalizedNavigation(locale: "ar" | "en") {
  if (locale === "ar") return { items: primaryNav, sections: navSectionLabels };
  return { items: localizeNavItems("en"), sections: getDictionary("en").nav.sections };
}

const dailyRoutes: Record<NavSection, readonly string[]> = {
  capture: ["/uploads", "/inbox", "/ingest", "/media/jobs"],
  library: ["/", "/archive", "/search", "/favorites"],
  organize: ["/collections", "/tags", "/duplicates", "/projects"],
  collaborate: ["/shares", "/collaboration", "/broadcast", "/rights"],
  insights: ["/activity", "/analytics", "/reports", "/status"],
  system: ["/settings", "/system/control", "/backup", "/help"]
};

const roleHomeSection: Record<NavigationRole, NavSection> = {
  admin: "system",
  editor: "capture",
  viewer: "library"
};

export function getDailyNavigation(section: NavSection | undefined, role: NavigationRole = "viewer") {
  const focusedSection = section ?? roleHomeSection[role];
  const dailyHrefs = new Set(dailyRoutes[focusedSection]);
  const daily = primaryNav.filter((item) => dailyHrefs.has(item.href));
  const more = (Object.keys(navSectionLabels) as NavSection[])
    .map((groupSection) => ({
      section: groupSection,
      label: navSectionLabels[groupSection],
      items: primaryNav.filter((item) => item.section === groupSection && !dailyHrefs.has(item.href))
    }))
    .filter((group) => group.items.length > 0);

  return { daily, more };
}

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
