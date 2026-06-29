const settingsReadiness = [
  {
    title: "جلسات Laravel",
    body: "إعدادات الحساب ستعتمد على access token قصير العمر وrefresh cookie HttpOnly الموجودين في عميل Next.js."
  },
  {
    title: "الإعدادات التشغيلية",
    body: "إعدادات التخزين وقاعدة البيانات تبقى في Vite حتى تثبت مسارات Laravel المحمية وسياسات الصلاحيات."
  },
  {
    title: "تجربة المستخدم",
    body: "كل تبويب سينتقل كصفحة مستقلة أو client component صغير عندما تتضح حاجته للحالة المحلية."
  }
];

export default function SettingsPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>Archive Suite</strong>
          <span>Next.js settings migration</span>
        </div>
        <a className="badge" href="/">حالة الترحيل</a>
      </header>

      <section className="content" aria-label="إعدادات Next.js">
        <div className="hero">
          <span className="badge">Settings overview</span>
          <h1>إعدادات Next.js المبدئية.</h1>
          <p>
            هذا المسار يثبت صفحة إعدادات خفيفة في Next.js قبل نقل النماذج
            الإدارية الحساسة أو إعدادات التخزين التي تحتاج صلاحيات كاملة.
          </p>
        </div>

        <div className="grid">
          {settingsReadiness.map((item) => (
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
