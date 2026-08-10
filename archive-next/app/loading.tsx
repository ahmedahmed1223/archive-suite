"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function RouteLoading() {
  const { t } = useLocale();
  return (
    <main className="content">
      <section className="panel">
        <Skeleton label={t.pages.loading.label} lines={4} />
      </section>
    </main>
  );
}
