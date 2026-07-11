"use client";

import { useEffect } from "react";

export default function RouteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="content">
      <section className="panel">
        <span className="badge badge-danger">تعذر عرض الصفحة</span>
        <h1>حدث خطأ أثناء تحميل هذه الشاشة.</h1>
        <p>أعد المحاولة، أو ارجع إلى الرئيسية إذا استمر الخطأ.</p>
        {error.digest ? <p className="muted">مرجع الخطأ: {error.digest}</p> : null}
        <div className="button-row">
          <button className="button button-primary" type="button" onClick={reset}>
            إعادة المحاولة
          </button>
          <a className="button" href="/">
            الرئيسية
          </a>
        </div>
      </section>
    </main>
  );
}
