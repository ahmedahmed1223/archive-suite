"use client";

import { BRAND } from "@/lib/brand";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function PublicFooter() {
  const { locale } = useLocale();
  const descriptor = locale === "en" ? "Archive and media management" : BRAND.descriptor;
  return (
    <footer className="public-footer">
      {BRAND.lockupName} · {descriptor}
    </footer>
  );
}
