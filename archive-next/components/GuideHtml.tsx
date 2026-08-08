import { useMemo } from "react";

import { sanitizeGuideHtml } from "@/lib/guide-html";
import type { AppLocale } from "@/lib/i18n/types";

interface GuideHtmlProps {
  html: string;
  locale: AppLocale;
}

export default function GuideHtml({ html, locale }: GuideHtmlProps) {
  const safeHtml = useMemo(() => sanitizeGuideHtml(html), [html]);

  return (
    <div
      className="guide-html"
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
