"use client";

import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import { FileVideo, FolderSearch, ListChecks } from "lucide-react";
import { MediaJobLookup } from "./MediaJobLookup";
import { MediaJobsList } from "./MediaJobsList";
import styles from "./jobs.module.css";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function MediaJobsPage() {
  const { t } = useLocale();
  const copy = t.pages.mediaJobsPage;
  return (
    <AppShell subtitle={t.pageTitles.mediaWorkflow} contentClassName={`stack ${styles.jobsContent}`} tipsPage="media-jobs">
      <PageToolbar
        icon={<FileVideo size={24} />}
        title={copy.title}
        description={copy.description}
        tone="accent"
        meta={
          <>
            <span className="badge">{copy.directInspectionBadge}</span>
            <span className="badge">{copy.createJobsBadge}</span>
            <span className="badge">{copy.queueMonitoringBadge}</span>
          </>
        }
        actions={(
          <>
            <a className="button button-secondary" href="/files">
              <FolderSearch size={16} aria-hidden="true" />
              {copy.filesLink}
            </a>
            <a className="button button-secondary" href="/media/review">
              <ListChecks size={16} aria-hidden="true" />
              {copy.mediaReviewLink}
            </a>
          </>
        )}
      />

      <div className={`split-layout ${styles.operationsConsole}`} aria-label={copy.toolsAriaLabel}>
        <div className={styles.creationPanel}>
          <MediaJobLookup />
        </div>
        <div className={styles.jobsTablePanel}>
          <MediaJobsList />
        </div>
      </div>
    </AppShell>
  );
}
