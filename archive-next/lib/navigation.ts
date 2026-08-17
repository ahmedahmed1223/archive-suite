import { getDictionary } from "./i18n/dictionaries";
import type { Capabilities, CapabilityKey } from "./experience-profile";
import type { components } from "./generated/archive-api";

type NavigationExperienceSettings = components["schemas"]["NavigationExperienceSettings"];

const navItemMeta = [
  // ── الإدخال والمعالجة ──
  { href: "/uploads", section: "capture", icon: "UploadCloud" },
  { href: "/uploads/scheduled", section: "capture", icon: "CalendarClock" },
  { href: "/work-inbox", section: "capture", icon: "ListChecks" },
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
  capture: ["/uploads", "/work-inbox", "/inbox", "/ingest", "/media/jobs"],
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

/**
 * `visibleHrefs`, when passed, restricts both the daily bar and the "more"
 * groups to that set -- used to apply a user's/preset's navigation
 * customization (V3-SET-006) to the mobile bar the same way the desktop
 * sidebar applies it. Omit it to get the full unfiltered navigation, which
 * keeps every existing call site (and the existing unit test) unchanged.
 */
export function getDailyNavigation(
  section: NavSection | undefined,
  role: NavigationRole = "viewer",
  visibleHrefs?: ReadonlySet<string>
) {
  const focusedSection = section ?? roleHomeSection[role];
  const dailyHrefs = new Set(dailyRoutes[focusedSection]);
  const source = visibleHrefs ? primaryNav.filter((item) => visibleHrefs.has(item.href)) : primaryNav;
  const daily = source.filter((item) => dailyHrefs.has(item.href));
  const more = (Object.keys(navSectionLabels) as NavSection[])
    .map((groupSection) => ({
      section: groupSection,
      label: navSectionLabels[groupSection],
      items: source.filter((item) => item.section === groupSection && !dailyHrefs.has(item.href))
    }))
    .filter((group) => group.items.length > 0);

  return { daily, more };
}

// ── V3-SET-006: navigation customization (presets + settings hub) ──
//
// Two independent gates decide whether a nav item renders, applied in this
// order:
//   1. Capability gate (deployment truth, server-sourced): a module whose
//      backing capability is not "enabled" on this deployment never renders,
//      no matter what the user's preference says. A preset cannot turn it on.
//   2. Mandatory gate: /settings and /safety-preview always render once they
//      pass the capability gate -- a preset or a user's own hiddenModules
//      list can never remove them. /safety-preview is the "mandatory
//      security alert" surface named in the acceptance criteria.
// Everything else is hidden only if the user (directly, or via an applied
// preset's one-time copy) added it to navigation.hiddenModules.
export const NAV_MODULE_CAPABILITY: Readonly<Partial<Record<string, CapabilityKey>>> = {
  "/system/control": "systemControl",
  "/backup": "backups",
  "/trash": "trash",
  "/data-center": "odbc",
  "/broadcast": "broadcastMetadata",
  "/discover": "semanticSearch",
  "/media/jobs": "mediaProcessing",
  "/transcriber": "ocr",
  "/plugins": "mcp"
};

export const MANDATORY_NAV_HREFS: readonly string[] = ["/settings", "/safety-preview"];

export function isMandatoryNavHref(href: string): boolean {
  return MANDATORY_NAV_HREFS.includes(href);
}

export function isNavHrefCapabilityLocked(href: string, capabilities: Capabilities): boolean {
  const capabilityKey = NAV_MODULE_CAPABILITY[href];
  if (!capabilityKey) return false;
  return capabilities[capabilityKey].status !== "enabled";
}

/** Full set of hrefs that are allowed to render for this user right now. */
export function visibleNavHrefs(
  items: readonly { href: string }[],
  navigation: NavigationExperienceSettings | undefined,
  capabilities: Capabilities
): Set<string> {
  const hidden = new Set(navigation?.hiddenModules ?? []);
  const visible = new Set<string>();

  for (const item of items) {
    if (isNavHrefCapabilityLocked(item.href, capabilities)) continue;
    if (isMandatoryNavHref(item.href) || !hidden.has(item.href)) visible.add(item.href);
  }

  return visible;
}

export function applyNavigationVisibility<T extends { href: string }>(
  items: readonly T[],
  navigation: NavigationExperienceSettings | undefined,
  capabilities: Capabilities
): T[] {
  const visible = visibleNavHrefs(items, navigation, capabilities);
  return items.filter((item) => visible.has(item.href));
}

/**
 * Reorders section groups per `navigation.order` (a list of section keys).
 * Sections not named in `order` keep their original relative order,
 * appended after the ones the user did place.
 */
export function reorderNavigationSections<S extends string>(
  sections: Record<S, string>,
  order: readonly string[] | undefined
): Array<[S, string]> {
  const entries = Object.entries(sections) as Array<[S, string]>;
  if (!order || order.length === 0) return entries;

  const bySection = new Map<string, string>(entries);
  const ordered: Array<[S, string]> = [];
  const seen = new Set<string>();

  for (const key of order) {
    const label = bySection.get(key);
    if (label !== undefined && !seen.has(key)) {
      ordered.push([key as S, label]);
      seen.add(key);
    }
  }

  for (const [key, label] of entries) {
    if (!seen.has(key)) ordered.push([key, label]);
  }

  return ordered;
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
