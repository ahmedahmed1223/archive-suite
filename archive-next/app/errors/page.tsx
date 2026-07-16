"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bug, Clock3, Filter, Info, Repeat2, Sparkles, Trash2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/EmptyState";
import MetricStrip from "@/components/MetricStrip";
import PageToolbar from "@/components/PageToolbar";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  clearClientErrors,
  listClientErrors,
  recordClientError,
  type ClientErrorLogEntry,
  type ClientErrorSeverity
} from "@/lib/client-error-log";
import { groupActionErrors, redactAdminSecrets } from "@/lib/admin-action-summary";

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
  const dialogs = useConfirmDialog();
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
            <span className="helper-text">{redactAdminSecrets(row.original.message)}</span>
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
  const latestError = useMemo(
    () => filteredErrors.reduce<ClientErrorLogEntry | null>((latest, entry) => {
      if (!latest) return entry;
      return new Date(entry.lastSeenAt).getTime() > new Date(latest.lastSeenAt).getTime() ? entry : latest;
    }, null),
    [filteredErrors]
  );
  const groupedErrors = useMemo(() => groupActionErrors(filteredErrors), [filteredErrors]);

  const createManualError = () => {
    recordClientError({
      name: "ManualCheck",
      message: "اختبار يدوي من صفحة سجل الأخطاء.",
      page: "/errors",
      source: "manual",
      severity: "info"
    });
  };

  const clearAll = async () => {
    if (
      errors.length > 0 &&
      !(await dialogs.confirm({
        title: "مسح سجل الأخطاء",
        message: "سيتم مسح سجل الأخطاء الحالي من هذا المتصفح. هل تريد المتابعة؟",
        confirmLabel: "مسح",
        destructive: true
      }))
    ) {
      return;
    }

    clearClientErrors();
  };

  return (
    <AppShell subtitle="سجل الأخطاء" navLabel="سجل الأخطاء" contentClassName="observability-content" tipsPage="errors">
      <PageToolbar
        icon={<Bug size={24} />}
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
              <Sparkles size={16} aria-hidden="true" />
              اختبار التسجيل
            </button>
            <button className="button button-danger" type="button" onClick={clearAll} disabled={errors.length === 0}>
              <Trash2 size={16} aria-hidden="true" />
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

      <MetricStrip
        ariaLabel="مقاييس سجل الأخطاء"
        items={[
          {
            label: "أخطاء حرجة",
            value: counts.error,
            description: "تحتاج معالجة مباشرة",
            icon: <AlertTriangle size={20} />,
            tone: counts.error > 0 ? "danger" : "default"
          },
          {
            label: "تحذيرات",
            value: counts.warning,
            description: "مؤشرات سلوك غير مكتمل",
            icon: <Filter size={20} />,
            tone: counts.warning > 0 ? "warning" : "default"
          },
          {
            label: "معلومات",
            value: counts.info,
            description: "أحداث تشخيصية",
            icon: <Info size={20} />,
            tone: "info"
          },
          {
            label: "التكرارات",
            value: counts.repeated,
            description: latestError ? `آخر ظهور: ${new Date(latestError.lastSeenAt).toLocaleString("ar-SA")}` : "لا توجد أحداث",
            icon: <Repeat2 size={20} />,
            tone: counts.repeated > 0 ? "warning" : "success"
          }
        ]}
      />
      {groupedErrors.length ? <section className="panel panel-compact" aria-label="ملخص الاسترداد"><div className="panel-title-row"><div><h2>خطوات الاسترداد المقترحة</h2><p>تجميع محلي للأنماط المتكررة، وليس تشخيصاً من الخادم.</p></div></div><div className="analytics-chip-list">{groupedErrors.map((group) => <span className="badge" key={group.key}>{group.label}: {group.count} — {group.recovery}</span>)}</div></section> : null}

      {filteredErrors.length === 0 ? (
        <EmptyState
          icon={<Clock3 size={22} />}
          title="لا توجد أخطاء مطابقة حاليا."
          description="غيّر درجة الخطورة أو استخدم اختبار التسجيل للتأكد من أن السجل يعمل."
        />
      ) : (
        <section className="workspace-panel error-log-table" aria-label="نتائج سجل الأخطاء">
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
