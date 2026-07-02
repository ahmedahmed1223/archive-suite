"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import { BRAND } from "@/lib/brand";
import {
  createArchiveApiClient,
  type OdbcProbe,
  type OdbcTablePreview,
  type OdbcWriteOperation,
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

type OdbcWriteState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const odbcTableLabels: Record<OdbcCoreTable, string> = {
  items: "Items",
  users: "Users",
  settings: "Settings",
  audit: "Audit"
};

const getDefaultOdbcKeyColumn = (table: OdbcCoreTable) => (table === "settings" ? "key" : "id");

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
  const [odbcWriteOperation, setOdbcWriteOperation] = useState<OdbcWriteOperation>("insert");
  const [odbcKeyColumn, setOdbcKeyColumn] = useState("id");
  const [odbcKeyValue, setOdbcKeyValue] = useState("");
  const [odbcValuesText, setOdbcValuesText] = useState('{\n  "name": "New item"\n}');
  const [odbcWriteState, setOdbcWriteState] = useState<OdbcWriteState>({ status: "idle" });

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

  const handleOdbcWrite = async () => {
    if (!canPreviewOdbc) return;

    setOdbcWriteState({ status: "saving" });

    try {
      const client = createArchiveApiClient();
      const keyValue = odbcKeyValue.trim();
      let response;

      if (odbcWriteOperation === "delete") {
        response = await client.odbcDeleteRow(selectedOdbcTable, {
          keyColumn: odbcKeyColumn.trim(),
          keyValue
        });
      } else {
        const parsedValues = JSON.parse(odbcValuesText) as unknown;
        if (!parsedValues || typeof parsedValues !== "object" || Array.isArray(parsedValues)) {
          setOdbcWriteState({ status: "error", message: "اكتب القيم كـ JSON object صالح." });
          return;
        }

        const values = parsedValues as Record<string, unknown>;
        response = odbcWriteOperation === "insert"
          ? await client.odbcCreateRow(selectedOdbcTable, { values })
          : await client.odbcUpdateRow(selectedOdbcTable, {
              keyColumn: odbcKeyColumn.trim(),
              keyValue,
              values
            });
      }

      if (!response.ok) {
        setOdbcWriteState({ status: "error", message: response.error });
        return;
      }

      setOdbcWriteState({
        status: "success",
        message: `تم تنفيذ ${response.operation} على ${response.affected} صف.`
      });
      await loadOdbcPreview(selectedOdbcTable);
    } catch (err) {
      setOdbcWriteState({
        status: "error",
        message: err instanceof Error ? err.message : "تعذر تنفيذ عملية ODBC."
      });
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
    <AppShell subtitle="مركز الإعدادات" contentClassName="settings-content">
      <PageToolbar
        eyebrow={<span className="badge">Settings Hub</span>}
        title={`إعدادات ${BRAND.arabicName}`}
        description="مركز واحد للهوية، الأمان، التخزين، ODBC، API، والمظهر، مع تمييز ما هو مطبق فعلاً وما ينتظر صلاحيات تحرير أو backend إضافي."
        meta={(
          <>
            <span className="badge">هوية النظام</span>
            <span className="badge">أمان</span>
            <span className="badge">ODBC</span>
            <span className="badge">مراقبة</span>
          </>
        )}
        actions={(
          <>
            <a className="button button-secondary" href="/status">حالة النظام</a>
            <a className="button button-secondary" href="/errors">سجل الأخطاء</a>
          </>
        )}
      />

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
          <div className="panel-section-header">
            <h2>وضع الأمان</h2>
            <p>ملخص للقراءة فقط يوضح سياسة الوصول الحالية والعمل الأمني المؤجل لإصدارات لاحقة.</p>
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
          <div className="panel-section-header">
            <div>
              <h2>ODBC للأنظمة القديمة</h2>
              <p>فحص الاتصال، معاينة قراءة محدودة، وكتابة صفوف مقيدة للجداول الأساسية المسموحة فقط.</p>
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
                        setOdbcKeyColumn(getDefaultOdbcKeyColumn(table));
                        setOdbcWriteState({ status: "idle" });
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

                {canPreviewOdbc && (
                  <div className="stack section-divider" aria-label="ODBC row write controls">
                    <div>
                      <strong>كتابة صف مقيدة</strong>
                      <p className="helper-text">
                        تقبل العمليات JSON object فقط، وتمنع أعمدة الأسرار وكلمات المرور وtokens.
                      </p>
                    </div>

                    <div className="field-row">
                      <label>
                        <span className="field-note">العملية</span>
                        <select
                          className="search-input"
                          value={odbcWriteOperation}
                          onChange={(event) => setOdbcWriteOperation(event.target.value as OdbcWriteOperation)}
                        >
                          <option value="insert">إضافة صف</option>
                          <option value="update">تحديث صف</option>
                          <option value="delete">حذف صف</option>
                        </select>
                      </label>

                      {odbcWriteOperation !== "insert" && (
                        <>
                          <label>
                            <span className="field-note">عمود المفتاح</span>
                            <input
                              className="search-input"
                              value={odbcKeyColumn}
                              onChange={(event) => setOdbcKeyColumn(event.target.value)}
                              placeholder={selectedOdbcTable === "settings" ? "key" : "id"}
                            />
                          </label>
                          <label>
                            <span className="field-note">قيمة المفتاح</span>
                            <input
                              className="search-input"
                              value={odbcKeyValue}
                              onChange={(event) => setOdbcKeyValue(event.target.value)}
                              placeholder="row id أو key"
                            />
                          </label>
                        </>
                      )}
                    </div>

                    {odbcWriteOperation !== "delete" && (
                      <label>
                        <span className="field-note">القيم JSON</span>
                        <textarea
                          className="search-input"
                          value={odbcValuesText}
                          onChange={(event) => setOdbcValuesText(event.target.value)}
                          rows={5}
                          dir="ltr"
                        />
                      </label>
                    )}

                    <div className="helper-row">
                      <button
                        className={odbcWriteOperation === "delete" ? "button button-danger" : "button button-primary"}
                        type="button"
                        disabled={odbcWriteState.status === "saving"}
                        onClick={() => void handleOdbcWrite()}
                      >
                        {odbcWriteState.status === "saving" ? "جار التنفيذ..." : "تنفيذ العملية"}
                      </button>
                      <span className={`form-status ${
                        odbcWriteState.status === "error"
                          ? "status-error"
                          : odbcWriteState.status === "success"
                            ? "status-success"
                            : ""
                      }`}>
                        {odbcWriteState.status === "idle" || odbcWriteState.status === "saving" ? "" : odbcWriteState.message}
                      </span>
                    </div>
                  </div>
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
    </AppShell>
  );
}
