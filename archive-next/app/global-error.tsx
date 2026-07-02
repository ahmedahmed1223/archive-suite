"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { BRAND } from "@/lib/brand";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body>
        <main className="content global-error-content">
          <section className="panel">
            <span className="badge badge-danger">خطأ غير متوقع</span>
            <h1>تعذر تحميل {BRAND.arabicName}.</h1>
            <p>
              تم تسجيل الخطأ للمراجعة. يمكنك إعادة المحاولة، وإن تكرر الخطأ
              فافتح سجل الأخطاء من لوحة التشغيل.
            </p>
            {error.digest ? <p className="muted">مرجع الخطأ: {error.digest}</p> : null}
            <div className="button-row">
              <button className="button button-primary" type="button" onClick={reset}>
                إعادة المحاولة
              </button>
              <a className="button" href="/errors">
                سجل الأخطاء
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
