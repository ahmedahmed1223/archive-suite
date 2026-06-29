import { useState, useEffect, useCallback, useRef } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, RefreshCw, ShieldCheck, XCircle } from "lucide-react";

interface ProbeStatus {
  healthy: boolean;
  failCount?: number;
  lastCheck?: string | Date | null;
  lastChecked?: string | null;
  lastSuccess?: string | null;
  probeUrl?: string;
  consecutiveFails: number;
}

interface DrillResult {
  id?: string;
  startedAt?: string;
  ranAt?: string;
  durationMs: number;
  passed: boolean;
  replicaId?: string | null;
  replicaCount?: number;
  testedCount?: number;
  details?: string[];
  error?: string;
}

interface DrillSchedule {
  enabled: boolean;
  running: boolean;
  intervalMs: number;
  intervalHours: number;
  startedAt: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  historyCount: number;
  lastResult: DrillResult | null;
}

interface DrAlertsPanelProps {
  authToken: string;
  isAdmin?: boolean;
  pollIntervalMs?: number;
}

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ar");
}

function fmtProbeTime(value: ProbeStatus["lastCheck"] | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ar");
}

function fmtInterval(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} دقيقة`;
  return `${hours} ساعة`;
}

function drillTime(drill: DrillResult | null | undefined) {
  return drill?.ranAt || drill?.startedAt || null;
}

function drillSummary(drill: DrillResult) {
  if (typeof drill.replicaCount === "number") {
    return `${drill.testedCount ?? 0}/${drill.replicaCount} نسخة · ${drill.durationMs}ms`;
  }
  if (drill.replicaId) return `نسخة ${drill.replicaId} · ${drill.durationMs}ms`;
  return drill.error || "لا توجد نسخة قابلة للاستعادة";
}

function ProbeStatusBadge({ healthy, consecutiveFails }: { healthy: boolean; consecutiveFails: number }) {
  if (healthy) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/50 bg-emerald-900/30 px-2.5 py-1 text-xs font-medium text-emerald-300">
        <CheckCircle2 size={13} />
        سليم
      </span>
    );
  }
  if (consecutiveFails > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-700/50 bg-red-900/30 px-2.5 py-1 text-xs font-medium text-red-300">
        <XCircle size={13} />
        فشل ({consecutiveFails})
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-700/50 bg-amber-900/30 px-2.5 py-1 text-xs font-medium text-amber-300">
      <AlertTriangle size={13} />
      غير معروف
    </span>
  );
}

export function DrAlertsPanel({ authToken, isAdmin = false, pollIntervalMs = 30_000 }: DrAlertsPanelProps) {
  const [probe, setProbe] = useState<ProbeStatus | null>(null);
  const [history, setHistory] = useState<DrillResult[]>([]);
  const [schedule, setSchedule] = useState<DrillSchedule | null>(null);
  const [drilling, setDrilling] = useState(false);
  const [drillMsg, setDrillMsg] = useState<{ err: boolean; text: string } | null>(null);
  const [loadingProbe, setLoadingProbe] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(false);

  const authHeaders = { Authorization: `Bearer ${authToken}` };

  const fetchProbe = useCallback(async () => {
    try {
      const r = await fetch("/api/backups/health-probe", { headers: authHeaders });
      if (r.ok) {
        const d = await r.json();
        if (mountedRef.current) setProbe(d.probe ?? null);
      }
    } catch {
      // ignore — probe status stays stale
    } finally {
      if (mountedRef.current) setLoadingProbe(false);
    }
  }, [authToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchHistory = useCallback(async () => {
    try {
      const r = await fetch("/api/backups/drill-history", { headers: authHeaders });
      if (r.ok) {
        const d = await r.json();
        if (mountedRef.current) {
          setHistory(d.history ?? []);
          setSchedule(d.schedule ?? null);
        }
      }
    } catch {
      // ignore
    }
  }, [authToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    fetchProbe();
    fetchHistory();
    intervalRef.current = setInterval(fetchProbe, pollIntervalMs);
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchProbe, fetchHistory, pollIntervalMs]);

  const runDrillNow = async () => {
    setDrilling(true);
    setDrillMsg(null);
    try {
      const r = await fetch("/api/backups/drill-now", {
        method: "POST",
        headers: authHeaders,
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        if (mountedRef.current) {
          setDrillMsg({ err: false, text: d.drill?.passed ? "اجتاز الحفر DR بنجاح ✓" : "انتهى الحفر DR — بعض الفحوصات فشلت" });
        }
        fetchHistory();
      } else {
        if (mountedRef.current) setDrillMsg({ err: true, text: d.error || "فشل تشغيل الحفر" });
      }
    } catch {
      if (mountedRef.current) setDrillMsg({ err: true, text: "فشل الاتصال بالخادم" });
    } finally {
      if (mountedRef.current) setDrilling(false);
    }
  };

  const isProbeHealthy = probe?.healthy ?? false;
  const isFailing = !isProbeHealthy && (probe?.consecutiveFails ?? 0) > 0;
  const latestDrill = schedule?.lastResult ?? history[0] ?? null;
  const latestDrillFailed = latestDrill?.passed === false;
  const scheduleNeedsAttention = schedule?.enabled === true && schedule.running === false;

  return (
    <section className="space-y-4" dir="rtl" aria-label="لوحة تنبيهات DR">
      {/* Alert banner when probe is failing */}
      {isFailing && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-700/50 bg-red-900/20 p-4 text-sm text-red-300">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
          <div>
            <p className="font-semibold">تنبيه DR: نقطة الصحة تفشل</p>
            <p className="mt-0.5 text-red-400/80">
              فشل متتالي {probe!.consecutiveFails} مرة. تحقق من البنية التحتية للنسخ الاحتياطية.
            </p>
          </div>
        </div>
      )}

      {scheduleNeedsAttention && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-700/50 bg-amber-900/20 p-4 text-sm text-amber-200">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
          <div>
            <p className="font-semibold">جدولة حفر DR غير نشطة</p>
            <p className="mt-0.5 text-amber-200/80">
              التكرار مضبوط كل {fmtInterval(schedule!.intervalHours)} لكن المؤقت غير مشغّل.
            </p>
          </div>
        </div>
      )}

      {latestDrillFailed && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-700/50 bg-red-900/20 p-4 text-sm text-red-300">
          <XCircle size={18} className="mt-0.5 shrink-0 text-red-400" />
          <div>
            <p className="font-semibold">آخر حفر DR فشل</p>
            <p className="mt-0.5 text-red-400/80">
              {latestDrill?.error || "راجع سجل الحفر لمعرفة سبب الفشل."}
            </p>
          </div>
        </div>
      )}

      {/* Health Probe Card */}
      <div className="rounded-xl border border-[var(--va-border)] bg-[var(--va-surface)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--va-text)]">
            <ShieldCheck size={15} className="text-[var(--va-accent)]" />
            نقطة صحة DR
          </div>
          {loadingProbe ? (
            <RefreshCw size={14} className="animate-spin text-[var(--va-text-muted)]" />
          ) : probe ? (
            <ProbeStatusBadge healthy={isProbeHealthy} consecutiveFails={probe.consecutiveFails} />
          ) : (
            <span className="text-xs text-[var(--va-text-muted)]">لا توجد بيانات</span>
          )}
        </div>

        {probe && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--va-text-2)]">
            <dt className="text-[var(--va-text-muted)]">آخر فحص</dt>
            <dd dir="ltr">{fmtProbeTime(probe.lastChecked ?? probe.lastCheck)}</dd>
            <dt className="text-[var(--va-text-muted)]">آخر نجاح</dt>
            <dd dir="ltr">{fmt(probe.lastSuccess)}</dd>
            <dt className="text-[var(--va-text-muted)]">فشل متتالي</dt>
            <dd>{probe.consecutiveFails}</dd>
          </dl>
        )}
      </div>

      {/* DR Drill Section */}
      <div className="rounded-xl border border-[var(--va-border)] bg-[var(--va-surface)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--va-text)]">اختبار الاسترداد (DR Drill)</h3>
          {isAdmin && (
            <button
              type="button"
              onClick={runDrillNow}
              disabled={drilling}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-600/50 bg-amber-900/20 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-900/40 disabled:opacity-50"
            >
              {drilling ? (
                <><RefreshCw size={12} className="animate-spin" />جاري الحفر...</>
              ) : (
                "تشغيل الحفر الآن"
              )}
            </button>
          )}
        </div>

        {schedule && (
          <div className="rounded-lg border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--va-text)]">
              <CalendarClock size={14} className="text-[var(--va-accent)]" />
              جدولة الحفر الآلي
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--va-text-2)]">
              <dt className="text-[var(--va-text-muted)]">الحالة</dt>
              <dd>{schedule.running ? "مجدول ويعمل" : schedule.enabled ? "مفعّل وغير مشغّل" : "معطّل"}</dd>
              <dt className="text-[var(--va-text-muted)]">التكرار</dt>
              <dd>{fmtInterval(schedule.intervalHours)}</dd>
              <dt className="text-[var(--va-text-muted)]">الحفر التالي</dt>
              <dd dir="ltr">{fmt(schedule.nextRunAt)}</dd>
              <dt className="text-[var(--va-text-muted)]">آخر حفر</dt>
              <dd dir="ltr">{fmt(schedule.lastRunAt || drillTime(latestDrill))}</dd>
            </dl>
          </div>
        )}

        {drillMsg && (
          <div
            role="status"
            className={`rounded-lg p-2.5 text-xs ${drillMsg.err ? "bg-red-900/30 text-red-300 border border-red-700/40" : "bg-emerald-900/30 text-emerald-300 border border-emerald-700/40"}`}
          >
            {drillMsg.text}
          </div>
        )}

        {history.length === 0 ? (
          <p className="text-xs text-[var(--va-text-muted)]">لا يوجد سجل حفر بعد.</p>
        ) : (
          <ul className="space-y-2" aria-label="سجل حفر DR">
            {history.map((d, index) => (
              <li key={d.id || d.replicaId || d.ranAt || d.startedAt || index} className="flex items-center gap-3 rounded-lg border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-3 py-2 text-xs">
                {d.passed ? (
                  <CheckCircle2 size={14} className="shrink-0 text-emerald-400" aria-label="نجح" />
                ) : (
                  <XCircle size={14} className="shrink-0 text-red-400" aria-label="فشل" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[var(--va-text)]" dir="ltr">
                    {fmt(drillTime(d))}
                  </p>
                  <p className="truncate text-[var(--va-text-muted)]">
                    {drillSummary(d)}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${d.passed ? "bg-emerald-900/30 text-emerald-300" : "bg-red-900/30 text-red-300"}`}>
                  {d.passed ? "نجح" : "فشل"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
