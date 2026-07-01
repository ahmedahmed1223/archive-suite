const categoryCards = [
  {
    title: "System",
    summary: "تجميع إعدادات البيئة العامة، اللغة، والاحتفاظ التشغيلي في وضع قراءة فقط.",
    items: ["Locale: ar", "Timezone: Europe/Istanbul", "Retention: policy driven"]
  },
  {
    title: "Security",
    summary: "سياسة الوصول مقفلة داخل هذه الواجهة مع إظهار ما هو مطبق وما هو مؤجل.",
    items: ["Password required", "Session timeout: 30m", "Failed attempts: 5"]
  },
  {
    title: "Storage",
    summary: "مؤشرات التخزين تشرح مكان البيانات وحدودها من دون أدوات تحرير.",
    items: ["Primary store: object storage", "Backups: scheduled", "Quota: monitored"]
  },
  {
    title: "API",
    summary: "ملخص طبقة التكامل مع العقد والقيود والاعتمادية التي تعتمد عليها الواجهة.",
    items: ["Version: v1", "Auth: bearer + refresh cookie", "Rate limits: enforced"]
  },
  {
    title: "Appearance",
    summary: "هوية العرض والنسق المرئي الحاليان موثقان هنا للرجوع السريع.",
    items: ["Theme: light", "Density: compact", "Branding: Archive Suite"]
  }
];

const postureRows = [
  { label: "كلمة المرور", value: "مطلوبة" },
  { label: "مهلة الجلسة", value: "30 دقيقة" },
  { label: "محاولات فاشلة", value: "5 قبل القفل" }
];

const roadmapItems = [
  {
    title: "المصادقة الثنائية",
    status: "مخطط",
    note: "مؤجلة حتى يكتمل ترحيل سطح المصادقة والجلسات."
  },
  {
    title: "Webhook allowlist",
    status: "مخطط",
    note: "مؤجلة إلى أن تتوحد سياسة بوابة API وقوائم السماح."
  }
];

function StatusBadge({ children }: Readonly<{ children: string }>) {
  return <span className="badge">{children}</span>;
}

const navLinks = [
  { href: "/", label: "الرئيسية" }
] as const;

export default function SettingsPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>Archive Suite</strong>
          <span>Settings hub</span>
        </div>
        <nav className="route-links" aria-label="مسارات سريعة">
          {navLinks.map((link) => (
            <a key={link.href} className="badge" href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
      </header>

      <section className="content" aria-label="إعدادات Archive Suite">
        <div className="hero">
          <h1>إعدادات Archive Suite للقراءة فقط.</h1>
          <p>
            هذه اللوحة تجمع مجالات النظام والأمان والتخزين وAPI والمظهر في
            صفحة واحدة سريعة المسح، مع إبراز ما هو مطبق فعلاً وما هو مؤجل
            للمرحلة التالية من الترحيل.
          </p>
          <div className="hero-actions">
            <span className="badge">لوحة مرجعية</span>
            <span className="badge">Read only</span>
          </div>
        </div>

        <div className="grid" aria-label="فئات الإعدادات" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {categoryCards.map((card) => (
            <article className="panel panel-compact" key={card.title}>
              <h2>{card.title}</h2>
              <p>{card.summary}</p>
              <ul>
                {card.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <article className="panel" aria-label="وضع الأمان">
          <div className="panel-title-row">
            <div>
              <h2>وضع الأمان</h2>
              <p>ملخص للقراءة فقط يوضح سياسة الوصول الحالية والعمل الأمني المؤجل لإصدارات لاحقة.</p>
            </div>
          </div>

          <div className="stack">
            <div className="kv-grid" aria-label="Current security controls">
              {postureRows.map((row) => (
                <div className="kv-item" key={row.label}>
                  <strong>{row.label}</strong>
                  <span>{row.value}</span>
                </div>
              ))}
            </div>

            <div className="stack">
              {roadmapItems.map((item) => (
                <div key={item.title} style={{ borderBlockStart: "1px solid var(--va-border-soft)", paddingBlockStart: "0.9rem" }}>
                  <div className="helper-row">
                    <strong>{item.title}</strong>
                    <StatusBadge>{item.status}</StatusBadge>
                  </div>
                  <p className="helper-text" style={{ marginTop: "0.55rem" }}>
                    {item.note}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
