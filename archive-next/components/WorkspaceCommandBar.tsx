"use client";

import { Activity, Bell, ChevronLeft, Gauge, Search, UploadCloud, UserCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { openCommandPalette } from "@/components/CommandPalette";
import { useAuthSession } from "@/lib/auth-session";
import { isActivePath, navSectionLabels, primaryNav } from "@/lib/navigation";
import { getShortcut, formatShortcutDisplay } from "@/lib/keyboard-shortcuts";

const quickActions = [
  { href: "/uploads", label: "إضافة", icon: UploadCloud },
  { href: "/activity", label: "النشاط", icon: Activity },
  { href: "/status", label: "الصحة", icon: Gauge }
] as const;

export default function WorkspaceCommandBar() {
  const auth = useAuthSession();
  const pathname = usePathname() || "/";
  const userLabel = auth.user?.name ?? auth.user?.email ?? auth.user?.id ?? "مستخدم";
  const activeLink = primaryNav.find((link) => isActivePath(pathname, link.href)) ?? primaryNav[0];
  const activeSection = navSectionLabels[activeLink.section];
  const [shortcutDisplay, setShortcutDisplay] = useState("Ctrl / Cmd + K");

  useEffect(() => {
    const binding = getShortcut("commandPalette");
    setShortcutDisplay(formatShortcutDisplay(binding));

    const handleUpdate = () => {
      const newBinding = getShortcut("commandPalette");
      setShortcutDisplay(formatShortcutDisplay(newBinding));
    };

    window.addEventListener("archive:shortcuts-changed", handleUpdate);
    return () => window.removeEventListener("archive:shortcuts-changed", handleUpdate);
  }, []);

  return (
    <div className="workspace-commandbar" data-layout="workspace-commandbar" aria-label="شريط أوامر مساحة العمل">
      <div className="workspace-commandbar__context">
        <div className="workspace-commandbar__user" title={userLabel}>
          <UserCircle size={34} aria-hidden="true" />
          <span>
            <strong>{userLabel}</strong>
            <small>{auth.user?.role === "admin" ? "مدير الأرشيف" : "مساحة العمل"}</small>
          </span>
        </div>
        <div className="workspace-commandbar__crumbs" aria-label="الموقع الحالي">
          <span>{activeSection}</span>
          <ChevronLeft size={14} aria-hidden="true" />
          <strong>{activeLink.label}</strong>
        </div>
      </div>
      <button
        type="button"
        className="workspace-commandbar__search"
        onClick={openCommandPalette}
        aria-keyshortcuts="Control+K Meta+K"
      >
        <Search size={18} aria-hidden="true" />
        <span>بحث، فتح صفحة، أو تنفيذ أمر...</span>
        <kbd>{shortcutDisplay}</kbd>
      </button>
      <nav className="workspace-commandbar__quick" aria-label="أوامر سريعة">
        {quickActions.map((action) => {
          const Icon = action.icon;

          return (
            <Link key={action.href} className="workspace-commandbar__quick-link" href={action.href}>
              <Icon size={16} aria-hidden="true" />
              <span>{action.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="workspace-commandbar__tools">
        <button type="button" className="icon-action" aria-label="التنبيهات">
          <Bell size={18} aria-hidden="true" />
          <span className="workspace-commandbar__dot" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
