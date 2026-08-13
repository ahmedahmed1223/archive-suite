import { notFound } from "next/navigation";
import ReleaseNotesDocument from "@/components/ReleaseNotesDocument";
import { getReleaseNotes } from "@/lib/release-notes";

export default async function ReleaseNotesPage({ params }: Readonly<{ params: Promise<{ version: string }> }>) {
  const { version } = await params;
  const release = getReleaseNotes(version);
  if (!release) notFound();

  return (
    <main className="release-notes-page">
      <section dir="rtl" lang="ar">
        <ReleaseNotesDocument markdown={release.ar} />
      </section>
      <section dir="ltr" lang="en">
        <ReleaseNotesDocument markdown={release.en} />
      </section>
    </main>
  );
}
