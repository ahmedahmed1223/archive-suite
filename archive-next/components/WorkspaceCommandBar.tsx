"use client";

import { Activity, Bell, ChevronLeft, Gauge, Search, UploadCloud, UserCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { openCommandPalette } from "@/components/CommandPalette";
import ContextualTips from "@/components/ContextualTips";
import type { PageKey } from "@/lib/contextual-tips";
import { useAuthSession } from "@/lib/auth-session";
import { getLocalizedNavigation, isActivePath } from "@/lib/navigation";
import { getShortcut, formatShortcutDisplay } from "@/lib/keyboard-shortcuts";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function WorkspaceCommandBar({ tipsPage }: Readonly<{ tipsPage?: PageKey }>) {
  const { locale, t } = useLocale();
  const auth = useAuthSession();
  const pathname = usePathname() || "/";
  const { items, sections } = getLocalizedNavigation(locale);
  const quickActions = [
    { href: "/uploads", label: t.shell.add, icon: UploadCloud },
    { href: "/activity", label: t.shell.activity, icon: Activity },
    { href: "/status", label: t.shell.health, icon: Gauge }
  ] as const;
  const userLabel = auth.user?.name ?? auth.user?.email ?? auth.user?.id ?? t.shell.workspace;
  const activeLink = items.find((link) => isActivePath(pathname, link.href)) ?? items[0];
  const activeSection = sections[activeLink.section];
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
    <div className="workspace-commandbar" data-layout="workspace-commandbar" aria-label={t.shell.workspaceCommandBar}>
      <div className="workspace-commandbar__context">
        <div className="workspace-commandbar__user" title={userLabel}>
          <UserCircle size={34} aria-hidden="true" />
          <span>
            <strong>{userLabel}</strong>
            <small>{auth.user?.role === "admin" ? t.shell.archiveManager : t.shell.workspace}</small>
          </span>
        </div>
        <div className="workspace-commandbar__crumbs" aria-label={t.shell.currentLocation}>
          <span>{activeSection}</span>
          <ChevronLeft size={14} aria-hidden="true" />
          <strong>{activeLink.label}</strong>
        </div>
      </div>
      <button
        type="button"
        className="workspace-commandbar__search"
        onClick={openCommandPalette}
        aria-label={t.shell.commandSearch}
        aria-keyshortcuts="Control+K Meta+K"
      >
        <Search size={18} aria-hidden="true" />
        <span>{t.shell.commandSearchPlaceholder}</span>
        <kbd>{shortcutDisplay}</kbd>
      </button>
      <nav className="workspace-commandbar__quick" aria-label={t.shell.quickActions}>
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
        {tipsPage && <ContextualTips page={tipsPage} />}
        <button type="button" className="icon-action" aria-label={t.shell.alerts}>
          <Bell size={18} aria-hidden="true" />
          <span className="workspace-commandbar__dot" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
