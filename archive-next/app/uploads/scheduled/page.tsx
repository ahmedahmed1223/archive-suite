"use client";

import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import { CalendarClock } from "lucide-react";
import ScheduledUploadsClient from "./ScheduledUploadsClient";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function ScheduledUploadsPage() {
  const { t } = useLocale();
  return (
    <AppShell subtitle={t.pageTitles.scheduledUploads} navLabel={t.pageTitles.scheduledUploads} contentClassName="stack">
      <PageToolbar
        icon={<CalendarClock size={24} />}
        title={t.pages.scheduledUploads.toolbarTitle}
        description={t.pages.scheduledUploads.toolbarDescription}
        tone="accent"
        meta={
          <>
            <span className="badge">{t.pages.scheduledUploads.scheduleBadge}</span>
            <span className="badge">{t.pages.scheduledUploads.autoRetryBadge}</span>
          </>
        }
        actions={(
          <a className="button button-secondary" href="/uploads">
            {t.pages.scheduledUploads.newUploadButton}
          </a>
        )}
      />

      <ScheduledUploadsClient />
    </AppShell>
  );
}
