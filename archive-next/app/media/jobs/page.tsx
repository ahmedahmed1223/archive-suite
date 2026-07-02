import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import { MediaJobLookup } from "./MediaJobLookup";
import { MediaJobsList } from "./MediaJobsList";
import styles from "./jobs.module.css";

export default function MediaJobsPage() {
  return (
    <AppShell subtitle="مسار الوسائط" contentClassName={`stack ${styles.jobsContent}`}>
      <PageToolbar
        title="مهام الوسائط"
        description="فحص job منفرد، إنشاء مهام جديدة، ومتابعة قائمة المعالجة من خلال Laravel queue."
        meta={
          <>
            <span className="badge">فحص مباشر</span>
            <span className="badge">إنشاء jobs</span>
            <span className="badge">مراقبة queue</span>
          </>
        }
      />

      <div className={`split-layout ${styles.operationsConsole}`} aria-label="أدوات media jobs">
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
