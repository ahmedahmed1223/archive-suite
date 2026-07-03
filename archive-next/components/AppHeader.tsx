"use client";

import { LogIn, LogOut, Menu, Search, UserCircle, X } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { isActivePath, navSectionLabels, primaryNav, type NavSection } from "@/lib/navigation";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { openCommandPalette } from "@/components/CommandPalette";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuthSession } from "@/lib/auth-session";

const navSections = Object.keys(navSectionLabels) as NavSection[];

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

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await auth.logout();
    router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }

  const userLabel = auth.user?.name ?? auth.user?.email ?? auth.user?.id;

  return (
    <header className="topbar" data-nav-open={isMenuOpen ? "true" : "false"}>
      <a className="brand" href="/" aria-label={`${BRAND.arabicName} - الرئيسية`}>
        <img className="brand-mark" src={BRAND.markPath} alt="" width={44} height={44} />
        <span className="brand-name">
          <strong>{BRAND.arabicName}</strong>
          <span className="brand-latin">{BRAND.latinName}</span>
        </span>
        <span className="brand-subtitle">{subtitle}</span>
      </a>
      <button
        type="button"
        className="nav-toggle"
        aria-controls="app-primary-nav"
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen((current) => !current)}
      >
        {isMenuOpen ? <X aria-hidden="true" size={18} /> : <Menu aria-hidden="true" size={18} />}
        <span>المسارات</span>
      </button>
      <div className="topbar-actions" aria-label="أدوات الواجهة">
        {auth.status === "authenticated" ? (
          <div className="session-chip" title={userLabel}>
            <UserCircle aria-hidden="true" size={18} strokeWidth={2} />
            <span>{userLabel}</span>
            <button type="button" onClick={handleLogout} aria-label="تسجيل الخروج">
              <LogOut aria-hidden="true" size={16} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <a className="icon-action session-login-link" href={`/login?next=${encodeURIComponent(pathname)}`}>
            <LogIn aria-hidden="true" size={18} strokeWidth={2} />
            <span>الدخول</span>
          </a>
        )}
        <button
          type="button"
          className="icon-action command-trigger"
          data-command-trigger
          onClick={openCommandPalette}
          aria-label="فتح لوحة الأوامر"
          title="بحث سريع"
        >
          <Search aria-hidden="true" size={18} strokeWidth={2} />
          <kbd>Ctrl K</kbd>
        </button>
        <ThemeToggle />
      </div>
      <nav id="app-primary-nav" className="route-links" aria-label={navLabel}>
        {navSections.map((section) => (
          <div className="nav-section" data-section={section} key={section}>
            <span className="nav-section-label">{navSectionLabels[section]}</span>
            {primaryNav.filter((link) => link.section === section).map((link) => {
              const isActive = isActivePath(pathname, link.href);

              return (
                <a
                  key={link.href}
                  className="badge app-nav-link"
                  data-section={link.section}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                >
                  {link.label}
                </a>
              );
            })}
          </div>
        ))}
      </nav>
    </header>
  );
}
