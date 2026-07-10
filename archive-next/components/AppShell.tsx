"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import OnboardingPrompt from "@/components/OnboardingPrompt";
import MobilePrimaryNav from "@/components/MobilePrimaryNav";
import WorkspaceCommandBar from "@/components/WorkspaceCommandBar";
import { isFocusMode } from "@/lib/focus-mode";
import type { PageKey } from "@/lib/contextual-tips";
import ContextualTips from "@/components/ContextualTips";

export default function AppShell({
  subtitle,
  navLabel,
  children,
  contentClassName = "",
  tipsPage
}: Readonly<{
  subtitle: string;
  navLabel?: string;
  children: ReactNode;
  contentClassName?: string;
  tipsPage?: PageKey;
}>) {
  const [isFocus, setIsFocus] = useState(false);

  useEffect(() => {
    setIsFocus(isFocusMode());
    const interval = setInterval(() => {
      const current = isFocusMode();
      if (current !== isFocus) {
        setIsFocus(current);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isFocus]);

  return (
    <div className="shell app-shell" data-focus-mode={isFocus ? "true" : "false"}>
      <a className="skip-link" href="#main-content">
        الانتقال إلى المحتوى الرئيسي
      </a>
      <AppHeader subtitle={subtitle} navLabel={navLabel} />
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
