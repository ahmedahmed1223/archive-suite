"use client";

import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { getDailyNavigation, isActivePath, primaryNav } from "@/lib/navigation";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { openCommandPalette } from "@/components/CommandPalette";
import { useAuthSession } from "@/lib/auth-session";
import FocusModeToggle from "@/components/FocusModeToggle";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { formatShortcutDisplay, getShortcut } from "@/lib/keyboard-shortcuts";

const iconRegistry = Icons as unknown as Record<string, LucideIcon>;
const navIcon = (name: string) => iconRegistry[name] || Icons.Circle;

export default function AppHeader({
  subtitle,
  navLabel = "المسارات الرئيسية"
}: Readonly<{
  subtitle: string;
  navLabel?: string;
}>) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const auth = useAuthSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
  const activeSection = primaryNav.find((link) => isActivePath(pathname, link.href))?.section;
  const navigation = getDailyNavigation(activeSection, auth.user?.role ?? "viewer");

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
        onClick={() => setIsMenuOpen((current) => !current)}
      >
        {isMenuOpen ? <Icons.X aria-hidden="true" size={18} /> : <Icons.Menu aria-hidden="true" size={18} />}
        <span>المسارات</span>
      </button>
      <div className="topbar-actions" aria-label="أدوات الواجهة">
        <Link className="icon-action primary-action-link" href="/uploads" title="إضافة مادة">
          <Icons.UploadCloud aria-hidden="true" size={18} strokeWidth={2} />
          <span>إضافة مادة</span>
        </Link>
        {auth.status === "authenticated" && (
          <NotificationsPanel />
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
      <nav id="app-primary-nav" className="route-links" aria-label={navLabel}>
        <div className="nav-section" data-section={activeSection ?? "daily"}>
          <span className="nav-section-label">يوميًا</span>
          {navigation.daily.map((link) => {
              const isActive = isActivePath(pathname, link.href);
              const Icon = navIcon(link.icon);

              return (
                <Link
                  key={link.href}
                  className="badge app-nav-link"
                  data-section={link.section}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon aria-hidden="true" className="app-nav-link__icon" size={16} strokeWidth={2} />
                  <span>{link.label}</span>
                </Link>
              );
          })}
        </div>
        <details className="nav-more">
          <summary>المزيد</summary>
          {navigation.more.map((group) => (
            <div className="nav-section" data-section={group.section} key={group.section}>
              <span className="nav-section-label">{group.label}</span>
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
          ))}
        </details>
      </nav>
    </header>
  );
}
