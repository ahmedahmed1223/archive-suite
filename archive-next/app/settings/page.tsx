"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { BRAND } from "@/lib/brand";
import {
  createArchiveApiClient,
  type OdbcProbe,
  type OdbcTablePreview,
  type SecuritySettings
} from "@/lib/archive-api";

const categoryCards = [
  {
    title: "النظام",
    summary: "تجميع إعدادات البيئة العامة، اللغة، والاحتفاظ التشغيلي في وضع قراءة فقط.",
    items: ["اللغة: العربية", "المنطقة الزمنية: Europe/Istanbul", "الاحتفاظ: وفق السياسة"]
  },
  {
    title: "التخزين",
    summary: "مؤشرات التخزين تشرح مكان البيانات وحدودها من دون أدوات تحرير.",
    items: ["المخزن الرئيسي: Object storage", "النسخ الاحتياطي: مجدول", "الحصة: تحت المراقبة"]
  },
  {
    title: "واجهة API",
    summary: "ملخص طبقة التكامل مع العقد والقيود والاعتمادية التي تعتمد عليها الواجهة.",
    items: ["الإصدار: v1", "المصادقة: رمز قصير + تحديث آمن", "حدود الطلب: مفعلة"]
  },
  {
    title: "المظهر",
    summary: "هوية العرض والنسق المرئي الحاليان موثقان هنا للرجوع السريع.",
    items: ["النسق: فاتح", "الكثافة: مدمجة", `الهوية: ${BRAND.lockupName}`]
  }
];

const roadmapItems = [
  {
    title: "المصادقة الثنائية",
    status: "مخطط",
    note: "مؤجلة حتى يكتمل سطح المصادقة والجلسات."
  },
  {
    title: "تحديث إعدادات الأمان",
    status: "مخطط",
    note: "تحكم الكتابة في إعدادات معدل الحد والعناوين المسموحة مؤجل."
  }
];

const odbcCoreTables = ["items", "users", "settings", "audit"] as const;

type OdbcCoreTable = (typeof odbcCoreTables)[number];

const odbcTableLabels: Record<OdbcCoreTable, string> = {
  items: "Items",
  users: "Users",
  settings: "Settings",
  audit: "Audit"
};

function StatusBadge({ children }: Readonly<{ children: string }>) {
  return <span className="badge">{children}</span>;
}

function odbcStatusLabel(status: OdbcProbe["status"]) {
  const labels: Record<OdbcProbe["status"], string> = {
    connected: "متصل",
    disabled: "معطل",
    "missing-dsn": "DSN مفقود",
    "driver-unavailable": "Driver غير متاح",
    failed: "فشل الاتصال"
  };

  return labels[status];
}

function formatPreviewValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "غير متاح";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [odbc, setOdbc] = useState<OdbcProbe | null>(null);
  const [isOdbcLoading, setIsOdbcLoading] = useState(true);
  const [odbcError, setOdbcError] = useState<string | null>(null);
  const [selectedOdbcTable, setSelectedOdbcTable] = useState<OdbcCoreTable>("items");
  const [odbcPreview, setOdbcPreview] = useState<OdbcTablePreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

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

  useEffect(() => {
    const fetchOdbcStatus = async () => {
      try {
        const client = createArchiveApiClient();
        const response = await client.odbcStatus();

        if (response.ok) {
          setOdbc(response.odbc);
        } else {
          setOdbcError(response.error || "Failed to load ODBC status");
        }
      } catch (err) {
        setOdbcError(err instanceof Error ? err.message : "Failed to fetch ODBC status");
      } finally {
        setIsOdbcLoading(false);
      }
    };

    fetchOdbcStatus();
  }, []);

  const loadOdbcPreview = async (table: OdbcCoreTable = selectedOdbcTable) => {
    setIsPreviewLoading(true);
    setPreviewError(null);

    try {
      const client = createArchiveApiClient();
      const response = await client.odbcTable(table, { limit: 10 });

      if (response.ok) {
        setOdbcPreview(response);
      } else {
        setOdbcPreview(null);
        setPreviewError(response.error || "Failed to load ODBC table preview");
      }
    } catch (err) {
      setOdbcPreview(null);
      setPreviewError(err instanceof Error ? err.message : "Failed to fetch ODBC table preview");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const postureRows = settings
    ? [
        { label: "مدة رمز الوصول", value: `${settings.accessTokenTtlMinutes} دقيقة` },
        { label: "حد الطلبات لكل دقيقة", value: `${settings.perUserRateLimit} طلب` },
        { label: "ترقية كلمات المرور القديمة", value: settings.legacyPasswordUpgrade ? "مفعلة" : "معطلة" },
        { label: "قائمة Webhook المسموحة", value: settings.webhookUrlAllowlist.length > 0 ? `${settings.webhookUrlAllowlist.length} رابط` : "فارغة" },
      ]
    : [];
  const odbcRows = odbc
    ? [
        { label: "الحالة", value: odbcStatusLabel(odbc.status) },
        { label: "مشغّل ODBC", value: odbc.driverLoaded ? "متاح" : "غير متاح" },
        { label: "DSN", value: odbc.dsn || "غير مضبوط" },
        { label: "الجداول المرئية", value: `${odbc.tables.length}` }
      ]
    : [];
  const previewColumns = odbcPreview
    ? Array.from(new Set(odbcPreview.rows.flatMap((row) => Object.keys(row)))).slice(0, 8)
    : [];
  const canPreviewOdbc = odbc?.status === "connected";

  return (
    <main className="shell">
      <AppHeader subtitle="مركز الإعدادات" />

      <section className="content" aria-label={`إعدادات ${BRAND.arabicName}`}>
        <div className="hero">
          <h1>إعدادات {BRAND.arabicName} للقراءة فقط.</h1>
          <p>
            هذه اللوحة تجمع مجالات النظام والأمان والتخزين وAPI والمظهر في
            صفحة واحدة سريعة المسح، مع إبراز ما هو مطبق فعلاً وما ينتظر
            صلاحيات تحرير أو ربطاً إضافياً.
          </p>
          <div className="hero-actions">
            <span className="badge">لوحة مرجعية</span>
            <span className="badge">قراءة فقط</span>
          </div>
        </div>

        <article className="panel identity-panel" aria-label="هوية النظام">
          <div className="identity-lockup">
            <img src={BRAND.lockupPath} alt={BRAND.lockupName} width={360} height={96} />
            <div>
              <h2>هوية النظام</h2>
              <p>{BRAND.descriptor} باسم عربي أساسي واسم لاتيني داعم للاستخدامات التقنية.</p>
            </div>
            <div className="record-meta">
              <span className="badge">{BRAND.arabicName}</span>
              <span className="badge">{BRAND.latinName}</span>
              <span className="badge">v{BRAND.version}</span>
            </div>
          </div>
          <div className="identity-mark-preview" aria-hidden="true">
            <img src={BRAND.markPath} alt="" width={60} height={60} />
          </div>
        </article>

        <div className="dense-grid" aria-label="فئات الإعدادات">
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
              <p className="helper-text status-error">خطأ: {error}</p>
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
                  <div className="section-divider">
                    <strong>CSP Policy (Deploy-time)</strong>
                    <p className="helper-text mt-tight mono-text">
                      {settings.cspPolicy}
                    </p>
                  </div>
                )}

                {settings && settings.corsOrigins && settings.corsOrigins.length > 0 && (
                  <div className="section-divider">
                    <strong>CORS Origins (Deploy-time)</strong>
                    <ul className="compact-list mt-tight">
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
                <div key={item.title} className="section-divider">
                  <div className="helper-row">
                    <strong>{item.title}</strong>
                    <StatusBadge>{item.status}</StatusBadge>
                  </div>
                  <p className="helper-text mt-tight">
                    {item.note}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="panel" aria-label="ODBC bridge">
          <div className="panel-title-row">
            <div>
              <h2>ODBC للأنظمة القديمة</h2>
              <p>فحص الاتصال ومعاينة قراءة محدودة للجداول الأساسية المسموحة فقط.</p>
            </div>
            {odbc && <StatusBadge>{odbcStatusLabel(odbc.status)}</StatusBadge>}
          </div>

          <div className="stack">
            {isOdbcLoading ? (
              <p className="helper-text">جاري فحص ODBC...</p>
            ) : odbcError ? (
              <p className="helper-text status-error">خطأ: {odbcError}</p>
            ) : odbc ? (
              <>
                <div className="kv-grid" aria-label="ODBC connection posture">
                  {odbcRows.map((row) => (
                    <div className="kv-item" key={row.label}>
                      <strong>{row.label}</strong>
                      <span>{row.value}</span>
                    </div>
                  ))}
                </div>

                {(odbc.message || odbc.error) && (
                  <div className={`state-banner ${odbc.status === "connected" ? "state-banner-success" : "state-banner-error"}`}>
                    <strong>{odbc.status === "connected" ? "الاتصال جاهز" : "يتطلب إعدادا"}</strong>
                    <p className="helper-text">{odbc.error || odbc.message}</p>
                  </div>
                )}

                <div className="field-row" aria-label="ODBC table preview controls">
                  <label>
                    <span className="field-note">الجدول الأساسي</span>
                    <select
                      className="search-input"
                      value={selectedOdbcTable}
                      onChange={(event) => {
                        const table = event.target.value as OdbcCoreTable;
                        setSelectedOdbcTable(table);
                        if (canPreviewOdbc) {
                          void loadOdbcPreview(table);
                        }
                      }}
                    >
                      {odbcCoreTables.map((table) => (
                        <option key={table} value={table}>
                          {odbcTableLabels[table]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="button button-primary"
                    type="button"
                    disabled={!canPreviewOdbc || isPreviewLoading}
                    onClick={() => void loadOdbcPreview()}
                  >
                    {isPreviewLoading ? "جاري القراءة" : "معاينة"}
                  </button>
                </div>

                {!canPreviewOdbc && (
                  <p className="helper-text">
                    المعاينة تعمل بعد تفعيل ODBC وضبط DSN وتحميل driver في بيئة Laravel.
                  </p>
                )}

                {previewError && (
                  <p className="helper-text status-error">خطأ: {previewError}</p>
                )}

                {odbcPreview && (
                  <div className="stack section-divider">
                    <div className="helper-row">
                      <strong>{odbcTableLabels[odbcPreview.table as OdbcCoreTable] || odbcPreview.table}</strong>
                      <StatusBadge>{`${odbcPreview.count} صف`}</StatusBadge>
                    </div>

                    {odbcPreview.rows.length === 0 ? (
                      <div className="empty-state">لا توجد صفوف ضمن حد المعاينة الحالي.</div>
                    ) : (
                      <div className="scroll-x">
                        <table className="data-table">
                          <thead>
                            <tr>
                              {previewColumns.map((column) => (
                                <th key={column} scope="col">
                                  {column}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {odbcPreview.rows.map((row, rowIndex) => (
                              <tr key={`${odbcPreview.table}-${rowIndex}`}>
                                {previewColumns.map((column) => (
                                  <td key={column}>
                                    {formatPreviewValue(row[column])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </article>
      </section>
    </main>
  );
}
