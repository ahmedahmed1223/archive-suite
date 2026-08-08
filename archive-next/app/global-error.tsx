"use client";

import { useEffect, useState } from "react";
import { BRAND } from "@/lib/brand";

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

  return (
    <html lang={locale} dir={english ? "ltr" : "rtl"}>
      <body>
        <main className="content global-error-content">
          <section className="panel">
            <span className="badge badge-danger">{english ? "Unexpected error" : "خطأ غير متوقع"}</span>
            <h1>{english ? `Could not load ${BRAND.latinName}.` : `تعذر تحميل ${BRAND.arabicName}.`}</h1>
            <p>
              {english ? "Try again. If the error continues, open the error log from the workspace." : "يمكنك إعادة المحاولة، وإن تكرر الخطأ فافتح سجل الأخطاء من لوحة التشغيل."}
            </p>
            {error.digest ? <p className="muted">{english ? "Error reference" : "مرجع الخطأ"}: {error.digest}</p> : null}
            <div className="button-row">
              <button className="button button-primary" type="button" onClick={reset}>
                {english ? "Try again" : "إعادة المحاولة"}
              </button>
              <a className="button" href="/errors">
                {english ? "Error log" : "سجل الأخطاء"}
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
