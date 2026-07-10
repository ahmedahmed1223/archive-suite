import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import { FileVideo, FolderSearch, ListChecks } from "lucide-react";
import { MediaJobLookup } from "./MediaJobLookup";
import { MediaJobsList } from "./MediaJobsList";
import styles from "./jobs.module.css";

export default function MediaJobsPage() {
  return (
    <AppShell subtitle="مسار الوسائط" contentClassName={`stack ${styles.jobsContent}`}>
      <PageToolbar
        icon={<FileVideo size={24} />}
        title="مهام الوسائط"
        description="افحص مهمة محددة، وأنشئ مهام معالجة جديدة، وتابع قائمة الانتظار وحالة التنفيذ من مكان واحد."
        tone="accent"
        meta={
          <>
            <span className="badge">فحص مباشر</span>
            <span className="badge">إنشاء مهام</span>
            <span className="badge">مراقبة قائمة الانتظار</span>
          </>
        }
        actions={(
          <>
            <a className="button button-secondary" href="/files">
              <FolderSearch size={16} aria-hidden="true" />
              الملفات
            </a>
            <a className="button button-secondary" href="/media/review">
              <ListChecks size={16} aria-hidden="true" />
              مراجعة الوسائط
            </a>
          </>
        )}
      />

      <div className={`split-layout ${styles.operationsConsole}`} aria-label="أدوات إدارة مهام الوسائط">
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
