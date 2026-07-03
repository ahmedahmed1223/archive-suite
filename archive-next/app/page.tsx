import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import { BRAND } from "@/lib/brand";
import { getContractSummary } from "@/lib/archive-api";

const apiContract = getContractSummary();
const displayContractTitle = `${BRAND.latinName} API Contract`;

const kpis = [
  {
    label: "اسم العقد",
    value: displayContractTitle,
    note: "المرجع المعلن للـ API والواجهة."
  },
  {
    label: "إصدار العقد",
    value: `v${apiContract.version}`,
    note: "يجب أن يبقى متوافقاً مع المستهلكين."
  },
  {
    label: "مسارات API",
    value: String(apiContract.routeCount),
    note: "عدد المسارات المعروفة في OpenAPI."
  },
  {
    label: "وضع الصفحة",
    value: "Static RTL",
    note: "لا تعتمد على backend إضافي."
  }
] as const;

const attentionItems = [
  {
    title: "العقد هو الحقيقة المرجعية",
    body: "أي تغيير في المسارات أو الأشكال يعود أولاً إلى `archive-core` ثم إلى المستهلكين."
  },
  {
    title: "أغلق باب الانحراف",
    body: "لا تضف مؤشرات تشغيلية وهمية؛ اعرض فقط ما يخرج من `getContractSummary()` وما هو ثابت في الواجهة."
  },
  {
    title: "بوابة الإطلاق",
    body: "قبل الدمج، شغّل `pnpm run typecheck:next` ثم `pnpm run build:next` وتأكد من بقاء RTL والكثافة كما هي."
  }
] as const;

const shortcuts = [
  { label: "الأرشيف", href: "/archive" },
  { label: "إضافة للأرشيف", href: "/uploads" },
  { label: "البحث", href: "/search" },
  { label: "الملفات", href: "/files" },
  { label: "الوسائط", href: "/media/review" },
  { label: "الحالة", href: "/status" },
  { label: "الإعدادات", href: "/settings" }
] as const;

const qualityChecks = [
  "Next.js App Router مع TypeScript على المسار الكانوني.",
  "Laravel API خلف `api/v1` كمصدر بيانات مرجعي.",
  "واجهة RTL عربية مع تباين واضح وكثافة تشغيلية.",
  "اختبارات التحقق تعتمد على typecheck وbuild قبل أي نشر."
] as const;

function StatCard({
  label,
  value,
  note
}: Readonly<{
  label: string;
  value: string;
  note: string;
}>) {
  return (
    <article className="panel">
      <div className="panel-section-header">
        <h3>{label}</h3>
      </div>
      <strong className="metric-value">
        {value}
      </strong>
      <p>{note}</p>
    </article>
  );
}

export default function HomePage() {
  return (
    <AppShell subtitle="لوحة التشغيل" navLabel="مسارات Masar">
      <PageToolbar
        eyebrow={<span className="badge">Masar Operations</span>}
        title={`لوحة ${BRAND.arabicName} التشغيلية`}
        description="ملخص ثابت لحالة المنصة، مع مؤشرات العقد المرجعي، اختصارات العمل، ونقاط الانتباه التشغيلية."
        meta={(
          <>
            <span className="badge">{displayContractTitle}</span>
            <span className="badge">v{apiContract.version}</span>
            <span className="badge">{apiContract.routeCount} مسار API</span>
          </>
        )}
        actions={(
          <>
            <a className="button button-primary" href="/uploads">
              إضافة للأرشيف
            </a>
            <a className="button button-primary" href="/archive">
              فتح الأرشيف
            </a>
            <a className="button button-secondary" href="/status">
              مراجعة الحالة
            </a>
          </>
        )}
      >
        <div className="record-meta" aria-label="ملخص الإطلاق">
          <span className="badge">{BRAND.descriptor}</span>
          <span className="badge">RTL</span>
          <span className="badge">Next.js + Laravel</span>
        </div>
      </PageToolbar>

      <section className="page-section" aria-labelledby="kpis-heading">
        <div className="toolbar-row toolbar-start">
          <h2 id="kpis-heading" className="section-heading">
            مؤشرات التشغيل
          </h2>
          <span className="badge">مرتبطة بالعقد الحالي</span>
        </div>
        <div className="dense-grid">
          {kpis.map((item) => (
            <StatCard key={item.label} {...item} />
          ))}
        </div>
      </section>

      <section className="page-section" aria-labelledby="attention-heading">
        <div className="toolbar-row toolbar-start">
          <h2 id="attention-heading" className="section-heading">
            يحتاج انتباه
          </h2>
          <span className="badge badge-danger">مراجعة تشغيلية</span>
        </div>
        <article className="panel">
          <div className="panel-section-header">
            <h3>نقاط مراقبة</h3>
          </div>
          <ul className="compact-list">
            {attentionItems.map((item) => (
              <li key={item.title}>
                <strong>{item.title}:</strong> {item.body}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="page-section" aria-labelledby="shortcuts-heading">
        <div className="toolbar-row toolbar-start">
          <h2 id="shortcuts-heading" className="section-heading">
            اختصارات تشغيل
          </h2>
          <span className="badge">وصول مباشر</span>
        </div>
        <article className="panel">
          <div className="panel-section-header">
            <h3>مسارات العمل</h3>
          </div>
          <div className="button-row">
            {shortcuts.map((item) => (
              <a key={item.href} className="button button-secondary" href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
          <p>الروابط أعلاه تغطي المسارات اليومية التي يحتاجها فريق التشغيل بدون طبقات إضافية.</p>
        </article>
      </section>

      <section className="page-section" aria-labelledby="quality-heading">
        <div className="toolbar-row toolbar-start">
          <h2 id="quality-heading" className="section-heading">
            جودة النظام
          </h2>
          <span className="badge">بوابات مستقرة</span>
        </div>
        <article className="panel">
          <div className="panel-section-header">
            <h3>ضوابط التحقق</h3>
          </div>
          <ul className="compact-list">
            {qualityChecks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="record-meta">
            <span className="badge">typecheck:next</span>
            <span className="badge">build:next</span>
            <span className="badge">verify</span>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
