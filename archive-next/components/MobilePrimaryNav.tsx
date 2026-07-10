"use client";

import { Archive, Grid2X2, Menu, Search, UploadCloud } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActivePath } from "@/lib/navigation";

const mobileItems = [
  { href: "/", label: "اللوحة", icon: Grid2X2 },
  { href: "/archive", label: "الأرشيف", icon: Archive },
  { href: "/search", label: "البحث", icon: Search },
  { href: "/uploads", label: "إضافة", icon: UploadCloud }
] as const;

export default function MobilePrimaryNav() {
  const pathname = usePathname() || "/";

  function openAllRoutes() {
    window.dispatchEvent(new Event("archive:toggle-navigation"));
  }

  return (
    <nav className="mobile-primary-nav" aria-label="التنقل اليومي">
      {mobileItems.map((item) => {
        const Icon = item.icon;
        const active = isActivePath(pathname, item.href);

        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
            <Icon aria-hidden="true" size={19} strokeWidth={2} />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <button type="button" onClick={openAllRoutes} aria-controls="app-primary-nav">
        <Menu aria-hidden="true" size={20} strokeWidth={2} />
        <span>المزيد</span>
      </button>
    </nav>
  );
}
