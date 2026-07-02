"use client";

import { BRAND } from "@/lib/brand";
import { usePathname } from "next/navigation";

const primaryNav = [
  { href: "/", label: "الرئيسية" },
  { href: "/archive", label: "السجلات" },
  { href: "/files", label: "الملفات" },
  { href: "/types", label: "الأنواع" },
  { href: "/media/jobs", label: "الوسائط" },
  { href: "/collaboration", label: "التعاون" },
  { href: "/reports", label: "التقارير" },
  { href: "/settings", label: "الإعدادات" },
  { href: "/errors", label: "الأخطاء" },
  { href: "/help", label: "المساعدة" }
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

  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label={`${BRAND.arabicName} - الرئيسية`}>
        <img className="brand-mark" src={BRAND.markPath} alt="" width={44} height={44} />
        <span className="brand-name">
          <strong>{BRAND.arabicName}</strong>
          <span className="brand-latin">{BRAND.latinName}</span>
        </span>
        <span className="brand-subtitle">{subtitle}</span>
      </a>
      <nav className="route-links" aria-label={navLabel}>
        {primaryNav.map((link) => {
          const isActive = isActivePath(pathname, link.href);

          return (
            <a
              key={link.href}
              className="badge app-nav-link"
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
