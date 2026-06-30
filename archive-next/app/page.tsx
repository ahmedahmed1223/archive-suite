import { getContractSummary } from "@/lib/archive-api";

const apiContract = getContractSummary();
const navLinks = [
  { href: "/help", label: "المساعدة" },
  { href: "/archive", label: "السجلات" },
  { href: "/files", label: "الملفات" },
  { href: "/reports", label: "التقارير" },
  { href: "/media/jobs", label: "Media jobs" },
  { href: "/login", label: "تسجيل الدخول" }
] as const;

export default function HomePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>Archive Suite</strong>
          <span>Next.js canonical app</span>
        </div>
        <nav className="route-links" aria-label="مسارات Next.js">
          {navLinks.map((link) => (
            <a key={link.href} className="badge" href={link.href}>
              {link.label}
            </a>
          ))}
          <a className="badge" href="/settings">الإعدادات</a>
        </nav>
      </header>

      <section className="content">
        <div className="hero">
          <span className="badge">Next.js + Laravel</span>
          <h1>واجهة Archive Suite المعتمدة فوق Laravel API.</h1>
          <p>
            هذا هو مسار التطوير الافتراضي الآن: Next.js للواجهة، وLaravel
            للـ API والمصادقة والملفات والبحث والوسائط. تطبيق Vite وخادم Node
            بقيا كمرجع legacy فقط حتى تكتمل إزالة الاعتماد عليهما.
          </p>
          <div className="record-meta" aria-label="ملخص المسار">
            <span className="badge">{apiContract.title}</span>
            <span className="badge">v{apiContract.version}</span>
            <span className="badge">{apiContract.routeCount} مسار API</span>
          </div>
        </div>

        <div className="grid" aria-label="حالة الترحيل">
          <article className="panel">
            <h2>عقد API</h2>
            <p>
              العقد الحالي يعرّف {apiContract.routeCount} مسارات أساسية وتبقى
              نقطة المرجع قبل نقل أي شاشة جديدة.
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
              <li>typecheck لكل workspace قبل الدمج.</li>
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
