"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ONBOARDING_STORAGE_KEY } from "@/lib/onboarding";

const hiddenPathPrefixes = ["/first-run", "/login", "/share/", "/review/"];

function shouldHidePrompt(pathname: string) {
  return hiddenPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

export default function OnboardingPrompt() {
  const pathname = usePathname() || "/";
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (shouldHidePrompt(pathname)) {
      setIsVisible(false);
      return;
    }

    setIsVisible(window.localStorage.getItem(ONBOARDING_STORAGE_KEY) !== "complete");
  }, [pathname]);

  if (!isVisible) return null;

  return (
    <section className="onboarding-prompt" aria-label="مسار أول تشغيل">
      <div>
        <strong>هل هذا أول تشغيل؟</strong>
        <p>راجع مسار التهيئة السريع أو المتقدم قبل بدء العمل اليومي.</p>
      </div>
      <div className="button-row">
        <a className="button button-primary button-sm" href="/first-run">
          فتح الجولة
        </a>
        <button
          type="button"
          className="button button-secondary button-sm"
          onClick={() => {
            window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "complete");
            setIsVisible(false);
          }}
        >
          تم التجهيز
        </button>
      </div>
    </section>
  );
}
