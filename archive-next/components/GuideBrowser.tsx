"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthSession } from "@/lib/auth-session";
import { filterGuideChapters, getGuideRoles, type GuideChapter, type GuideRole } from "@/lib/in-app-guide";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import GuideHtml from "@/components/GuideHtml";

export default function GuideBrowser({ chapters: initialChapters = [] }: Readonly<{ chapters?: GuideChapter[] }>) {
  const auth = useAuthSession();
  const { locale, t } = useLocale();
  const searchParams = useSearchParams();
  const role = (auth.user?.role ?? "viewer") as GuideRole;
  const [chapters, setChapters] = useState(initialChapters);
  const [query, setQuery] = useState("");
  const selectedHeadingRef = useRef<HTMLHeadingElement>(null);
  const requestedChapter = searchParams.get("chapter");
  const visible = useMemo(() => filterGuideChapters(chapters, role, query, locale), [chapters, locale, role, query]);
  const selected = visible.find((chapter) => chapter.id === requestedChapter) ?? visible[0];
  const roleLabel = getGuideRoles(locale).find((entry) => entry.value === role)?.label ?? role;
  const searchResultAnnouncement = query
    ? visible.length === 1
      ? t.help.guide.resultOne
      : visible.length === 0
        ? t.help.guide.resultNone
        : `${t.help.guide.resultManyPrefix} ${visible.length}`
    : "";

  useEffect(() => {
    selectedHeadingRef.current?.focus();
  }, [selected?.id]);

  useEffect(() => {
    if (auth.status !== "authenticated" || !auth.accessToken) return;

    let cancelled = false;
    fetch(`/api/guide?locale=${locale}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload: { ok?: boolean; chapters?: GuideChapter[] } | null) => {
        if (!cancelled && payload?.ok === true && Array.isArray(payload.chapters)) {
          setChapters(payload.chapters);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [auth.accessToken, auth.status, locale]);

  return (
    <section className="panel" aria-label={t.help.guide.ariaLabel}>
      <div className="panel-section-header">
        <h2>{locale === "ar" ? `${t.help.guide.titlePrefix} ${roleLabel}` : `${roleLabel} ${t.help.guide.titlePrefix}`}</h2>
        <p>{t.help.guide.intro}</p>
      </div>
      <label className="field-label" htmlFor="guide-search">{t.help.guide.searchLabel}</label>
      <input id="guide-search" type="search" className="text-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.help.guide.searchPlaceholder} />
      <p className="sr-only" role="status">{searchResultAnnouncement}</p>
      <div className="dense-grid" style={{ marginTop: "1rem" }}>
        <nav aria-label={t.help.guide.chaptersLabel}>
          <ul className="stack-list">
            {visible.map((chapter) => (
              <li key={chapter.id}>
                <a
                  className="text-accent"
                  href={`/help?chapter=${encodeURIComponent(chapter.id)}`}
                  aria-current={chapter.id === selected?.id ? "page" : undefined}
                >
                  {chapter.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <article aria-live="polite">
          {selected ? (
            <>
              <h2 ref={selectedHeadingRef} tabIndex={-1}>{selected.title}</h2>
              <GuideHtml html={selected.body} locale={locale} />
              <a className="button button-secondary" href={selected.href}>{t.help.guide.openRelatedPage}</a>
            </>
          ) : <p>{t.help.guide.noResults}</p>}
        </article>
      </div>
    </section>
  );
}
