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
    title: "الهجرة",
    body: "يبقى تنفيذ المعالجة الثقيلة داخل Laravel queues، بينما يعرض Next.js الحالة دون نقل منطق الخادم."
  }
];

export default function MediaJobsPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>Archive Suite</strong>
          <span>Next.js media workflow frontend</span>
        </div>
        <a className="badge" href="/">حالة الترحيل</a>
      </header>

      <section className="content auth-layout" aria-label="Media jobs Laravel">
        <div className="hero auth-copy">
          <span className="badge">Next.js frontend + Laravel backend</span>
          <h1>Media jobs عبر Laravel.</h1>
          <p>
            هذا المسار يثبت الحدود المطلوبة: Next.js يعرض الواجهة، وLaravel
            يملك API وحالة queue لمسارات media workflow.
          </p>

          <div className="grid" aria-label="حدود التنفيذ">
            {backendNotes.map((note) => (
              <article className="panel" key={note.title}>
                <h2>{note.title}</h2>
                <p>{note.body}</p>
              </article>
            ))}
          </div>
        </div>

        <MediaJobLookup />

        <MediaJobsList />
      </section>
    </main>
  );
}
