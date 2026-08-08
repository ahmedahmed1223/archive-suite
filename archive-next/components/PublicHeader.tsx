"use client";

import { BRAND } from "@/lib/brand";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { localizePageLabel } from "@/lib/i18n/page-labels";

// Public-safe header for anonymous, token-based pages (review/share links).
// Deliberately does NOT reuse AppHeader: no authenticated nav, no internal routes.
export default function PublicHeader({ subtitle }: Readonly<{ subtitle: string }>) {
  const { locale } = useLocale();
  const localizedSubtitle = localizePageLabel(subtitle, locale);
  const brandName = locale === "en" ? BRAND.latinName : BRAND.arabicName;
  return (
    <header className="topbar public-topbar">
      <span className="brand" aria-label={`${brandName} - ${localizedSubtitle}`}>
        <img className="brand-mark" src={BRAND.markPath} alt="" width={44} height={44} />
        <span className="brand-name">
          <strong>{brandName}</strong>
          <span className="brand-latin">{BRAND.latinName}</span>
        </span>
        <span className="brand-subtitle">{localizedSubtitle}</span>
      </span>
    </header>
  );
}
