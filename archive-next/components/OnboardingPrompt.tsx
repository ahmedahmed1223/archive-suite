"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ONBOARDING_PROMPT_DISMISSED_KEY, ONBOARDING_STORAGE_KEY } from "@/lib/onboarding";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const hiddenPathPrefixes = ["/first-run", "/login", "/share/", "/review/"];

function shouldHidePrompt(pathname: string) {
  return hiddenPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

export default function OnboardingPrompt() {
  const { t } = useLocale();
  const pathname = usePathname() || "/";
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (shouldHidePrompt(pathname)) {
      setIsVisible(false);
      return;
    }

    setIsVisible(
      window.localStorage.getItem(ONBOARDING_STORAGE_KEY) !== "complete"
      && window.localStorage.getItem(ONBOARDING_PROMPT_DISMISSED_KEY) !== "true"
    );
  }, [pathname]);

  if (!isVisible) return null;

  return (
    <section className="onboarding-prompt" aria-label={t.shell.onboardingAria}>
      <div>
        <strong>{t.shell.onboardingTitle}</strong>
        <p>{t.shell.onboardingDescription}</p>
      </div>
      <div className="button-row">
        {/* V14-UX-008 follow-up: the tour is a secondary nudge, never competing
            with each page's real primary action. */}
        <a className="button button-secondary button-sm" href="/first-run">
          {t.shell.openTour}
        </a>
        <button
          type="button"
          className="button button-secondary button-sm"
          onClick={() => {
            window.localStorage.setItem(ONBOARDING_PROMPT_DISMISSED_KEY, "true");
            setIsVisible(false);
          }}
        >
          {t.shell.dismissReminder}
        </button>
      </div>
    </section>
  );
}
