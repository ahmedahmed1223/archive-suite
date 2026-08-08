"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import OnboardingPrompt from "@/components/OnboardingPrompt";
import MobilePrimaryNav from "@/components/MobilePrimaryNav";
import WorkspaceCommandBar from "@/components/WorkspaceCommandBar";
import { isFocusMode } from "@/lib/focus-mode";
import { getDensity } from "@/lib/density";
import type { PageKey } from "@/lib/contextual-tips";
import WorkspacePositionRestorer from "@/components/WorkspacePositionRestorer";
import ShortcutsOverlay from "@/components/ShortcutsOverlay";
import GlobalShortcuts from "@/components/GlobalShortcuts";
import type { BreadcrumbItem } from "@/components/Breadcrumb";
import WhatsNewDialog from "@/components/WhatsNewDialog";
import RouteAnnouncer from "@/components/RouteAnnouncer";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { localizePageLabel } from "@/lib/i18n/page-labels";

export default function AppShell({
  subtitle,
  navLabel,
  children,
  contentClassName = "",
  tipsPage,
  breadcrumbExtra
}: Readonly<{
  subtitle: string;
  navLabel?: string;
  children: ReactNode;
  contentClassName?: string;
  tipsPage?: PageKey;
  /** عناصر إضافية تُلحق بمسار التنقل الأساسي (مثل اسم العنصر المفتوح حاليًا). */
  breadcrumbExtra?: BreadcrumbItem[];
}>) {
  const { locale, t } = useLocale();
  const localizedSubtitle = localizePageLabel(subtitle, locale);
  const [isFocus, setIsFocus] = useState(false);
  const [density, setDensityState] = useState(getDensity());

  useEffect(() => {
    setIsFocus(isFocusMode());
    const interval = setInterval(() => {
      const current = isFocusMode();
      if (current !== isFocus) {
        setIsFocus(current);
      }
      const currentDensity = getDensity();
      setDensityState((prev) => (currentDensity === prev ? prev : currentDensity));
    }, 500);
    return () => clearInterval(interval);
  }, [isFocus]);

  return (
    <div
      className="shell app-shell"
      data-layout="app-shell"
      data-focus-mode={isFocus ? "true" : "false"}
      data-density={density}
    >
      <a className="skip-link" href="#main-content">
        {t.shell.skipToContent}
      </a>
      <AppHeader subtitle={localizedSubtitle} navLabel={navLabel ? localizePageLabel(navLabel, locale) : undefined} breadcrumbExtra={breadcrumbExtra} />
      <RouteAnnouncer />
      <WorkspacePositionRestorer />
      <ShortcutsOverlay />
      <GlobalShortcuts />
      <WhatsNewDialog />
      <main id="main-content" tabIndex={-1} className={`content app-content ${contentClassName}`.trim()}>
        <WorkspaceCommandBar tipsPage={tipsPage} />
        <OnboardingPrompt />
        {children}
      </main>
      <MobilePrimaryNav />
    </div>
  );
}
