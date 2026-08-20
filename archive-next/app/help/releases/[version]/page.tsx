import { notFound } from "next/navigation";
import ReleaseNotesDocument from "@/components/ReleaseNotesDocument";
import { getReleaseNotes } from "@/lib/release-notes";

export default async function ReleaseNotesPage({ params }: Readonly<{ params: Promise<{ version: string }> }>) {
  const { version } = await params;
  const release = getReleaseNotes(version);
  if (!release) notFound();

  return (
    <main className="release-notes-page" aria-label="Release notes">
      <section className="release-notes-language release-notes-language-ar" dir="rtl" lang="ar">
        <header className="release-notes-language-header">
          <span className="release-notes-language-kicker">سجل التغييرات</span>
          <span className="release-notes-language-meta">العربية · RTL</span>
        </header>
        <ReleaseNotesDocument markdown={release.ar} />
      </section>
      <section className="release-notes-language release-notes-language-en" dir="ltr" lang="en">
        <header className="release-notes-language-header">
          <span className="release-notes-language-kicker">Release notes</span>
          <span className="release-notes-language-meta">English · LTR</span>
        </header>
        <ReleaseNotesDocument markdown={release.en} />
      </section>
    </main>
  );
}
