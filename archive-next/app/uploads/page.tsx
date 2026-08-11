"use client";

import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Link2, PlusCircle } from "lucide-react";
import { ImportFromUrlForm } from "./ImportFromUrlForm";
import { IntakeTemplatesPanel } from "./IntakeTemplatesPanel";
import { UploadForm } from "./UploadForm";
import { UploadLinksPanel } from "./UploadLinksPanel";
import { FilelessRecordForm } from "./FilelessRecordForm";

export default function UploadsPage() {
  const { t } = useLocale();
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

      <section className="add-workspace" aria-label={t.pages.uploads.sectionAriaLabel}>
        <div className="add-workspace__primary">
          <FilelessRecordForm />
          <UploadForm />
        </div>
        <details className="add-workspace__support" aria-label={t.pages.uploads.supportAriaLabel}>
          <summary className="add-workspace__support-header">
            <div>
              <h2>{t.pages.uploads.supportHeading}</h2>
              <p>{t.pages.uploads.supportDescription}</p>
            </div>
            <span className="badge"><Link2 aria-hidden="true" size={14} /> {t.pages.uploads.supportBadge}</span>
          </summary>
          <div className="add-workspace__support-grid">
            <ImportFromUrlForm />
            <IntakeTemplatesPanel />
            <UploadLinksPanel />
          </div>
        </details>
      </section>
    </AppShell>
  );
}
