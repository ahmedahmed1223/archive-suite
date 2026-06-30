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

const navLinks = [
  { href: "/", label: "الرئيسية" },
  { href: "/archive", label: "السجلات" },
  { href: "/files", label: "الملفات" },
  { href: "/reports", label: "التقارير" },
  { href: "/media/jobs", label: "Media jobs" },
  { href: "/login", label: "تسجيل الدخول" }
] as const;

export default function HelpPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>Archive Suite</strong>
          <span>Next.js help migration</span>
        </div>
        <nav className="route-links" aria-label="مسارات سريعة">
          {navLinks.map((link) => (
            <a key={link.href} className="badge" href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
      </header>

      <section className="content" aria-label="مركز مساعدة Next.js">
        <div className="hero">
          <span className="badge">مسار منخفض المخاطر</span>
          <h1>مركز مساعدة Next.js</h1>
          <p>
            هذه الصفحة عملية وثابتة ومناسبة للترحيل المبكر: لا تعتمد على حالة
            عميل، وتبقي نقاط الفحص والتشغيل واضحة أثناء نقل المسارات من Vite
            إلى App Router.
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
