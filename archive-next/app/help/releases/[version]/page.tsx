import { notFound } from "next/navigation";
import ReleaseNotesDocument from "@/components/ReleaseNotesDocument";
import { getReleaseNotes, RELEASE_NOTES_LOCALE_LABEL } from "@/lib/release-notes";
import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME, isAppLocale, type AppLocale } from "@/lib/i18n/types";

/**
 * V14-UX-REVIEW: previously both language versions rendered stacked on one
 * page, doubling its length (worst on phones) and mixing reading directions.
 * Now the page renders only the reader's locale and links to the other one,
 * matching how the .ar.md files already cross-link each other. `?lang=`
 * overrides the locale cookie without touching it.
 */
function resolveLocale(cookieLocale: string | undefined, searchParams: { lang?: string }): AppLocale {
  if (isAppLocale(searchParams.lang)) return searchParams.lang;
  return cookieLocale === "en" ? "en" : "ar";
}

export default async function ReleaseNotesPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ version: string }>; searchParams: Promise<{ lang?: string }> }>) {
  const { version } = await params;
  const release = getReleaseNotes(version);
  if (!release) notFound();

  const cookieStore = await cookies();
  const query = await searchParams;
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value, query);
  const other: AppLocale = locale === "ar" ? "en" : "ar";

  return (
    <main className="release-notes-page" aria-label="Release notes">
      <section
        className={`release-notes-language release-notes-language-${locale}`}
        dir={locale === "ar" ? "rtl" : "ltr"}
        lang={locale}
      >
        <header className="release-notes-language-header">
          <span className="release-notes-language-kicker">{RELEASE_NOTES_LOCALE_LABEL[locale].kicker}</span>
          <span className="release-notes-language-meta">{RELEASE_NOTES_LOCALE_LABEL[locale].meta}</span>
        </header>
        <p className="release-notes-page__alt">
          {/* Native language name via Intl — keeps source free of Arabic literals (V2-305 guard). */}
          <a href={`?lang=${other}`} lang={other}>
            {new Intl.DisplayNames([other], { type: "language" }).of(other)}
          </a>
        </p>
        <ReleaseNotesDocument markdown={release[locale]} />
      </section>
    </main>
  );
}
