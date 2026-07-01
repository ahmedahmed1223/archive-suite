"use client";

import { useEffect, useState } from "react";
import { createArchiveApiClient, type SecuritySettings } from "@/lib/archive-api";

const categoryCards = [
  {
    title: "System",
    summary: "تجميع إعدادات البيئة العامة، اللغة، والاحتفاظ التشغيلي في وضع قراءة فقط.",
    items: ["Locale: ar", "Timezone: Europe/Istanbul", "Retention: policy driven"]
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

const roadmapItems = [
  {
    title: "المصادقة الثنائية",
    status: "مخطط",
    note: "مؤجلة حتى يكتمل ترحيل سطح المصادقة والجلسات."
  },
  {
    title: "تحديث إعدادات الأمان",
    status: "مخطط",
    note: "تحكم الكتابة في إعدادات معدل الحد والعناوين المسموحة مؤجل."
  }
];

function StatusBadge({ children }: Readonly<{ children: string }>) {
  return <span className="badge">{children}</span>;
}

const navLinks = [
  { href: "/", label: "الرئيسية" }
] as const;

export default function SettingsPage() {
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSecuritySettings = async () => {
      try {
        const client = createArchiveApiClient();
        const response = await client.getSecuritySettings();

        if (response.ok) {
          setSettings(response.settings);
        } else {
          setError(response.error || "Failed to load security settings");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch settings");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSecuritySettings();
  }, []);

  const postureRows = settings
    ? [
        { label: "Access Token TTL", value: `${settings.accessTokenTtlMinutes} minutes` },
        { label: "Rate Limit (per minute)", value: `${settings.perUserRateLimit} requests` },
        { label: "Legacy Password Upgrade", value: settings.legacyPasswordUpgrade ? "Enabled" : "Disabled" },
        { label: "Webhook Allowlist", value: settings.webhookUrlAllowlist.length > 0 ? `${settings.webhookUrlAllowlist.length} URLs` : "Empty" },
      ]
    : [];

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
            {isLoading ? (
              <p className="helper-text">جاري تحميل إعدادات الأمان...</p>
            ) : error ? (
              <p className="helper-text" style={{ color: "var(--va-color-error)" }}>خطأ: {error}</p>
            ) : (
              <>
                <div className="kv-grid" aria-label="Current security controls">
                  {postureRows.map((row) => (
                    <div className="kv-item" key={row.label}>
                      <strong>{row.label}</strong>
                      <span>{row.value}</span>
                    </div>
                  ))}
                </div>

                {settings && settings.cspPolicy && (
                  <div style={{ borderBlockStart: "1px solid var(--va-border-soft)", paddingBlockStart: "0.9rem" }}>
                    <strong>CSP Policy (Deploy-time)</strong>
                    <p className="helper-text" style={{ marginTop: "0.55rem", fontSize: "0.85em", fontFamily: "monospace" }}>
                      {settings.cspPolicy}
                    </p>
                  </div>
                )}

                {settings && settings.corsOrigins && settings.corsOrigins.length > 0 && (
                  <div style={{ borderBlockStart: "1px solid var(--va-border-soft)", paddingBlockStart: "0.9rem" }}>
                    <strong>CORS Origins (Deploy-time)</strong>
                    <ul style={{ marginTop: "0.55rem", paddingInlineStart: "1.5rem", fontSize: "0.9em" }}>
                      {settings.corsOrigins.map((origin) => (
                        <li key={origin}>{origin}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

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
