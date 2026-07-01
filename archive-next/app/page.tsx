import { getContractSummary } from "@/lib/archive-api";
import AppHeader from "@/components/AppHeader";

const apiContract = getContractSummary();

export default function HomePage() {
  return (
    <main className="shell">
      <AppHeader subtitle="لوحة التشغيل" navLabel="مسارات النظام" />

      <section className="content">
        <div className="hero">
          <span className="badge">Laravel API</span>
          <h1>لوحة تشغيل Archive Suite.</h1>
          <p>
            مساحة موحدة لإدارة الأرشيف والملفات والبحث والوسائط فوق واجهة
            Laravel API المعتمدة، مع مؤشرات سريعة لحالة العقد والمسارات
            الأساسية.
          </p>
          <div className="record-meta" aria-label="ملخص النظام">
            <span className="badge">{apiContract.title}</span>
            <span className="badge">v{apiContract.version}</span>
            <span className="badge">{apiContract.routeCount} مسار API</span>
          </div>
        </div>

        <div className="grid" aria-label="حالة النظام">
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
              <li>هذه الواجهة هي سطح العمل المعتمد لإدارة النظام.</li>
              <li>Laravel هو API المعتمد لمسارات `/api/v1/*`.</li>
              <li>التطوير الجديد يبدأ من العقود المشتركة ثم Laravel ثم الواجهة.</li>
              <li>مهام الوسائط تعرض حالة طوابير Laravel دون تكرار منطق الخادم.</li>
              <li>إدارة الأنواع وسجل الأخطاء جزءان من المسارات التشغيلية الأساسية.</li>
            </ul>
          </article>

          <article className="panel">
            <h2>بوابات القبول</h2>
            <ul>
              <li>typecheck لكل workspace قبل الدمج.</li>
              <li>بناء مستقل لواجهة الويب.</li>
              <li>اختبارات E2E لكل مسار منقول.</li>
              <li>عميل Auth يدعم Bearer + HttpOnly refresh cookie.</li>
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}
