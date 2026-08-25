"use client";

import { Activity, Bell, ChevronLeft, Gauge, Search, UploadCloud, UserCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { openCommandPalette } from "@/components/CommandPalette";
import ContextualTips from "@/components/ContextualTips";
import type { PageKey } from "@/lib/contextual-tips";
import { useAuthSession } from "@/lib/auth-session";
import { getLocalizedNavigation, isActivePath } from "@/lib/navigation";
import { getShortcut, formatShortcutDisplay } from "@/lib/keyboard-shortcuts";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import WorkResumeLink, { type WorkResumeTarget } from "@/components/WorkResumeLink";
import {
  readWorkspacePreferences,
  resolveWorkspaceRoute,
  updateWorkspacePreferences,
  workspacePreferencesStorageKey,
} from "@/lib/workspace-preferences";
import { isContextRecordingEnabled } from "@/lib/personal-context";

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
  // V15-DAILY-004: derive a resume target from the user-scoped saved workspace.
  const resumeTarget: WorkResumeTarget | null = useMemo(() => {
    if (!isContextRecordingEnabled()) return null;
    try {
      const raw = localStorage.getItem(workspacePreferencesStorageKey(auth.user?.id ?? ""));
      if (!raw) return null;
      const prefs = readWorkspacePreferences(raw);
      const lastRoute = prefs.lastWorkspaceRoute;
      if (!lastRoute) return null;
      const valid = resolveWorkspaceRoute(lastRoute);
      if (!valid) return null;
      if (!prefs.lastVisitedAt) return null;
      return { pathname: valid, label: t.shell.workspace, visitedAt: prefs.lastVisitedAt };
    } catch {
      return null;
    }
  }, [auth.user?.id, t.shell.workspace, pathname]);
  const [shortcutDisplay, setShortcutDisplay] = useState("Ctrl / Cmd + K");

  // V15-DAILY-004: record the current workspace route so the resume link can
  // offer the previous one. Only valid, known routes are persisted (per-user
  // storage key), and never while on the destination surfaces themselves.
  useEffect(() => {
    const userId = auth.user?.id;
    if (!userId || !isContextRecordingEnabled()) return;
    const valid = resolveWorkspaceRoute(pathname);
    if (!valid) return;
    try {
      const key = workspacePreferencesStorageKey(userId);
      const current = readWorkspacePreferences(localStorage.getItem(key));
      const next = updateWorkspacePreferences(current, valid, {});
      next.lastWorkspaceRoute = valid;
      next.lastVisitedAt = new Date().toISOString();
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Local preferences are optional.
    }
  }, [auth.user?.id, pathname]);

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
      <WorkResumeLink target={resumeTarget} pathname={pathname} enabled={isContextRecordingEnabled() && (pathname === "/work-inbox" || pathname === "/")} resumeLabel={t.shell.resumeWork} />
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
