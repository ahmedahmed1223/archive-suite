"use client";

import AppShell from "@/components/AppShell";
import { OperationalPage } from "@/components/operations/OperationalPage";
import { FolderSearch, MonitorPlay } from "lucide-react";
import { MediaJobLookup } from "./MediaJobLookup";
import { MediaJobsList } from "./MediaJobsList";
import { MediaToolchainStatus } from "./MediaToolchainStatus";
import styles from "./jobs.module.css";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function MediaJobsPage() {
  const { t } = useLocale();
  const copy = t.pages.mediaJobsPage;
  return (
    <AppShell subtitle={t.pageTitles.mediaWorkflow} contentClassName={`stack ${styles.jobsContent}`} tipsPage="media-jobs">
      <OperationalPage
        eyebrow={<span className="badge">{copy.directInspectionBadge}</span>}
        title={copy.title}
        description={copy.description}
        status={
          <>
            <span className="badge">{copy.createJobsBadge}</span>
            <span className="badge">{copy.queueMonitoringBadge}</span>
          </>
        }
        contentLabel={copy.toolsAriaLabel}
        secondaryActions={(
          <>
            <a className="button button-secondary" href="/files">
              <FolderSearch size={16} aria-hidden="true" />
              {copy.filesLink}
            </a>
            <a className="button button-secondary" href="/media/studio">
              <MonitorPlay size={16} aria-hidden="true" />
              {copy.mediaStudioLink}
            </a>
          </>
        )}
      >
        <MediaToolchainStatus />
        <div className={`split-layout ${styles.operationsConsole}`}>
          <div className={styles.creationPanel}>
            <MediaJobLookup />
          </div>
          <div className={styles.jobsTablePanel}>
            <MediaJobsList />
          </div>
        </div>
      </OperationalPage>
    </AppShell>
  );
}
