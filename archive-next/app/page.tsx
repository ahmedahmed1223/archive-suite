import { getContractSummary } from "@/lib/archive-api";
import AppHeader from "@/components/AppHeader";
import { BRAND } from "@/lib/brand";

const apiContract = getContractSummary();

export default function HomePage() {
  return (
    <main className="shell">
      <AppHeader subtitle="لوحة التشغيل" navLabel="مسارات النظام" />

      <section className="content">
        <div className="hero">
          <span className="badge">Laravel API · Next.js Frontend</span>
          <h1>لوحة تشغيل {BRAND.arabicName}.</h1>
          <p>
            واجهة موحدة لإدارة الأرشيف والملفات والبحث والوسائط فوق Laravel API
            المعتمد، مع مؤشرات حية لحالة النظام والمسارات الأساسية.
          </p>
          <div className="hero-actions">
            <span className="badge">عقد {BRAND.latinName}</span>
            <span className="badge">v{apiContract.version}</span>
            <span className="badge">{apiContract.routeCount} مسار API</span>
          </div>
        </div>

        <div className="dense-grid" aria-label="ملخص النظام">
          <article className="panel">
            <div className="panel-section-header">
              <h2>عقد API</h2>
            </div>
            <p>
              العقد الحالي يعرّف {apiContract.routeCount} مسارات أساسية متطابقة على
              كلا الجانبين (Node.js و Laravel). النموذج هو الحقيقة المرجعية.
            </p>
            <div className="record-meta">
              <span className="badge">schema-driven</span>
              <span className="badge">v{apiContract.version}</span>
            </div>
          </article>

          <article className="panel">
            <div className="panel-section-header">
              <h2>مسار النقل</h2>
            </div>
            <ul className="compact-list">
              <li>هذه الواجهة: Next.js 16 App Router و TypeScript.</li>
              <li>API المعتمد: Laravel 13 بمسارات `/api/v1/*`.</li>
              <li>التطوير: عقد مشترك → Laravel → واجهة Next.js.</li>
              <li>القديم: Node.js و React SPA للمرجعية فقط.</li>
            </ul>
          </article>

          <article className="panel">
            <div className="panel-section-header">
              <h2>معايير الجودة</h2>
            </div>
            <ul className="compact-list">
              <li>TypeScript في كل workspace قبل الدمج.</li>
              <li>بناء Next.js مستقل بدون أخطاء.</li>
              <li>اختبارات Playwright E2E لكل مسار.</li>
              <li>Auth: Bearer tokens + HttpOnly refresh cookie.</li>
            </ul>
          </article>

          <article className="panel">
            <div className="panel-section-header">
              <h2>الميزات الحية</h2>
            </div>
            <ul className="compact-list">
              <li>بحث السجلات والملفات مع نتائج فورية.</li>
              <li>إدارة الحقوق والمشاركة على السجلات.</li>
              <li>واجهة RTL كاملة بالعربية والإنجليزية.</li>
              <li>تشغيل الوسائط والنصوص مع الترجمات.</li>
            </ul>
          </article>
        </div>

        <div className="state-banner state-banner-success" role="status">
          <strong>النظام جاهز</strong>
          <span className="helper-text">
            قاعدة البيانات متصلة، الخدمات متاحة، واجهة الويب تعمل بكفاءة.
          </span>
        </div>
      </section>
    </main>
  );
}
