import { getContractSummary } from "@/lib/archive-api";
import AppHeader from "@/components/AppHeader";

const contract = getContractSummary();

const reportChecks = [
  {
    title: "عقد التقارير",
    body: `يعتمد المسار على ${contract.title} v${contract.version} قبل نقل أي تقرير تشغيلي حقيقي.`
  },
  {
    title: "جاهزية العرض",
    body: "يعرض هذا السطح مؤشرات التقارير الأساسية ويترك البيانات الثقيلة لعقود Laravel حتى لا يتضاعف منطق الحساب داخل الواجهة."
  },
  {
    title: "بوابة القبول",
    body: "كل تقرير ينتقل لاحقا يحتاج typecheck، build مستقل، وفحص Playwright يغطي سطح العرض الأساسي."
  }
];

export default function ReportsPage() {
  return (
    <main className="shell">
      <AppHeader subtitle="التقارير" />

      <section className="content" aria-label="التقارير">
        <div className="hero">
          <span className="badge">تقارير تشغيلية</span>
          <h1>لوحة التقارير</h1>
          <p>
            نقطة دخول هادئة لمراجعة حالة العقود، جاهزية التقارير، وبوابات
            القبول قبل فتح التقارير التفصيلية.
          </p>
        </div>

        <div className="grid">
          {reportChecks.map((item) => (
            <article className="panel" key={item.title}>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
