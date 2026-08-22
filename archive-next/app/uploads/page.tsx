"use client";

import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import DisclosureToolbar from "@/components/DisclosureToolbar";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Link2, PlusCircle } from "lucide-react";
import { ImportFromUrlForm } from "./ImportFromUrlForm";
import { IntakeTemplatesPanel } from "./IntakeTemplatesPanel";
import { UploadForm } from "./UploadForm";
import { UploadLinksPanel } from "./UploadLinksPanel";
import { FilelessRecordForm } from "./FilelessRecordForm";

// V14-UX-006 (Task 6): file upload is THE primary intake path; every other
// intake route (fileless record, URL import, templates, links) waits behind
// a disclosure so the first screen shows one obvious action.
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
    </AppShell>
  );
}
