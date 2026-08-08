"use client";

import { useEffect } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function RouteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="content">
      <section className="panel">
        <span className="badge badge-danger">{t.shared.pages.pageError}</span>
        <h1>{t.shared.pages.pageErrorTitle}</h1>
        <p>{t.shared.pages.pageErrorDescription}</p>
        {error.digest ? <p className="muted">{t.shared.pages.errorReference}: {error.digest}</p> : null}
        <div className="button-row">
          <button className="button button-primary" type="button" onClick={reset}>
            {t.shared.actions.retry}
          </button>
          <a className="button" href="/">
            {t.shell.home}
          </a>
        </div>
      </section>
    </main>
  );
}
