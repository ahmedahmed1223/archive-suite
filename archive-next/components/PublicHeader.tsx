"use client";

import { Languages } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { AppLocale } from "@/lib/i18n/types";

// Public-safe header for anonymous, token-based pages (review/share links).
// Deliberately does NOT reuse AppHeader: no authenticated nav, no internal routes.
export default function PublicHeader({ subtitle }: Readonly<{ subtitle: string }>) {
  const { locale, setLocale, t } = useLocale();
  const brandName = locale === "en" ? BRAND.latinName : BRAND.arabicName;
  const nextLocale: AppLocale = locale === "ar" ? "en" : "ar";

  return (
    <header className="topbar public-topbar">
      <span className="brand" aria-label={`${brandName} - ${subtitle}`}>
        <img className="brand-mark" src={BRAND.markPath} alt="" width={44} height={44} />
        <span className="brand-name">
          <strong>{brandName}</strong>
          <span className="brand-latin">{BRAND.latinName}</span>
        </span>
        <span className="brand-subtitle">{subtitle}</span>
      </span>
      <button
        type="button"
        className="button button-secondary button-sm public-topbar__language"
        onClick={() => setLocale(nextLocale)}
        aria-label={t.shared.switchLanguage.replace("{language}", t.shared.languages[nextLocale])}
      >
        <Languages size={16} aria-hidden="true" />
        {t.shared.languages[nextLocale]}
      </button>
    </header>
  );
}
