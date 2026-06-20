import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  HardDrive,
  Lock,
  MemoryStick,
  Pause,
  Play,
  RefreshCw,
  RotateCw,
  Server,
  ShieldAlert,
  XCircle
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { getSessionProvider } from "@archive/core";
import { useAppStore } from "../stores/index.js";
import { getBackendUrl } from "../bootstrap/backendChoice.js";
import { fetchServerHealth } from "../features/server-status/serverHealthClient.js";
import { fetchControlStatus, runControlAction } from "../features/systemControl/systemControlClient.js";
import {
  METRIC_LEVELS,
  OVERALL_STATES,
  buildSystemControlModel,
  formatBytes,
  formatPercent
} from "../features/systemControl/systemControlModel.js";

const AUTO_REFRESH_MS = 10000;

const OVERALL_CONFIG = {
  [OVERALL_STATES.OK]:       { label: "النظام يعمل",      tone: "text-[var(--va-status-success)]", badge: "badge-success", Icon: CheckCircle2 },
  [OVERALL_STATES.DEGRADED]: { label: "أداء متدنٍ",       tone: "text-[var(--va-status-warning)]", badge: "badge-warning", Icon: AlertTriangle },
  [OVERALL_STATES.DOWN]:     { label: "خلل في النظام",    tone: "text-[var(--va-status-danger)]",  badge: "badge-error",   Icon: XCircle },
  [OVERALL_STATES.UNKNOWN]:  { label: "غير معروف",        tone: "text-[var(--va-text-muted)]",     badge: "badge-ghost",   Icon: Server }
};

const METRIC_META = {
  cpu:    { label: "المعالج (CPU)", Icon: Cpu },
  memory: { label: "الذاكرة (RAM)", Icon: MemoryStick },
  disk:   { label: "القرص", Icon: HardDrive }
};

const LEVEL_TONE = {
  [METRIC_LEVELS.OK]:      "text-green-400",
  [METRIC_LEVELS.WARN]:    "text-amber-400",
  [METRIC_LEVELS.CRIT]:    "text-red-400",
  [METRIC_LEVELS.UNKNOWN]: "text-gray-500"
};

const LEVEL_BAR = {
  [METRIC_LEVELS.OK]:      "bg-green-400",
  [METRIC_LEVELS.WARN]:    "bg-amber-400",
  [METRIC_LEVELS.CRIT]:    "bg-red-400",
  [METRIC_LEVELS.UNKNOWN]: "bg-gray-600"
};

const CONTROL_ACTIONS = [
  { id: "start", label: "تشغيل", Icon: Play },
  { id: "restart", label: "إعادة تشغيل", Icon: RotateCw },
  { id: "stop", label: "إيقاف", Icon: Pause }
];

const CONTROL_DISABLED_NOTE = "غير مفعّل من إعدادات الخادم";

