"use client";

import { BRAND } from "@/lib/brand";
import { applyNavigationVisibility, getLocalizedNavigation, isActivePath, reorderNavigationSections } from "@/lib/navigation";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuthSession } from "@/lib/auth-session";
import { useExperienceProfile } from "@/lib/experience-profile-context";
import Breadcrumb, { type BreadcrumbItem } from "@/components/Breadcrumb";
import AppHeaderActions from "@/components/AppHeaderActions";
import AppNavigationDrawer from "@/components/AppNavigationDrawer";
import { filterGuideChapters, getGuideChapterForPath } from "@/lib/in-app-guide";
import { useTheme } from "@/components/ThemeProvider";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import * as Icons from "lucide-react";
import type { components } from "@/lib/generated/archive-api";

type NavigationExperienceSettings = components["schemas"]["NavigationExperienceSettings"];

const LIGHT_PRESET = "neutral-light";
const DARK_PRESET = "cinematic-dark";

// V14-UX-002 (Task 2): AppHeader is now a small composer — brand, nav
// toggle, the extracted actions hierarchy, and the extracted route drawer.
export default function AppHeader({
  subtitle,
  navLabel,
  breadcrumbExtra = []
}: Readonly<{
  subtitle: string;
  navLabel?: string;
  /** Extra items appended to the main navigation trail, such as the open item's name. */
  breadcrumbExtra?: BreadcrumbItem[];
}>) {
  const { locale, t } = useLocale();
  const pathname = usePathname() || "/";
  const router = useRouter();
  const auth = useAuthSession();
  const { experience, capabilities } = useExperienceProfile();
  const theme = useTheme();
  const isLightTheme = theme.settings.currentPreset === LIGHT_PRESET;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigationTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  function closeNavigation({ restoreFocus = true } = {}) {
    setIsMenuOpen(false);
    if (restoreFocus) requestAnimationFrame(() => navigationTriggerRef.current?.focus());
  }

  useEffect(() => {
    const toggleNavigation = () => {
      setIsMenuOpen((current) => !current);
    };

    window.addEventListener("archive:toggle-navigation", toggleNavigation);
    return () => window.removeEventListener("archive:toggle-navigation", toggleNavigation);
  }, []);

  async function handleLogout() {
    await auth.logout();
    router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }

  const userLabel = auth.user?.name ?? auth.user?.email ?? auth.user?.id;
  const { items, sections } = getLocalizedNavigation(locale);
  const activeLink = items.find((link) => isActivePath(pathname, link.href));
  const activeSection = activeLink?.section;
  const role = auth.user?.role ?? "viewer";
  const navigationValue = experience.navigation.value as NavigationExperienceSettings | undefined;
  const visibleItems = applyNavigationVisibility(items, navigationValue, capabilities);
  const orderedSections = reorderNavigationSections(sections, navigationValue?.order);
  const navigationGroups = orderedSections.map(([section, label]) => ({
    section,
    label,
    items: visibleItems.filter((item) => item.section === section)
  })).filter((group) => group.items.length > 0);
  const breadcrumbItems: BreadcrumbItem[] = [{ label: t.shell.home, href: "/" }];
  const contextualGuide = getGuideChapterForPath(pathname, filterGuideChapters([
    { id: "viewer-search", title: "", audience: ["viewer", "editor", "admin"] as const, body: "", href: "/search" },
    { id: "editor-upload", title: "", audience: ["editor", "admin"] as const, body: "", href: "/uploads" },
    { id: "admin-operations", title: "", audience: ["admin"] as const, body: "", href: "/settings/users" },
  ], role, ""));
  if (activeSection) breadcrumbItems.push({ label: sections[activeSection] });
  if (activeLink && activeLink.href !== "/") breadcrumbItems.push({ label: activeLink.label, href: activeLink.href });
  breadcrumbItems.push(...breadcrumbExtra);

  return (
    <header className="topbar" data-layout="app-header" data-nav-open={isMenuOpen ? "true" : "false"}>
      <Link className="brand" href="/" aria-label={`${BRAND.arabicName} - ${t.shell.home}`}>
        <img className="brand-mark" src={BRAND.markPath} alt="" width={44} height={44} />
        <span className="brand-name">
          <strong>{BRAND.arabicName}</strong>
          <span className="brand-latin">{BRAND.latinName}</span>
        </span>
        <span className="brand-subtitle">{subtitle}</span>
      </Link>
      <button
        type="button"
        className="nav-toggle"
        aria-controls="app-primary-nav"
        aria-expanded={isMenuOpen}
        aria-label={isMenuOpen ? t.shell.closeNavigation : t.shell.openNavigation}
        ref={navigationTriggerRef}
        onClick={() => isMenuOpen ? closeNavigation({ restoreFocus: false }) : setIsMenuOpen(true)}
      >
        {isMenuOpen ? <Icons.X aria-hidden="true" size={18} /> : <Icons.Menu aria-hidden="true" size={18} />}
        <span>{t.shell.routes}</span>
      </button>
      {contextualGuide ? (
        <Link className="icon-action topbar-page-help" href={`/help?chapter=${contextualGuide.id}`} title={t.shell.pageHelp}>
          <Icons.CircleHelp aria-hidden="true" size={18} strokeWidth={2} />
          <span>{t.shell.pageHelp}</span>
        </Link>
      ) : null}
      <AppHeaderActions
        userLabel={userLabel}
        authenticated={auth.status === "authenticated"}
        isLightTheme={isLightTheme}
        loginHref={`/login?next=${encodeURIComponent(pathname)}`}
        onLogout={handleLogout}
        onToggleTheme={() => theme.setPreset(isLightTheme ? DARK_PRESET : LIGHT_PRESET)}
      />
      <AppNavigationDrawer groups={navigationGroups} activeHref={activeLink?.href} open={isMenuOpen} onClose={() => closeNavigation()} />
      <div className="app-breadcrumb"><Breadcrumb items={breadcrumbItems} /></div>
    </header>
  );
}
