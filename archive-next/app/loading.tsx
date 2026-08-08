"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function RouteLoading() {
  const { locale } = useLocale();
  return (
    <main className="content">
      <section className="panel">
        <Skeleton label={locale === "en" ? "Loading page…" : "جارٍ تحميل الصفحة…"} lines={4} />
      </section>
    </main>
  );
}
