"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import DisclosureToolbar from "@/components/DisclosureToolbar";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Link2, PlusCircle } from "lucide-react";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";
import { ImportFromUrlForm } from "./ImportFromUrlForm";
import { IntakeTemplatesPanel } from "./IntakeTemplatesPanel";
import { UploadForm } from "./UploadForm";
import { UploadLinksPanel } from "./UploadLinksPanel";
import { FilelessRecordForm } from "./FilelessRecordForm";

// V14-UX-REVIEW-3: this is the page archivists live in daily. The four intake
// paths are now first-class cards (previously three of them hid behind a
// disclosure), and a "recently added" strip closes the loop after each entry.
export default function UploadsPage() {
  const { t, locale } = useLocale();
  const api = useMemo(() => createArchiveApiClient(), []);
  const [recent, setRecent] = useState<ArchiveRecord[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api.records({ store: "", limit: 8 }).then((response) => {
      if (!cancelled && response.ok) {
        const sorted = [...response.records].sort((a, b) =>
          (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
        );
        setRecent(sorted.slice(0, 6));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const modes = [
    { id: "files", icon: "📁", title: t.pages.uploads.modeFilesTitle, description: t.pages.uploads.modeFilesDescription },
    { id: "fileless", icon: "📝", title: t.pages.uploads.modeFilelessTitle, description: t.pages.uploads.modeFilelessDescription },
    { id: "url", icon: "🔗", title: t.pages.uploads.modeUrlTitle, description: t.pages.uploads.modeUrlDescription },
    { id: "links", icon: "📤", title: t.pages.uploads.modeLinksTitle, description: t.pages.uploads.modeLinksDescription },
  ];

  return (
    <AppShell subtitle={t.pageTitles.addArchive} contentClassName="stack" tipsPage="uploads">
      <PageToolbar
        icon={<PlusCircle size={24} strokeWidth={2} />}
        eyebrow={<span className="badge">{t.pages.uploads.eyebrow}</span>}
        title={t.pages.uploads.title}
        description={t.pages.uploads.description}
        meta={
          <>
            <span className="badge">{t.pages.uploads.badgeWizard}</span>
            <span className="badge">{t.pages.uploads.badgeMultiUpload}</span>
            <span className="badge">{t.pages.uploads.badgeMetadata}</span>
            <span className="badge">{t.pages.uploads.badgeMaxSize}</span>
          </>
        }
        actions={
          <>
            <a className="button button-secondary" href="/archive">{t.pages.uploads.openArchiveAction}</a>
            <a className="button button-secondary" href="/media/jobs">{t.pages.uploads.mediaJobsAction}</a>
          </>
        }
      />

      {/* Intake modes overview — one card per path so nothing hides. */}
      <section className="add-modes" aria-label={t.pages.uploads.modesAriaLabel}>
        {modes.map((mode) => (
          <article className="add-mode-card" key={mode.id}>
            <span className="add-mode-card__icon" aria-hidden="true">{mode.icon}</span>
            <div>
              <strong>{mode.title}</strong>
              <p className="helper-text">{mode.description}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="add-workspace" aria-label={t.pages.uploads.sectionAriaLabel}>
        <div className="add-workspace__primary">
          <UploadForm />
        </div>
        <DisclosureToolbar summary={t.pages.uploads.otherIntakeOptions}>
          <div className="add-workspace__support-grid">
            <FilelessRecordForm />
            <ImportFromUrlForm />
            <IntakeTemplatesPanel />
            <UploadLinksPanel />
          </div>
        </DisclosureToolbar>
      </section>

      {/* Recently added: closes the loop and shows what still needs description. */}
      <section aria-label={t.pages.uploads.recentTitle}>
        <div className="panel-title-row">
          <h2>{t.pages.uploads.recentTitle}</h2>
          <a className="button button-secondary button-sm" href="/archive">{t.pages.uploads.recentOpenAll}</a>
        </div>
        {recent === null ? null : recent.length === 0 ? (
          <p className="helper-text">{t.pages.uploads.recentEmpty}</p>
        ) : (
          <ul className="stack-list">
            {recent.map((record) => {
              const complete = record.descriptorCompletion?.status !== "red" && record.descriptorCompletion?.status !== "yellow";
              return (
                <li key={record.id}>
                  <a href={`/archive/${encodeURIComponent(record.id)}`}>{record.title || record.id}</a>
                  <span className={`badge ${complete ? "" : "badge-warn"}`}>
                    {complete ? t.pages.uploads.recentComplete : t.pages.uploads.recentNeedsDescribe}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
