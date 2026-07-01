"use client";

import { useEffect, useMemo, useState } from "react";
import {
  clearClientErrors,
  listClientErrors,
  recordClientError,
  type ClientErrorLogEntry,
  type ClientErrorSeverity
} from "@/lib/client-error-log";

const navLinks = [
  { href: "/", label: "الرئيسية" },
  { href: "/types", label: "إدارة الأنواع" },
  { href: "/settings", label: "الإعدادات" },
  { href: "/reports", label: "التقارير" },
  { href: "/help", label: "المساعدة" }
] as const;

const severityLabels: Record<ClientErrorSeverity, string> = {
  error: "خطأ",
  warning: "تحذير",
  info: "معلومة"
};

function loadErrors() {
  return listClientErrors();
}

export default function ErrorsPage() {
  const [errors, setErrors] = useState<ClientErrorLogEntry[]>([]);
  const [severityFilter, setSeverityFilter] = useState<ClientErrorSeverity | "">("");

  useEffect(() => {
    const refresh = () => setErrors(loadErrors());
    refresh();

    window.addEventListener("archive-next:error-log-updated", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("archive-next:error-log-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const filteredErrors = useMemo(
    () => errors.filter((entry) => !severityFilter || entry.severity === severityFilter),
    [errors, severityFilter]
  );
  const repeatedCount = errors.reduce((sum, entry) => sum + Math.max(0, entry.count - 1), 0);

  const createManualError = () => {
    recordClientError({
      name: "ManualCheck",
      message: "اختبار يدوي من صفحة سجل الأخطاء.",
      page: "/errors",
      source: "manual",
      severity: "info"
    });
  };

  const clearAll = () => {
    clearClientErrors();
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>Archive Suite</strong>
          <span>سجل الأخطاء</span>
        </div>
        <nav className="route-links" aria-label="مسارات سريعة">
          {navLinks.map((link) => (
            <a key={link.href} className="badge" href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
      </header>

      <section className="content stack" aria-label="سجل أخطاء الواجهة">
        <div className="hero">
          <span className="badge">Runtime log</span>
          <h1>سجل الأخطاء والاسترداد</h1>
          <p>
            يعرض الأعطال التي حدثت أثناء استخدام الواجهة، مع عدد التكرارات
            ومكان ظهورها لتسهيل المتابعة والإصلاح.
          </p>
          <div className="hero-actions">
            <span className="badge">{errors.length} أخطاء فريدة</span>
            <span className="badge">{repeatedCount} تكرار</span>
          </div>
        </div>

        <div className="toolbar-row">
          <label className="field-row" style={{ margin: 0 }}>
            <span className="field-note">الدرجة</span>
            <select
              className="search-input"
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value as ClientErrorSeverity | "")}
              style={{ flex: "0 1 12rem" }}
            >
              <option value="">الكل</option>
              <option value="error">أخطاء</option>
              <option value="warning">تحذيرات</option>
              <option value="info">معلومات</option>
            </select>
          </label>
          <div className="route-links">
            <button className="button button-secondary" type="button" onClick={createManualError}>
              اختبار التسجيل
            </button>
            <button className="button button-primary" type="button" onClick={clearAll} disabled={errors.length === 0}>
              مسح السجل
            </button>
          </div>
        </div>

        {filteredErrors.length === 0 ? (
          <div className="empty-state">لا توجد أخطاء مطابقة حالياً.</div>
        ) : (
          <div className="stack">
            {filteredErrors.map((entry) => (
              <article className="panel" key={entry.id}>
                <div className="panel-title-row">
                  <div>
                    <h2>{entry.name}</h2>
                    <p>{entry.message}</p>
                  </div>
                  <span className={entry.severity === "error" ? "badge status-error" : "badge"}>
                    {severityLabels[entry.severity]}
                  </span>
                </div>

                <div className="kv-grid">
                  <div className="kv-item">
                    <strong>الصفحة</strong>
                    <span style={{ overflowWrap: "anywhere" }}>{entry.page}</span>
                  </div>
                  <div className="kv-item">
                    <strong>المصدر</strong>
                    <span>{entry.source}</span>
                  </div>
                  <div className="kv-item">
                    <strong>التكرار</strong>
                    <span>{entry.count}</span>
                  </div>
                  <div className="kv-item">
                    <strong>آخر ظهور</strong>
                    <time>{new Date(entry.lastSeenAt).toLocaleString("ar-SA")}</time>
                  </div>
                </div>

                {entry.stack ? (
                  <pre className="token-preview">{entry.stack}</pre>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
