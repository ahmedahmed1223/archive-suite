const helpPanels = [
  {
    title: "عقود API",
    items: [
      "راجع أسماء المسارات والحقول قبل نقل أي شاشة تعتمد على بيانات حقيقية.",
      "أي اختلاف بين Next.js وLaravel يجب أن يظهر في العقد قبل أن يصل إلى الواجهة.",
      "اجعل كل رد قابلا للفحص من TypeScript قبل تشغيل تجربة المستخدم."
    ]
  },
  {
    title: "فحوصات المسارات",
    items: [
      "افتح /help مباشرة وتأكد أن الصفحة ترجع 200 من App Router.",
      "جرّب الرجوع إلى / ثم /login للتأكد أن روابط القشرة ما زالت تعمل.",
      "سجل نتيجة الفحص مع اسم المسار قبل إضافة أي منطق عميل."
    ]
  },
  {
    title: "الرجوع إلى Vite",
    items: [
      "يبقى تطبيق Vite هو المسار التشغيلي إذا ظهر كسر في Next.js.",
      "لا تنقل الشاشات الثقيلة قبل توفر فحص smoke واضح وبوابة typecheck.",
      "عند الشك، أوقف تحويل المرور وأبق المستخدمين على النسخة المستقرة."
    ]
  }
] as const;

export default function HelpPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>Archive Suite</strong>
          <span>Next.js help migration</span>
        </div>
        <a className="badge" href="/">
          حالة الترحيل
        </a>
      </header>

      <section className="content" aria-label="مركز مساعدة Next.js">
        <div className="hero">
          <span className="badge">مسار منخفض المخاطر</span>
          <h1>مركز مساعدة Next.js</h1>
          <p>
            هذه صفحة مساعدة عملية تم نقلها إلى Next.js لأنها منخفضة المخاطر:
            نص ثابت، بلا حالة عميل، وبلا اعتماد على بيانات حساسة. الهدف منها أن
            تكون نقطة فحص واضحة أثناء ترحيل المسارات من Vite إلى App Router.
          </p>
        </div>

        <div className="grid" aria-label="إرشادات الترحيل">
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
