import AppHeader from "@/components/AppHeader";

const helpPanels = [
  {
    title: "عقود API",
    items: [
      "راجع أسماء المسارات والحقول قبل ربط أي شاشة تعتمد على بيانات حقيقية.",
      "أي اختلاف بين الواجهة وLaravel يجب أن يظهر في العقد قبل أن يصل إلى المستخدم.",
      "تأكد من وضوح رسائل الخطأ عند تعذر الاتصال أو نقص الصلاحيات."
    ]
  },
  {
    title: "تشغيل الصفحات",
    items: [
      "استخدم التنقل العلوي للوصول السريع إلى السجلات والملفات والأنواع.",
      "راجع سجل الأخطاء عند ظهور عطل في الواجهة.",
      "ابدأ من صفحة الملفات عند اختبار تشغيل الوسائط أو إنشاء روابط مشاركة."
    ]
  },
  {
    title: "التطوير الآمن",
    items: [
      "حافظ على منطق المجال في Laravel واجعل الواجهة تستهلك عقوداً واضحة.",
      "اختبر مسارات الإدخال والعرض قبل اعتماد أي شاشة جديدة.",
      "اختبر الصفحات الحساسة على عرض هاتف وسطح مكتب قبل اعتمادها."
    ]
  }
] as const;

export default function HelpPage() {
  return (
    <main className="shell">
      <AppHeader subtitle="مركز المساعدة" />

      <section className="content" aria-label="مركز المساعدة">
        <div className="hero">
          <span className="badge">مساعدة التشغيل</span>
          <h1>مركز المساعدة</h1>
          <p>
            إرشادات مختصرة لاستخدام المسارات الأساسية، فحص الأعطال، وتطوير
            الصفحات الجديدة دون خلق منطق مزدوج أو واجهات متعارضة.
          </p>
        </div>

        <div className="grid" aria-label="إرشادات التشغيل">
          {helpPanels.map((panel) => (
            <article className="panel" key={panel.title}>
              <h2>{panel.title}</h2>
              <ul>
                {panel.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
