import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";

const gettingStartedChecklist = [
  "افتح /first-run واختر مسار التهيئة السريع أو المتقدم حسب بيئتك.",
  "نفذ setup doctor ثم setup quick أو setup deploy من Control Center قبل الدخول الأول.",
  "سجّل الدخول عبر /login وتحقق من ظهور بياناتك في أعلى الشريط العلوي.",
  "ابحث عن سجل حقيقي من /search للتأكد من اتصال عقد البحث بالخادم.",
  "افتح /files وجرّب معاينة ملف أو تشغيل وسائط للتأكد من صحة الروابط.",
  "راجع /status للتأكد من استقرار الاتصال بالخادم ومحرك البيانات.",
  "اضبط تفضيلاتك من /settings قبل بدء العمل اليومي."
] as const;

const featureHighlights = [
  {
    title: "البحث والسجلات",
    description: "بحث موحد عبر /search مع فلاتر وحفظ نتائج، وتفاصيل كل سجل من صفحته المخصصة.",
    href: "/search",
    linkLabel: "افتح البحث"
  },
  {
    title: "الملفات والوسائط",
    description: "استعراض الملفات، تشغيل الوسائط، ومتابعة مهام المعالجة من /media/jobs.",
    href: "/files",
    linkLabel: "افتح الملفات"
  },
  {
    title: "المشاركة والحقوق",
    description: "إنشاء روابط مشاركة محكومة الصلاحية ومراجعة حقوق الاستخدام لكل عنصر.",
    href: "/shares",
    linkLabel: "افتح المشاركات"
  },
  {
    title: "المراقبة التشغيلية",
    description: "حالة الخادم، سجل الأخطاء، والتحليلات في مكان واحد لمتابعة صحة النظام.",
    href: "/status",
    linkLabel: "افتح حالة النظام"
  }
] as const;

const supportLinks = [
  {
    title: "جولة أول تشغيل",
    description: "مسار سريع أو متقدم لتجهيز النظام وفحص الصحة قبل العمل.",
    href: "/first-run"
  },
  {
    title: "Control Center",
    description: "واجهة النظام للإجراءات الحساسة بعد تفعيلها من الخادم.",
    href: "/system/control"
  },
  {
    title: "حالة API",
    description: "فحص صحة الخادم ومحرك البيانات قبل استكشاف الأعطال.",
    href: "/status"
  },
  {
    title: "سجل الأخطاء",
    description: "راجع الأعطال المسجلة قبل التواصل مع فريق الدعم.",
    href: "/errors"
  }
] as const;

export default function HelpPage() {
  return (
    <AppShell subtitle="مركز المساعدة" navLabel="المساعدة" contentClassName="help-content">
      <PageToolbar
        eyebrow={<span className="badge">مرجع تشغيلي</span>}
        title="مركز المساعدة"
        description="نقطة انطلاق سريعة لأول استخدام، ومرجع دائم لمسارات النظام وروابط التوثيق دون حشو تسويقي."
        meta={
          <>
            <span className="badge">{gettingStartedChecklist.length} خطوات بدء</span>
            <span className="badge">{featureHighlights.length} مسارات رئيسية</span>
          </>
        }
        actions={(
          <a className="button button-primary" href="/first-run">فتح جولة أول تشغيل</a>
        )}
      />

      <article className="panel" aria-label="قائمة البدء السريع">
        <div className="panel-section-header">
          <h2>قائمة البدء السريع</h2>
          <p>خطوات مقترحة للتحقق من جاهزية حسابك، يمكن تجاهلها لاحقا.</p>
        </div>
        <ul className="checklist">
          {gettingStartedChecklist.map((item) => (
            <li className="checklist-item" key={item}>
              <label className="checklist-control">
                <input type="checkbox" aria-label={item} />
                <span>{item}</span>
              </label>
            </li>
          ))}
        </ul>
      </article>

      <div className="dense-grid" aria-label="أبرز الميزات">
        {featureHighlights.map((feature) => (
          <article className="panel" key={feature.title}>
            <div className="panel-section-header">
              <h2>{feature.title}</h2>
            </div>
            <p>{feature.description}</p>
            <div className="button-row">
              <a className="button button-secondary" href={feature.href}>
                {feature.linkLabel}
              </a>
            </div>
          </article>
        ))}
      </div>

      <article className="panel" aria-label="التوثيق والدعم">
        <div className="panel-section-header">
          <h2>التوثيق والدعم</h2>
          <p>مراجع أساسية عند الحاجة لتفاصيل أعمق أو استكشاف أعطال.</p>
        </div>
        <ul>
          {supportLinks.map((link) => (
            <li key={link.title}>
              <a className="text-accent" href={link.href}>
                {link.title}
              </a>
              <span className="helper-text"> - {link.description}</span>
            </li>
          ))}
        </ul>
      </article>
    </AppShell>
  );
}
