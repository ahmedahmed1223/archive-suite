import type { ReactNode } from "react";
import AppHeader from "@/components/AppHeader";
import OnboardingPrompt from "@/components/OnboardingPrompt";

export default function AppShell({
  subtitle,
  navLabel,
  children,
  contentClassName = ""
}: Readonly<{
  subtitle: string;
  navLabel?: string;
  children: ReactNode;
  contentClassName?: string;
}>) {
  return (
    <main className="shell app-shell">
      <AppHeader subtitle={subtitle} navLabel={navLabel} />
      <section className={`content app-content ${contentClassName}`.trim()}>
        <OnboardingPrompt />
        {children}
      </section>
    </main>
  );
}
