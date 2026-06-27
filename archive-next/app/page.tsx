import { getContractSummary } from "@/lib/archive-api";

const apiContract = getContractSummary();

export default function HomePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>Archive Suite</strong>
          <span>Next.js migration shell</span>
        </div>
        <span className="badge">TypeScript + RTL</span>
      </header>

      <section className="content">
        <div className="hero">
          <span className="badge">مرحلة انتقالية آمنة</span>
          <h1>واجهة Next.js الجديدة تبدأ من عقد API ثابت.</h1>
          <p>
            هذه الحزمة لا تستبدل تطبيق Vite الحالي بعد. هدفها الأول أن تثبت
            اتجاه Next.js مع TypeScript، وتقرأ العقد المشترك الذي سيستخدمه
            Laravel لاحقا.
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
              <li>يبقى Vite/React هو التطبيق التشغيلي.</li>
              <li>تنتقل الصفحات إلى Next.js تدريجيا بعد Playwright.</li>
              <li>Laravel يطبّق نفس العقد قبل تحويل المرور إليه.</li>
            </ul>
          </article>

          <article className="panel">
            <h2>بوابات القبول</h2>
            <ul>
              <li>typecheck لكل workspace.</li>
              <li>build مستقل لـ Next.js.</li>
              <li>اختبارات E2E لكل مسار منقول.</li>
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}
