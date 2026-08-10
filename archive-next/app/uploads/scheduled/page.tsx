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
        title="الرفعات المجدولة"
        description="تابع رفعات الملفات المجدولة لموعد لاحق، وأعد جدولتها أو ألغِها أو أعد محاولة الفاشلة منها."
        tone="accent"
        meta={
          <>
            <span className="badge">جدولة الرفع</span>
            <span className="badge">إعادة محاولة تلقائية</span>
          </>
        }
        actions={(
          <a className="button button-secondary" href="/uploads">
            رفع جديد
          </a>
        )}
      />

      <ScheduledUploadsClient />
    </AppShell>
  );
}
