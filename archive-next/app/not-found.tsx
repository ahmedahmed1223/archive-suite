"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function NotFound() {
  const { t } = useLocale();
  return (
    <main className="content">
      <section className="panel">
        <span className="badge">404</span>
        <h1>{t.shared.pages.notFoundTitle}</h1>
        <p>{t.shared.pages.notFoundDescription}</p>
        <div className="button-row">
          <Link className="button button-primary" href="/">
            {t.shared.pages.backHome}
          </Link>
          <Link className="button" href="/archive">
            {t.shared.pages.openArchive}
          </Link>
        </div>
      </section>
    </main>
  );
}
