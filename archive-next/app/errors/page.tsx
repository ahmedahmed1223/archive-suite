"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import {
  clearClientErrors,
  listClientErrors,
  recordClientError,
  type ClientErrorLogEntry,
  type ClientErrorSeverity
} from "@/lib/client-error-log";

const severityLabels: Record<ClientErrorSeverity, string> = {
  error: "خطأ",
  warning: "تحذير",
  info: "معلومة"
};

function loadErrors() {
  return listClientErrors();
}

function severityClass(severity: ClientErrorSeverity) {
  if (severity === "error") return "badge-danger";
  if (severity === "warning") return "badge-warning";
  return "badge-info";
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
  const errorColumns = useMemo<Array<ColumnDef<ClientErrorLogEntry, unknown>>>(
    () => [
      {
        accessorKey: "severity",
        header: "الخطورة",
        cell: ({ row }) => (
          <span className={`badge ${severityClass(row.original.severity)}`}>
            {severityLabels[row.original.severity]}
          </span>
        )
      },
      {
        accessorKey: "name",
        header: "الحدث",
        cell: ({ row }) => (
          <div className="stack stack-tight">
            <strong>{row.original.name}</strong>
            <span className="helper-text">{row.original.message}</span>
          </div>
        )
      },
      {
        accessorKey: "page",
        header: "الصفحة",
        cell: ({ row }) => <span className="wrap-anywhere">{row.original.page}</span>
      },
      {
        accessorKey: "source",
        header: "المصدر"
      },
      {
        accessorKey: "count",
        header: "التكرار"
      },
      {
        accessorKey: "lastSeenAt",
        header: "آخر ظهور",
        cell: ({ row }) => <time>{new Date(row.original.lastSeenAt).toLocaleString("ar-SA")}</time>
      }
    ],
    []
  );

  const counts = useMemo(
    () =>
      errors.reduce(
        (acc, entry) => {
          acc[entry.severity] += 1;
          acc.repeated += Math.max(0, entry.count - 1);
          return acc;
        },
        { error: 0, warning: 0, info: 0, repeated: 0 } as Record<ClientErrorSeverity, number> & { repeated: number }
      ),
    [errors]
  );

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
    if (errors.length > 0 && !window.confirm("مسح سجل الأخطاء الحالي؟")) {
      return;
    }

    clearClientErrors();
  };

  return (
    <AppShell subtitle="سجل الأخطاء" navLabel="سجل الأخطاء" contentClassName="observability-content">
      <PageToolbar
        eyebrow={<span className="badge">Runtime log</span>}
        title="سجل الأخطاء والاسترداد"
        description="مركز موحد لأعطال الواجهة، تكراراتها، ومكان ظهورها حتى يسهل ربط المشكلة بالصفحة أو سير العمل."
        meta={
          <>
            <span className="badge">{errors.length} خطأ فريد</span>
            <span className="badge">{counts.repeated} تكرار</span>
            <span className="badge badge-danger">{counts.error} حرج</span>
          </>
        }
        actions={
          <>
            <button className="button button-secondary" type="button" onClick={createManualError}>
              اختبار التسجيل
            </button>
            <button className="button button-danger" type="button" onClick={clearAll} disabled={errors.length === 0}>
              مسح السجل
            </button>
          </>
        }
      >
        <div className="archive-toolbar-row">
          <label className="toolbar-field">
            <span>درجة الخطورة</span>
            <select
              className="search-input input-narrow"
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value as ClientErrorSeverity | "")}
            >
              <option value="">الكل</option>
              <option value="error">أخطاء</option>
              <option value="warning">تحذيرات</option>
              <option value="info">معلومات</option>
            </select>
          </label>
        </div>
      </PageToolbar>

      <div className="health-metric-grid">
        <article className="health-metric" data-tone="danger">
          <div className="health-metric__body">
            <span>أخطاء حرجة</span>
            <strong>{counts.error}</strong>
          </div>
        </article>
        <article className="health-metric" data-tone="warning">
          <div className="health-metric__body">
            <span>تحذيرات</span>
            <strong>{counts.warning}</strong>
          </div>
        </article>
        <article className="health-metric" data-tone="accent">
          <div className="health-metric__body">
            <span>معلومات</span>
            <strong>{counts.info}</strong>
          </div>
        </article>
      </div>

      {filteredErrors.length === 0 ? (
        <EmptyState
          title="لا توجد أخطاء مطابقة حاليا."
          description="غيّر درجة الخطورة أو استخدم اختبار التسجيل للتأكد من أن السجل يعمل."
        />
      ) : (
        <section className="panel error-log-table" aria-label="نتائج سجل الأخطاء">
          <DataTable
            columns={errorColumns}
            data={filteredErrors}
            emptyMessage="لا توجد أخطاء مطابقة."
            getRowId={(entry) => entry.id}
            virtualized={filteredErrors.length > 40}
          />
          {filteredErrors.some((entry) => entry.stack) ? (
            <details className="section-divider">
              <summary className="field-note">تفاصيل المكدس للأخطاء التي تحتوي stack trace</summary>
              <div className="stack mt-tight">
                {filteredErrors.filter((entry) => entry.stack).map((entry) => (
                  <article className="error-log-card" key={entry.id} data-severity={entry.severity}>
                    <strong>{entry.name}</strong>
                    <pre className="token-preview">{entry.stack}</pre>
                  </article>
                ))}
              </div>
            </details>
          ) : null}
        </section>
      )}
    </AppShell>
  );
}
