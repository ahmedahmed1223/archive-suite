"use client";

import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { isActivePath, navSectionLabels, primaryNav, type NavSection } from "@/lib/navigation";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { openCommandPalette } from "@/components/CommandPalette";
import { useAuthSession } from "@/lib/auth-session";
import FocusModeToggle from "@/components/FocusModeToggle";

const navSections = Object.keys(navSectionLabels) as NavSection[];
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
          title="بحث سريع"
        >
          <Icons.Search aria-hidden="true" size={18} strokeWidth={2} />
          <kbd>Ctrl K</kbd>
        </button>
      </div>
      <nav id="app-primary-nav" className="route-links" aria-label={navLabel}>
        {navSections.map((section) => (
          <div className="nav-section" data-section={section} key={section}>
            <span className="nav-section-label">{navSectionLabels[section]}</span>
            {primaryNav.filter((link) => link.section === section).map((link) => {
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
        ))}
      </nav>
    </header>
  );
}
