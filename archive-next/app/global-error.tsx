"use client";

import { useEffect, useState } from "react";
import { BRAND } from "@/lib/brand";
import { shared as arShared } from "@/lib/i18n/dictionaries/ar/shared";
import { shared as enShared } from "@/lib/i18n/dictionaries/en/shared";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = useState<"ar" | "en">("ar");
  useEffect(() => {
    console.error(error);
    setLocale(document.documentElement.lang === "en" ? "en" : "ar");
  }, [error]);

  const english = locale === "en";
  const copy = english ? enShared.globalError : arShared.globalError;
  const brand = english ? BRAND.latinName : BRAND.arabicName;

  return (
    <html lang={locale} dir={english ? "ltr" : "rtl"}>
      <body>
        <main className="content global-error-content">
          <section className="panel">
            <span className="badge badge-danger">{copy.badge}</span>
            <h1>{copy.title.replace("{brand}", brand)}</h1>
            <p>
              {copy.description}
            </p>
            {error.digest ? <p className="muted">{copy.errorReference}: {error.digest}</p> : null}
            <div className="button-row">
              <button className="button button-primary" type="button" onClick={reset}>
                {copy.retry}
              </button>
              <a className="button" href="/errors">
                {copy.errorLog}
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