function formatUptime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}ي ${h}س`;
  if (h > 0) return `${h}س ${m}د`;
  return `${m}د`;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ar-SA", { dateStyle: "short", timeStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function MetricGauge({ id, percent, level, label, detail }) {
  const meta = METRIC_META[id] || { label: id, Icon: Server };
  const widthPct = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  return jsxs("div", {
    className: "card rounded-xl border border-white/8 bg-white/[0.03] p-4",
    children: [
      jsxs("div", {
        className: "mb-2 flex items-center gap-2",
        children: [
          jsx(meta.Icon, { className: `h-4 w-4 ${LEVEL_TONE[level]}` }),
          jsx("span", { className: "text-xs text-gray-400", children: meta.label }),
          jsx("span", { className: "flex-1" }),
          jsx("span", { className: `text-sm font-bold ${LEVEL_TONE[level]}`, children: label })
        ]
      }),
      jsx("div", {
        className: "h-2 w-full overflow-hidden rounded-full bg-white/5",
        children: jsx("div", {
          className: `h-full rounded-full ${LEVEL_BAR[level]}`,
          style: { width: `${widthPct}%` }
        })
      }),
      detail && jsx("p", { className: "mt-1.5 text-xs text-gray-600", children: detail })
    ]
  });
}

function ServiceRow({ id, name, status, detail, actions = [], actionsEnabled, pendingAction, onAction }) {
  const ok = status === "up";
  const down = status === "down";
  const dot = ok ? "bg-green-400" : down ? "bg-red-400" : "bg-gray-500";
  const statusLabel = ok ? "يعمل" : down ? "متوقف" : "غير معروف";
  const statusTone = ok ? "text-green-400" : down ? "text-red-400" : "text-gray-500";
  return jsxs("div", {
    className: "flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5",
    children: [
      jsx("span", { className: `inline-block h-2.5 w-2.5 shrink-0 rounded-full ${dot}`, "aria-hidden": "true" }),
      jsxs("div", {
        className: "min-w-0 flex-1",
        children: [
          jsx("p", { className: "truncate text-sm text-gray-200", children: name }),
          detail && jsx("p", { className: "truncate text-xs text-gray-600", children: detail })
        ]
      }),
      jsx("span", { className: `shrink-0 text-xs font-medium ${statusTone}`, children: statusLabel }),
      jsx("div", {
        className: "flex shrink-0 gap-1",
        children: CONTROL_ACTIONS.map((action) =>
          {
            const allowed = actionsEnabled && actions.includes(action.id);
            const pending = pendingAction === `${id}:${action.id}`;
            return jsx("button", {
              type: "button",
              disabled: !allowed || Boolean(pendingAction),
              title: allowed ? action.label : CONTROL_DISABLED_NOTE,
              "aria-label": `${action.label} ${name}`,
              onClick: () => onAction?.(id, action.id),
              className: `btn btn-xs btn-ghost gap-1 rounded-lg border border-white/5 ${
                allowed ? "text-gray-300 hover:bg-white/5 hover:text-white" : "cursor-not-allowed text-gray-600 opacity-50"
              }`,
              children: jsx(action.Icon, { className: `h-3.5 w-3.5 ${pending ? "animate-spin" : ""}` })
            }, action.id);
          }
        )
      })
    ]
  }, name);
}

export default function SystemControlPage() {
  const { connectionStatus, runSystemHealthCheck } = useAppStore();
  const [manualHealth, setManualHealth] = React.useState(null);
  const [checking, setChecking] = React.useState(false);
  const [autoRefresh, setAutoRefresh] = React.useState(false);
  const [actionPending, setActionPending] = React.useState("");
  const [actionError, setActionError] = React.useState("");

  const handleRefresh = React.useCallback(async () => {
    setChecking(true);
    try {
      const token = getSessionProvider()?.getToken?.() || "";
      const controlStatus = await fetchControlStatus({ baseUrl: getBackendUrl(), token });
      setManualHealth(controlStatus);
      if (typeof runSystemHealthCheck === "function") {
        runSystemHealthCheck().catch(() => {});
      }
    } catch {
      try {
        if (typeof runSystemHealthCheck === "function") {
          await runSystemHealthCheck();
        } else {
          const result = await fetchServerHealth({});
          setManualHealth(result);
        }
      } catch {
        // Leave the last-known state in place on failure.
      }
    } finally {
      setChecking(false);
    }
  }, [runSystemHealthCheck]);

  const handleControlAction = React.useCallback(async (service, action) => {
    setActionPending(`${service}:${action}`);
    setActionError("");
    try {
      const token = getSessionProvider()?.getToken?.() || "";
      await runControlAction({ baseUrl: getBackendUrl(), token, service, action });
      await handleRefresh();
    } catch (error) {
      setActionError(error?.message || "فشل تنفيذ إجراء مركز التحكم.");
    } finally {
      setActionPending("");
    }
  }, [handleRefresh]);

  React.useEffect(() => {
    if (!autoRefresh) return undefined;
    const id = setInterval(() => {
      handleRefresh();
    }, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, handleRefresh]);

  const rawHealth = manualHealth || connectionStatus?.health || null;
  const checkedAt = connectionStatus?.lastCheckedAt || rawHealth?.checkedAt || null;
  const model = React.useMemo(
    () => buildSystemControlModel(rawHealth || {}, { checkedAt }),
    [rawHealth, checkedAt]
  );

  const overallCfg = OVERALL_CONFIG[model.overall] || OVERALL_CONFIG[OVERALL_STATES.UNKNOWN];

  return jsxs("div", {
    className: "mx-auto max-w-4xl px-4 py-8",
    children: [
      jsxs("div", {
        className: "mb-6 flex flex-wrap items-center justify-between gap-4",
        children: [
          jsxs("div", {
            className: "flex items-center gap-3",
            children: [
              jsx("div", {
                className: "flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]",
                children: jsx(Server, { className: "h-5 w-5 text-gray-300" })
              }),
              jsxs("div", {
                children: [
                  jsx("h1", { className: "text-base font-bold text-gray-100", children: "مركز تحكم النظام" }),
                  jsx("p", { className: "text-xs text-gray-500", children: "مراقبة حالة النظام والموارد والخدمات (للقراءة فقط)" })
                ]
              })
            ]
          }),
          jsxs("div", {
            className: "flex items-center gap-2",
            children: [
              jsxs("label", {
                className: "flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-gray-400",
                children: [
                  jsx("input", {
                    type: "checkbox",
                    className: "toggle toggle-xs",
                    checked: autoRefresh,
                    onChange: (e) => setAutoRefresh(e.target.checked)
                  }),
                  "تحديث تلقائي"
                ]
              }),
              jsxs("button", {
                type: "button",
                onClick: handleRefresh,
                disabled: checking,
                className: "btn btn-sm btn-ghost gap-1.5 rounded-xl border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white",
                children: [
                  jsx(RefreshCw, { className: `h-4 w-4 ${checking ? "animate-spin" : ""}` }),
                  checking ? "جاري الفحص…" : "فحص الآن"
                ]
              })
            ]
          })
        ]
      }),

      jsxs("div", {
        className: "mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4",
        children: [
          jsx(overallCfg.Icon, { className: `h-6 w-6 shrink-0 ${overallCfg.tone}` }),
          jsxs("div", {
            children: [
              jsx("p", { className: `text-sm font-semibold ${overallCfg.tone}`, children: overallCfg.label }),
              jsxs("p", {
                className: "text-xs text-gray-600",
                children: [
                  model.backend ? `${model.backend}` : "محلي",
                  model.version ? ` · ${model.version}` : "",
                  checkedAt ? ` · آخر فحص: ${formatDate(checkedAt)}` : ""
                ]
              })
            ]
          }),
          jsx("span", { className: "flex-1" }),
          jsx("span", { className: `badge ${overallCfg.badge} badge-sm` , children: overallCfg.label })
        ]
      }),

      jsxs("div", {
        className: "stats stats-vertical mb-5 w-full border border-white/8 bg-white/[0.02] sm:stats-horizontal",
        children: [
          jsxs("div", {
            className: "stat",
            children: [
              jsx("div", { className: "stat-figure text-gray-500", children: jsx(Clock, { className: "h-5 w-5" }) }),
              jsx("div", { className: "stat-title text-xs", children: "مدة التشغيل" }),
              jsx("div", { className: "stat-value text-lg", children: model.uptimeSec != null ? formatUptime(model.uptimeSec) : "—" })
            ]
          }),
          jsxs("div", {
            className: "stat",
            children: [
              jsx("div", { className: "stat-figure text-gray-500", children: jsx(Database, { className: "h-5 w-5" }) }),
              jsx("div", { className: "stat-title text-xs", children: "المحرّك" }),
              jsx("div", { className: "stat-value text-lg", children: model.engine || model.backend || "محلي" })
            ]
          }),
          jsxs("div", {
            className: "stat",
            children: [
              jsx("div", { className: "stat-figure text-gray-500", children: jsx(Server, { className: "h-5 w-5" }) }),
              jsx("div", { className: "stat-title text-xs", children: "الخدمات" }),
              jsx("div", { className: "stat-value text-lg", children: String(model.services.length) })
            ]
          })
        ]
      }),

      model.metrics.length > 0 && jsxs("section", {
        className: "mb-5",
        children: [
          jsx("h2", { className: "mb-2 text-sm font-semibold text-gray-300", children: "الموارد" }),
          jsx("div", {
            className: "grid grid-cols-1 gap-3 sm:grid-cols-3",
            children: model.metrics.map((m) =>
              jsx(MetricGauge, { id: m.id, percent: m.percent, level: m.level, label: m.label, detail: m.detail }, m.id)
            )
          })
        ]
      }),

      model.metrics.length === 0 && jsxs("div", {
        className: "alert mb-5 flex items-start gap-2 rounded-xl border border-white/8 bg-white/[0.02] p-3 text-xs text-gray-500",
        children: [
          jsx(Cpu, { className: "mt-0.5 h-4 w-4 shrink-0" }),
          jsx("span", { children: "مقاييس الموارد (المعالج/الذاكرة/القرص) غير متوفرة من الخادم الحالي." })
        ]
      }),

      jsxs("section", {
        className: "mb-5",
        children: [
          jsx("h2", { className: "mb-2 text-sm font-semibold text-gray-300", children: "الخدمات" }),
          model.services.length > 0
            ? jsx("div", {
                className: "flex flex-col gap-2",
                children: model.services.map((svc) =>
                  jsx(ServiceRow, {
                    id: svc.id,
                    name: svc.name,
                    status: svc.status,
                    detail: svc.detail,
                    actions: svc.actions,
                    actionsEnabled: model.actionsEnabled,
                    pendingAction: actionPending,
                    onAction: handleControlAction
                  }, svc.id)
                )
              })
            : jsx("p", { className: "text-xs text-gray-600", children: "لا توجد خدمات معروضة." })
        ]
      }),

      actionError && jsxs("div", {
        className: "alert mb-5 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300/90",
        role: "alert",
        children: [
          jsx(AlertTriangle, { className: "mt-0.5 h-4 w-4 shrink-0" }),
          jsx("span", { children: actionError })
        ]
      }),

      jsxs("div", {
        className: `alert mt-2 flex items-start gap-2 rounded-xl border p-3 text-xs ${
          model.actionsEnabled
            ? "border-green-500/20 bg-green-500/5 text-green-300/90"
            : "border-amber-500/20 bg-amber-500/5 text-amber-300/90"
        }`,
        role: "note",
        children: [
          jsx(ShieldAlert, { className: "mt-0.5 h-4 w-4 shrink-0" }),
          jsxs("div", {
            children: [
              jsxs("p", {
                className: "flex items-center gap-1.5 font-medium",
                children: [
                  jsx(Lock, { className: "h-3.5 w-3.5" }),
                  model.actionsEnabled ? "أزرار التحكم مفعّلة للخدمات المسموحة فقط" : "أزرار التحكم (تشغيل/إيقاف/إعادة تشغيل) معطّلة"
                ]
              }),
              jsx("p", {
                className: model.actionsEnabled ? "mt-0.5 text-green-300/70" : "mt-0.5 text-amber-300/70",
                children: model.actionsEnabled
                  ? "الخادم لا ينفذ إلا أوامر الخدمات الموجودة في allowlist، وكل طلب يتطلب صلاحية admin."
                  : "فعّل CONTROL_AGENT_ACTIONS=enabled وعرّف CONTROL_AGENT_SERVICES على الخادم للسماح بالأوامر."
              })
            ]
          })
        ]
      })
    ]
  });
}
