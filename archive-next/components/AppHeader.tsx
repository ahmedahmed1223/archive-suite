"use client";

import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { isActivePath, navSectionLabels, primaryNav } from "@/lib/navigation";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { openCommandPalette } from "@/components/CommandPalette";
import { useAuthSession } from "@/lib/auth-session";
import Breadcrumb, { type BreadcrumbItem } from "@/components/Breadcrumb";
import DensityToggle from "@/components/DensityToggle";
import FocusModeToggle from "@/components/FocusModeToggle";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import RecentFavoritesMenu from "@/components/RecentFavoritesMenu";
import { formatShortcutDisplay, getShortcut } from "@/lib/keyboard-shortcuts";
import { useTheme } from "@/components/ThemeProvider";
import { filterGuideChapters, getGuideChapterForPath } from "@/lib/in-app-guide";

const iconRegistry = Icons as unknown as Record<string, LucideIcon>;
const navIcon = (name: string) => iconRegistry[name] || Icons.Circle;

const LIGHT_PRESET = "neutral-light";
const DARK_PRESET = "cinematic-dark";

export default function AppHeader({
  subtitle,
  navLabel = "المسارات الرئيسية",
  breadcrumbExtra = []
}: Readonly<{
  subtitle: string;
  navLabel?: string;
  /** عناصر إضافية تُلحق بمسار التنقل الأساسي (مثل اسم العنصر المفتوح حاليًا). */
  breadcrumbExtra?: BreadcrumbItem[];
}>) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const auth = useAuthSession();
  const theme = useTheme();
  const isLightTheme = theme.settings.currentPreset === LIGHT_PRESET;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigationTriggerRef = useRef<HTMLButtonElement>(null);
  const navGroupRefs = useRef<HTMLDetailsElement[]>([]);
  const routeLinksRef = useRef<HTMLElement>(null);
  const [navigationScroll, setNavigationScroll] = useState({ up: false, down: false });
  const [shortcutDisplay, setShortcutDisplay] = useState("Ctrl / Cmd + K");
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const updateShortcutDisplay = () => setShortcutDisplay(formatShortcutDisplay(getShortcut("commandPalette")));

    updateShortcutDisplay();
    window.addEventListener("archive:shortcuts-changed", updateShortcutDisplay);
    return () => window.removeEventListener("archive:shortcuts-changed", updateShortcutDisplay);
  }, []);

  function closeNavigation({ restoreFocus = true } = {}) {
    setIsMenuOpen(false);
    if (restoreFocus) requestAnimationFrame(() => navigationTriggerRef.current?.focus());
  }

  useEffect(() => {
    if (!isMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeNavigation();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isMenuOpen]);

  useEffect(() => {
    const toggleNavigation = () => {
      setIsMenuOpen((current) => !current);
      document.getElementById("app-primary-nav")?.scrollIntoView({ block: "start", behavior: "smooth" });
    };

    window.addEventListener("archive:toggle-navigation", toggleNavigation);
    return () => window.removeEventListener("archive:toggle-navigation", toggleNavigation);
  }, []);

  async function handleLogout() {
    await auth.logout();
    router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }

  const userLabel = auth.user?.name ?? auth.user?.email ?? auth.user?.id;
  const activeLink = primaryNav.find((link) => isActivePath(pathname, link.href));
  const activeSection = activeLink?.section;
  const role = auth.user?.role ?? "viewer";
  const navigationGroups = Object.entries(navSectionLabels).map(([section, label]) => ({
    section,
    label,
    items: primaryNav.filter((item) => item.section === section)
  }));
  const breadcrumbItems: BreadcrumbItem[] = [{ label: "الرئيسية", href: "/" }];
  const contextualGuide = getGuideChapterForPath(pathname, filterGuideChapters([
    { id: "viewer-search", title: "", audience: ["viewer", "editor", "admin"] as const, body: "", href: "/search" },
    { id: "editor-upload", title: "", audience: ["editor", "admin"] as const, body: "", href: "/uploads" },
    { id: "admin-operations", title: "", audience: ["admin"] as const, body: "", href: "/settings/users" },
  ], role, ""));
  if (activeSection) breadcrumbItems.push({ label: navSectionLabels[activeSection] });
  if (activeLink && activeLink.href !== "/") breadcrumbItems.push({ label: activeLink.label, href: activeLink.href });
  breadcrumbItems.push(...breadcrumbExtra);

  const updateNavigationScroll = () => {
    const navigation = routeLinksRef.current;
    if (!navigation) return;
    const maxScroll = Math.max(0, navigation.scrollHeight - navigation.clientHeight);
    setNavigationScroll({ up: navigation.scrollTop > 1, down: navigation.scrollTop < maxScroll - 1 });
  };

  useEffect(() => {
    const navigation = routeLinksRef.current;
    if (!navigation) return;
    updateNavigationScroll();
    window.addEventListener("resize", updateNavigationScroll);
    return () => window.removeEventListener("resize", updateNavigationScroll);
  }, []);

  const scrollNavigation = (direction: 1 | -1) => {
    const navigation = routeLinksRef.current;
    if (!navigation) return;
    navigation.scrollBy({
      top: direction * Math.max(240, Math.round(navigation.clientHeight * 0.72)),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });
  };

  const expandNavigationGroups = () => {
    navGroupRefs.current.forEach((group) => { group.open = true; });
    updateNavigationScroll();
  };
  const collapseNavigationGroups = () => {
    navGroupRefs.current.forEach((group) => { group.open = false; });
    updateNavigationScroll();
  };

  return (
    <header className="topbar" data-layout="app-header" data-nav-open={isMenuOpen ? "true" : "false"}>
      <Link className="brand" href="/" aria-label={`${BRAND.arabicName} - الرئيسية`}>
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
        aria-label={isMenuOpen ? "إغلاق التنقل" : "فتح التنقل"}
        ref={navigationTriggerRef}
        onClick={() => isMenuOpen ? closeNavigation({ restoreFocus: false }) : setIsMenuOpen(true)}
      >
        {isMenuOpen ? <Icons.X aria-hidden="true" size={18} /> : <Icons.Menu aria-hidden="true" size={18} />}
        <span>المسارات</span>
      </button>
      <div className="topbar-actions" aria-label="أدوات الواجهة">
        {contextualGuide ? (
          <Link className="icon-action" href={`/help?chapter=${contextualGuide.id}`} title="كيف تعمل هذه الصفحة؟">
            <Icons.CircleHelp aria-hidden="true" size={18} strokeWidth={2} />
            <span>كيف تعمل هذه الصفحة؟</span>
          </Link>
        ) : null}
        <Link className="icon-action primary-action-link" href="/uploads" title="إضافة مادة">
          <Icons.UploadCloud aria-hidden="true" size={18} strokeWidth={2} />
          <span>إضافة مادة</span>
        </Link>
        {auth.status === "authenticated" && (
          <>
            <RecentFavoritesMenu />
            <NotificationsPanel />
          </>
        )}
        {auth.status === "authenticated" ? (
          <div className="session-chip" title={userLabel}>
            <Icons.UserCircle aria-hidden="true" size={18} strokeWidth={2} />
            <span>{userLabel}</span>
            <button type="button" onClick={handleLogout} aria-label="تسجيل الخروج">
              <Icons.LogOut aria-hidden="true" size={16} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <Link className="icon-action session-login-link" href={`/login?next=${encodeURIComponent(pathname)}`}>
            <Icons.LogIn aria-hidden="true" size={18} strokeWidth={2} />
            <span>الدخول</span>
          </Link>
        )}
        <DensityToggle />
        <FocusModeToggle />
        <button
          type="button"
          className="icon-action command-trigger"
          data-command-trigger
          onClick={openCommandPalette}
          aria-label="فتح لوحة الأوامر"
          aria-keyshortcuts="Control+K Meta+K"
          title="بحث سريع"
        >
          <Icons.Search aria-hidden="true" size={18} strokeWidth={2} />
          <kbd>{shortcutDisplay}</kbd>
        </button>
      </div>
      {isMenuOpen ? <button type="button" className="navigation-backdrop" aria-label="إغلاق التنقل" onClick={() => closeNavigation()} /> : null}
      <div className="shell-controls">
        <button
          type="button"
          className="shell-theme-toggle"
          onClick={() => theme.setPreset(isLightTheme ? DARK_PRESET : LIGHT_PRESET)}
          aria-pressed={isLightTheme}
          title={isLightTheme ? "التبديل إلى الوضع الداكن" : "التبديل إلى الوضع الفاتح"}
        >
          {isLightTheme ? <Icons.Moon aria-hidden="true" size={16} strokeWidth={2} /> : <Icons.Sun aria-hidden="true" size={16} strokeWidth={2} />}
          <span>{isLightTheme ? "الوضع الداكن" : "الوضع الفاتح"}</span>
        </button>
      </div>
      <div className="sidebar-navigation">
        <button type="button" className="sidebar-scroll-control" aria-label="تمرير القائمة لأعلى" title="تمرير القائمة لأعلى" disabled={!navigationScroll.up} onClick={() => scrollNavigation(-1)}>
          <Icons.ChevronUp aria-hidden="true" size={18} strokeWidth={2} />
        </button>
        <nav id="app-primary-nav" className="route-links" aria-label={navLabel} ref={routeLinksRef} onScroll={updateNavigationScroll}>
          <div className="nav-group-actions" aria-label="أدوات مجموعات التنقل">
            <button type="button" className="button button-ghost button-sm" onClick={expandNavigationGroups}>فتح كل المجموعات</button>
            <button type="button" className="button button-ghost button-sm" onClick={collapseNavigationGroups}>طي كل المجموعات</button>
          </div>
          {navigationGroups.map((group, index) => (
            <details
              className="nav-group"
              data-section={group.section}
              key={group.section}
              open={group.section === activeSection || (!activeSection && index === 1)}
              ref={(element) => { if (element) navGroupRefs.current[index] = element; }}
            >
              <summary>{group.label}</summary>
              <div className="nav-section" data-section={group.section}>
                {group.items.map((link) => {
                  const isActive = isActivePath(pathname, link.href);
                  const Icon = navIcon(link.icon);
                  return (
                    <Link key={link.href} className="badge app-nav-link" data-section={link.section} href={link.href} aria-current={isActive ? "page" : undefined}>
                      <Icon aria-hidden="true" className="app-nav-link__icon" size={16} strokeWidth={2} />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            </details>
          ))}
        </nav>
        <button type="button" className="sidebar-scroll-control" aria-label="تمرير القائمة لأسفل" title="تمرير القائمة لأسفل" disabled={!navigationScroll.down} onClick={() => scrollNavigation(1)}>
          <Icons.ChevronDown aria-hidden="true" size={18} strokeWidth={2} />
        </button>
      </div>
      <div className="app-breadcrumb"><Breadcrumb items={breadcrumbItems} /></div>
    </header>
  );
}
