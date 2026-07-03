"use client";

import { BRAND } from "@/lib/brand";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const primaryNav = [
  { href: "/", label: "الرئيسية", section: "core" },
  { href: "/archive", label: "السجلات", section: "core" },
  { href: "/uploads", label: "إضافة", section: "core" },
  { href: "/search", label: "البحث", section: "core" },
  { href: "/files", label: "الملفات", section: "core" },
  { href: "/timeline", label: "الخط الزمني", section: "core" },
  { href: "/favorites", label: "المفضلة", section: "core" },
  { href: "/shares", label: "المشاركات", section: "core" },
  { href: "/types", label: "الأنواع", section: "manage" },
  { href: "/media/jobs", label: "الوسائط", section: "manage" },
  { href: "/collaboration", label: "التعاون", section: "manage" },
  { href: "/analytics", label: "التحليلات", section: "observe" },
  { href: "/reports", label: "التقارير", section: "observe" },
  { href: "/status", label: "الحالة", section: "observe" },
  { href: "/errors", label: "الأخطاء", section: "observe" },
  { href: "/settings", label: "الإعدادات", section: "admin" },
  { href: "/help", label: "المساعدة", section: "admin" }
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/media/jobs") {
    return pathname.startsWith("/media");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

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
        <span className="nav-toggle__icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span>المسارات</span>
      </button>
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
