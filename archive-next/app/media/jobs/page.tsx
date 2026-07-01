import AppHeader from "@/components/AppHeader";
import { MediaJobLookup } from "./MediaJobLookup";
import { MediaJobsList } from "./MediaJobsList";

const backendNotes = [
  {
    title: "واجهة المتابعة",
    body: "تعرض حالة المهام وخياراتها بطريقة قابلة للفحص دون تنفيذ معالجة ثقيلة داخل المتصفح."
  },
  {
    title: "خدمة المعالجة",
    body: "طلبات /api/v1/media/jobs/:id تقرأ حالة المهام من Laravel وتعرض النتائج عند اكتمالها."
  },
  {
    title: "حدود النظام",
    body: "المعالجة الثقيلة تبقى داخل طوابير Laravel، والواجهة تعرض الحالة دون تكرار منطق الخادم."
  }
];

export default function MediaJobsPage() {
  return (
    <main className="shell">
      <AppHeader subtitle="مسار الوسائط" />

      <section className="content stack" aria-label="مهام الوسائط في Laravel">
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
