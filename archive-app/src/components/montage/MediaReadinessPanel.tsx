import * as React from "react";
import { AlertTriangle, CheckCircle2, XCircle, Download } from "lucide-react";
import { buildMediaReadiness } from "../../features/projects/viewModel.js";

/**
 * MediaReadinessPanel — inline pre-export readiness check.
 *
 * Shows an overall readiness percentage across all project items plus a
 * per-item breakdown with colour-coded issue pills.  Stays inline (not a
 * modal) above the export controls.
 *
 * @param {{ project: object, items: object[], onExport: (kind: string) => void, onCancel: () => void }} props
 */
export function MediaReadinessPanel({ project, items, onExport, onCancel }: any) {
  const projectItems = React.useMemo(() => {
    const ids = new Set([
      ...(project?.itemIds || []),
      ...(project?.roughCuts || []).map((c: any) => c.itemId).filter(Boolean)
    ]);
    return items.filter((item: any) => ids.has(item.id));
  }, [project, items]);

  const readinessResults = React.useMemo(
    () => projectItems.map((item: any) => ({ item, readiness: buildMediaReadiness(item) })),
    [projectItems]
  );

  const totalChecks = readinessResults.length * 5; // 5 checks per item
  const passedChecks = readinessResults.reduce(
    (sum: any, { readiness }: any) => sum + readiness.score,
    0
  );
  const percent = totalChecks === 0 ? 100 : Math.round((passedChecks / totalChecks) * 100);

  const blockedItems = readinessResults.filter((r: any) => r.readiness.status === "blocked");
  const warningItems = readinessResults.filter((r: any) => r.readiness.status === "warning");
  const readyItems = readinessResults.filter((r: any) => r.readiness.status === "ready");

  const isUnderThreshold = percent < 80;

  const statusTone = (status: any) => {
    if (status === "ready") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    if (status === "blocked") return "border-red-500/30 bg-red-500/10 text-red-200";
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  };

  const StatusIcon = ({ status }: any) => {
    if (status === "ready") return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" />;
    if (status === "blocked") return <XCircle className="h-3.5 w-3.5 shrink-0 text-red-300" />;
    return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-300" />;
  };

  return (
    <section
      dir="rtl"
      aria-label="جاهزية الوسائط للتصدير"
      className="rounded-2xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-4 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 va-accent-text" />
          <h3 className="text-sm font-semibold text-[var(--va-text)]">جاهزية الوسائط</h3>
        </div>
        <span
          aria-label={`نسبة الجاهزية ${percent}%`}
          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
            percent >= 80
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : percent >= 50
              ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          {percent}%
        </span>
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="نسبة جاهزية الوسائط"
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--va-surface-2)]"
      >
        <div
          className={`h-full rounded-full transition-all ${
            percent >= 80 ? "bg-emerald-500" : percent >= 50 ? "bg-amber-500" : "bg-red-500"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Summary row */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
          {readyItems.length} جاهزة
        </span>
        {warningItems.length > 0 && (
          <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-amber-200">
            {warningItems.length} ناقصة
          </span>
        )}
        {blockedItems.length > 0 && (
          <span className="rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-red-200">
            {blockedItems.length} محجوبة
          </span>
        )}
      </div>

      {/* Per-item breakdown — show only items with issues */}
      {(blockedItems.length > 0 || warningItems.length > 0) && (
        <ul className="max-h-48 space-y-2 overflow-y-auto" aria-label="قائمة مشاكل الوسائط">
          {[...blockedItems, ...warningItems].map(({ item, readiness }: any) => (
            <li
              key={item.id}
              className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${statusTone(readiness.status)}`}
            >
              <StatusIcon status={readiness.status} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {item.title || item.path || item.id}
                </p>
                {readiness.missing.length > 0 && (
                  <p className="mt-0.5 text-[var(--va-text-muted)]">
                    ناقص: {readiness.missing.map((m: any) => m.label).join("، ")}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Threshold warning */}
      {isUnderThreshold && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>المشروع غير جاهز للتصدير بالكامل — نسبة الجاهزية أقل من 80٪. يُنصح بإكمال الوسائط الناقصة قبل التصدير.</p>
        </div>
      )}

      {/* Empty project */}
      {projectItems.length === 0 && (
        <p className="text-center text-xs text-[var(--va-text-muted)]">لا توجد وسائط مرتبطة بهذا المشروع.</p>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-ghost btn-sm"
        >
          إلغاء
        </button>
        {isUnderThreshold && (
          <button
            type="button"
            onClick={() => onExport?.("json")}
            className="btn btn-ghost btn-sm gap-2 border border-amber-500/30 text-amber-200 hover:bg-amber-500/10"
            aria-label="تصدير على أي حال رغم نقص الوسائط"
          >
            <Download className="h-4 w-4" />
            تصدير على أي حال
          </button>
        )}
        <button
          type="button"
          onClick={() => onExport?.("wizard")}
          className="btn btn-primary btn-sm gap-2"
        >
          <Download className="h-4 w-4" />
          متابعة التصدير
        </button>
      </div>
    </section>
  );
}

MediaReadinessPanel.displayName = "MediaReadinessPanel";
