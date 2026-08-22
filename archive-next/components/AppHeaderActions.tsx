"use client";

import * as Icons from "lucide-react";
import Link from "next/link";
import { openCommandPalette } from "@/components/CommandPalette";
import DensityToggle from "@/components/DensityToggle";
import FocusModeToggle from "@/components/FocusModeToggle";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import RecentFavoritesMenu from "@/components/RecentFavoritesMenu";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export interface AppHeaderActionsProps {
  userLabel?: string;
  authenticated: boolean;
  isLightTheme: boolean;
  loginHref: string;
  onLogout(): Promise<void>;
  onToggleTheme(): void;
}

// V14-UX-002 (Task 2): the header's action hierarchy in one component —
// one primary action (add material), the command trigger, notifications,
// and everything secondary tucked into a disclosure.
export default function AppHeaderActions({
  userLabel,
  authenticated,
  isLightTheme,
  loginHref,
  onLogout,
  onToggleTheme
}: Readonly<AppHeaderActionsProps>) {
  const { t } = useLocale();

  return (
    <div className="topbar-actions" aria-label={t.shell.interfaceTools}>
      <Link className="icon-action primary-action-link" href="/uploads" title={t.shell.addMaterial}>
        <Icons.UploadCloud aria-hidden="true" size={18} strokeWidth={2} />
        <span>{t.shell.addMaterial}</span>
      </Link>
      <button
        type="button"
        className="icon-action command-trigger"
        data-command-trigger
        onClick={openCommandPalette}
        aria-label={t.shell.openCommandPalette}
        aria-keyshortcuts="Control+K Meta+K"
        title={t.shell.quickSearch}
      >
        <Icons.Search aria-hidden="true" size={18} strokeWidth={2} />
        <kbd>Ctrl / Cmd + K</kbd>
      </button>
      {authenticated ? (
        <>
          <RecentFavoritesMenu />
          <NotificationsPanel />
        </>
      ) : null}
      <details className="topbar-more">
        <summary className="icon-action" role="button" aria-label={t.shell.moreActions} title={t.shell.moreActions}>
          <Icons.MoreVertical aria-hidden="true" size={18} strokeWidth={2} />
        </summary>
        <div className="topbar-more__panel ui-dropdown-content" role="menu">
          <DensityToggle />
          <FocusModeToggle />
          <button type="button" className="button button-ghost" onClick={onToggleTheme}>
            {isLightTheme ? t.shell.darkMode : t.shell.lightMode}
          </button>
          {authenticated ? (
            <div className="session-chip" title={userLabel}>
              <Icons.UserCircle aria-hidden="true" size={18} strokeWidth={2} />
              <span>{userLabel}</span>
              <button type="button" onClick={() => void onLogout()} aria-label={t.shell.signOut}>
                <Icons.LogOut aria-hidden="true" size={16} strokeWidth={2} />
              </button>
            </div>
          ) : (
            <Link className="icon-action session-login-link" href={loginHref}>
              <Icons.LogIn aria-hidden="true" size={18} strokeWidth={2} />
              <span>{t.shell.signIn}</span>
            </Link>
          )}
        </div>
      </details>
    </div>
  );
}
