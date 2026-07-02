import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import { getContractSummary } from "@/lib/archive-api";
import { BRAND } from "@/lib/brand";

const contract = getContractSummary();

const reportChecks = [
  {
    title: "عقد التقارير",
    status: "جاهز",
    body: `يعتمد المسار على عقد ${BRAND.latinName} API v${contract.version} قبل نقل أي تقرير تشغيلي حقيقي.`
  },
  {
    title: "مصدر الحقيقة",
    status: "Laravel",
    body: "تبقى الحسابات الثقيلة والتجميعات طويلة المدى في Laravel، وتعرض Next النتائج فقط لتجنب ازدواجية المنطق."
  },
  {
    title: "بوابة القبول",
    status: "إلزامية",
    body: "كل تقرير ينتقل لاحقا يحتاج typecheck، build مستقل، وفحص Playwright يغطي سطح العرض الأساسي."
  }
];

const plannedReports = [
  "حجم الأرشيف حسب المخزن والنوع",
  "سجل المعالجة الإعلامية والفشل",
  "ملخص الحقوق وانتهاء التراخيص",
  "نشاط المستخدمين والتعديلات"
];

export default function ReportsPage() {
  return (
    <AppShell subtitle="التقارير" navLabel="التقارير" contentClassName="observability-content">
      <PageToolbar
        eyebrow={<span className="badge">تقارير تشغيلية</span>}
        title="لوحة التقارير"
        description="نقطة دخول لمراجعة جاهزية التقارير والعقود قبل فتح تقارير تشغيلية مفصلة على بيانات Laravel."
        meta={
          <>
            <span className="badge">API v{contract.version}</span>
            <span className="badge">{contract.routeCount} مسار موثق</span>
            <span className="badge">قيد التطوير</span>
          </>
        }
        actions={
          <a className="button button-secondary" href="/analytics">
            التحليلات الحالية
          </a>
        }
      />

      <div className="report-readiness-grid">
        {reportChecks.map((item) => (
          <article className="panel report-check-card" key={item.title}>
            <div className="panel-title-row">
              <h2>{item.title}</h2>
              <span className="badge">{item.status}</span>
            </div>
            <p>{item.body}</p>
          </article>
        ))}
      </div>

      <section className="panel">
        <div className="panel-title-row">
          <div>
            <h2>التقارير المخططة</h2>
            <p>هذه القائمة تحفظ تكافؤ المزايا المطلوبة قبل تحويل كل تقرير إلى صفحة بيانات كاملة.</p>
          </div>
          <span className="badge">{plannedReports.length} مسارات</span>
        </div>
        <div className="report-roadmap">
          {plannedReports.map((report, index) => (
            <div className="report-roadmap__item" key={report}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{report}</strong>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
