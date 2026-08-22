"use client";

import * as Icons from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { openCommandPalette } from "@/components/CommandPalette";
import { getDailyNavigation, getLocalizedNavigation, isActivePath, visibleNavHrefs } from "@/lib/navigation";
import { useAuthSession } from "@/lib/auth-session";
import { useExperienceProfile } from "@/lib/experience-profile-context";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { resolveIcon } from "@/lib/icon-registry";
import type { components } from "@/lib/generated/archive-api";

type NavigationExperienceSettings = components["schemas"]["NavigationExperienceSettings"];

export default function MobilePrimaryNav() {
  const { locale, t } = useLocale();
  const pathname = usePathname() || "/";
  const auth = useAuthSession();
  const { experience, capabilities } = useExperienceProfile();
  const { items } = getLocalizedNavigation(locale);
  const navigationValue = experience.navigation.value as NavigationExperienceSettings | undefined;
  const visibleHrefs = visibleNavHrefs(items, navigationValue, capabilities);
  // V14-UX-001: role-stable destinations — the bar no longer follows the
  // section of the page being viewed.
  const mobileItems = getDailyNavigation(auth.user?.role ?? "viewer", visibleHrefs).daily
    .map((item) => items.find((localized) => localized.href === item.href) ?? item);

  function openAllRoutes() {
    window.dispatchEvent(new Event("archive:toggle-navigation"));
  }

  return (
    <nav className="mobile-primary-nav" aria-label={t.shell.dailyNavigation}>
      {mobileItems.map((item) => {
        const Icon = resolveIcon(item.icon, Icons.Circle);
        const active = isActivePath(pathname, item.href);

        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
            <Icon aria-hidden="true" size={19} strokeWidth={2} />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <button type="button" className="mobile-primary-nav__command" data-testid="mobile-command-palette-trigger" onClick={openCommandPalette} aria-label={t.shell.openCommands}>
        <Icons.Search aria-hidden="true" size={20} strokeWidth={2} />
        <span>{t.shell.commands}</span>
      </button>
      <button type="button" onClick={openAllRoutes} aria-controls="app-primary-nav">
        <Icons.Menu aria-hidden="true" size={20} strokeWidth={2} />
        <span>{t.shell.more}</span>
      </button>
    </nav>
  );
}
