import { getContractSummary } from "@/lib/archive-api";

const apiContract = getContractSummary();

export default function HomePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>Archive Suite</strong>
          <span>Next.js canonical app</span>
        </div>
        <nav className="route-links" aria-label="مسارات Next.js">
          <a className="badge" href="/help">المساعدة</a>
          <a className="badge" href="/archive">قائمة السجلات</a>
          <a className="badge" href="/files">استعراض الملفات</a>
          <a className="badge" href="/reports">التقارير</a>
          <a className="badge" href="/settings">الإعدادات</a>
          <a className="badge" href="/media/jobs">media jobs</a>
          <a className="badge" href="/login">تجربة تسجيل الدخول</a>
        </nav>
      </header>

      <section className="content">
        <div className="hero">
          <span className="badge">Next.js + Laravel</span>
          <h1>واجهة Archive Suite المعتمدة تعمل فوق Laravel API.</h1>
          <p>
            هذا هو مسار التطوير الافتراضي الآن: Next.js للواجهة، وLaravel
            للـ API والمصادقة والملفات والبحث والوسائط. تطبيق Vite وخادم Node
            بقيا كمرجع legacy فقط حتى تكتمل إزالة الاعتماد عليهما.
          </p>
        </div>

        <div className="grid" aria-label="حالة الترحيل">
          <article className="panel">
            <h2>عقد API</h2>
            <p>
              {apiContract.title} v{apiContract.version} يحتوي على{" "}
              {apiContract.routeCount} مسارا أساسيا.
            </p>
          </article>

          <article className="panel">
            <h2>المسار الحالي</h2>
            <ul>
              <li>Next.js هو مسار الواجهة الافتراضي للتطوير.</li>
              <li>Laravel هو API المعتمد لمسارات `/api/v1/*`.</li>
              <li>Vite/Node مصنّفان legacy/reference ولا تُبنى عليهما ميزات جديدة.</li>
              <li>التطوير الجديد يبدأ من العقود المشتركة ثم Laravel ثم Next.</li>
              <li>واجهة media jobs تعرض حالة Laravel queue دون نقل منطق backend إلى Next.js.</li>
            </ul>
          </article>

          <article className="panel">
            <h2>بوابات القبول</h2>
            <ul>
              <li>typecheck لكل workspace.</li>
              <li>build مستقل لـ Next.js.</li>
              <li>اختبارات E2E لكل مسار منقول.</li>
              <li>عميل Auth يدعم Bearer + HttpOnly refresh cookie.</li>
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}
