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
import ContextualTips from "@/components/ContextualTips";
import WorkspacePositionRestorer from "@/components/WorkspacePositionRestorer";
import ShortcutsOverlay from "@/components/ShortcutsOverlay";
import type { BreadcrumbItem } from "@/components/Breadcrumb";

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
        الانتقال إلى المحتوى الرئيسي
      </a>
      <AppHeader subtitle={subtitle} navLabel={navLabel} breadcrumbExtra={breadcrumbExtra} />
      <WorkspacePositionRestorer />
      <ShortcutsOverlay />
      <main id="main-content" tabIndex={-1} className={`content app-content ${contentClassName}`.trim()}>
        {tipsPage && <ContextualTips page={tipsPage} />}
        <WorkspaceCommandBar />
        <OnboardingPrompt />
        {children}
      </main>
      <MobilePrimaryNav />
    </div>
  );
}
