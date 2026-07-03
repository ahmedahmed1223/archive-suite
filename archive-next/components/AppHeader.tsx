"use client";

import { Menu, Search, X } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { isActivePath, primaryNav } from "@/lib/navigation";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { openCommandPalette } from "@/components/CommandPalette";
import ThemeToggle from "@/components/ThemeToggle";

export default function AppHeader({
  subtitle,
  navLabel = "المسارات الرئيسية"
}: Readonly<{
  subtitle: string;
  navLabel?: string;
}>) {
  const pathname = usePathname() || "/";
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

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
        {primaryNav.map((link) => {
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
      </nav>
    </header>
  );
}
