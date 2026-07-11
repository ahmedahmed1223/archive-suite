"use client";

import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDailyNavigation, isActivePath, primaryNav } from "@/lib/navigation";
import { useAuthSession } from "@/lib/auth-session";

const iconRegistry = Icons as unknown as Record<string, LucideIcon>;

export default function MobilePrimaryNav() {
  const pathname = usePathname() || "/";
  const auth = useAuthSession();
  const activeSection = primaryNav.find((link) => isActivePath(pathname, link.href))?.section;
  const mobileItems = getDailyNavigation(activeSection, auth.user?.role ?? "viewer").daily;

  function openAllRoutes() {
    window.dispatchEvent(new Event("archive:toggle-navigation"));
  }

  return (
    <nav className="mobile-primary-nav" aria-label="التنقل اليومي">
      {mobileItems.map((item) => {
        const Icon = iconRegistry[item.icon] || Icons.Circle;
        const active = isActivePath(pathname, item.href);

        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
            <Icon aria-hidden="true" size={19} strokeWidth={2} />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <button type="button" onClick={openAllRoutes} aria-controls="app-primary-nav">
        <Icons.Menu aria-hidden="true" size={20} strokeWidth={2} />
        <span>المزيد</span>
      </button>
    </nav>
  );
}
