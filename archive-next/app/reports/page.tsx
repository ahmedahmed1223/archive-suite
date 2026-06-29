import { getContractSummary } from "@/lib/archive-api";

const contract = getContractSummary();

const reportChecks = [
  {
    title: "عقد التقارير",
    body: `يعتمد المسار على ${contract.title} v${contract.version} قبل نقل أي تقرير تشغيلي حقيقي.`
  },
  {
    title: "تدرج آمن",
    body: "تبقى تقارير Vite الحالية هي المصدر العملي، بينما يثبت هذا المسار هيكل Next.js وRTL والروابط."
  },
  {
    title: "بوابة القبول",
    body: "كل تقرير ينتقل لاحقا يحتاج typecheck، build مستقل، وفحص Playwright يغطي سطح العرض الأساسي."
  }
];

export default function ReportsPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>Archive Suite</strong>
          <span>Next.js reports migration</span>
        </div>
        <a className="badge" href="/">حالة الترحيل</a>
      </header>

      <section className="content" aria-label="تقارير Next.js">
        <div className="hero">
          <span className="badge">مسار منخفض المخاطر</span>
          <h1>تقارير Next.js التجريبية.</h1>
          <p>
            هذه الصفحة تجهز نقل التقارير العامة والمراجعات الخفيفة إلى App Router
            قبل الاقتراب من الشاشات التشغيلية الثقيلة.
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
