import AppHeader from "@/components/AppHeader";
import { MediaJobLookup } from "./MediaJobLookup";
import { MediaJobsList } from "./MediaJobsList";

const backendNotes = [
  {
    title: "Frontend",
    body: "هذه الصفحة تعمل داخل Next.js App Router وتبقى مسؤولة فقط عن تجربة المستخدم والقراءة من العميل typed."
  },
  {
    title: "Backend",
    body: "طلبات /api/v1/media/jobs/:id تمر عبر rewrite إلى Laravel عند ضبط ARCHIVE_API_BASE_URL."
  },
  {
    title: "حدود النظام",
    body: "تنفيذ المعالجة الثقيلة داخل Laravel queues، بينما يعرض Next.js الحالة دون نقل منطق الخادم."
  }
];

export default function MediaJobsPage() {
  return (
    <main className="shell">
      <AppHeader subtitle="مسار الوسائط" />

      <section className="content stack" aria-label="Media jobs Laravel">
        <div className="hero">
          <span className="badge">Next.js frontend + Laravel backend</span>
          <h1>Media jobs عبر Laravel.</h1>
          <p>
            هذا المسار يثبت الحدود المطلوبة: Next.js يعرض الواجهة، وLaravel
            يملك API وحالة queue لمسارات media workflow.
          </p>
          <div className="record-meta" aria-label="ملخص التنفيذ">
            <span className="badge">واجهة قراءة فقط</span>
            <span className="badge">Laravel queue</span>
            <span className="badge">Next.js App Router</span>
          </div>
        </div>

        <div className="grid" aria-label="حدود التنفيذ">
          {backendNotes.map((note) => (
            <article className="panel" key={note.title}>
              <h2>{note.title}</h2>
              <p>{note.body}</p>
            </article>
          ))}
        </div>

        <div className="auth-layout" aria-label="أدوات media jobs">
          <MediaJobLookup />
          <MediaJobsList />
        </div>
      </section>
    </main>
  );
}
