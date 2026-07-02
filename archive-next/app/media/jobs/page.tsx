import AppHeader from "@/components/AppHeader";
import { MediaJobLookup } from "./MediaJobLookup";
import { MediaJobsList } from "./MediaJobsList";
import styles from "./jobs.module.css";

export default function MediaJobsPage() {
  return (
    <main className="shell">
      <AppHeader subtitle="مسار الوسائط" />

      <section className={`content stack ${styles.jobsContent}`} aria-label="مهام الوسائط في Laravel">
        <div className="hero">
          <span className="badge">معالجة وسائط</span>
          <h1>مهام الوسائط عبر Laravel.</h1>
          <p>
            تابع عمليات التحويل، اللقطات، والتفريغ من مكان واحد مع عرض واضح
            لحالة الطوابير والخيارات المرسلة لكل مهمة.
          </p>
          <div className="record-meta" aria-label="ملخص التنفيذ">
            <span className="badge">واجهة متابعة</span>
            <span className="badge">Laravel queue</span>
            <span className="badge">عميل API موحد</span>
          </div>
        </div>

        <div className={styles.operationsConsole} aria-label="أدوات media jobs">
          <div className={styles.creationPanel}>
            <MediaJobLookup />
          </div>
          <div className={styles.jobsTablePanel}>
            <MediaJobsList />
          </div>
        </div>
      </section>
    </main>
  );
}
