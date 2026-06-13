import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  RefreshCw,
  Server,
  Wifi,
  WifiOff,
  XCircle
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { useAppStore } from "../stores/index.js";
import { fetchServerHealth } from "../features/server-status/serverHealthClient.js";

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

function StatusDot({ ok }) {
  return jsx("span", {
    className: `inline-block h-3 w-3 shrink-0 rounded-full ${ok ? "bg-green-400" : "bg-red-400"}`,
    "aria-hidden": "true"
  });
}

function MetricCard({ icon, label, value, sub, ok }) {
  return jsxs("div", {
    className: "flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-4",
    children: [
      jsx("span", {
        className: `mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
          ok === false
            ? "border-red-500/30 bg-red-500/10 text-red-400"
            : ok === true
            ? "border-green-500/30 bg-green-500/10 text-green-400"
            : "border-white/10 bg-white/[0.04] text-gray-400"
        }`,
        children: icon
      }),
      jsxs("div", {
        className: "min-w-0",
        children: [
          jsx("p", { className: "text-xs text-gray-500", children: label }),
          jsx("p", { className: "mt-0.5 text-sm font-semibold text-gray-100 break-all", children: value }),
          sub && jsx("p", { className: "mt-0.5 text-xs text-gray-600", children: sub })
        ]
      })
    ]
  });
}

const STATE_CONFIG = {
  local:        { label: "محلي (أوفلاين)", color: "text-blue-400",  Icon: Database,       ok: true  },
  online:       { label: "متصل",            color: "text-green-400", Icon: Wifi,           ok: true  },
  degraded:     { label: "أداء متدني",      color: "text-amber-400", Icon: AlertTriangle,  ok: null  },
  reconnecting: { label: "يعيد الاتصال…",   color: "text-yellow-400",Icon: RefreshCw,      ok: null  },
  offline:      { label: "غير متصل",        color: "text-red-400",   Icon: WifiOff,        ok: false }
};

export default function ServerStatusPage() {
  const { connectionStatus, runSystemHealthCheck } = useAppStore();
  const [checking, setChecking] = React.useState(false);
  const [manualHealth, setManualHealth] = React.useState(null);

  const health = manualHealth || connectionStatus?.health || null;
  const stateKey = connectionStatus?.state || "local";
  const { label: stateLabel, color: stateColor, Icon: StateIcon } = STATE_CONFIG[stateKey] || STATE_CONFIG.local;

  async function handleRefresh() {
    setChecking(true);
    try {
      if (typeof runSystemHealthCheck === "function") {
        await runSystemHealthCheck();
      } else {
        const result = await fetchServerHealth({});
        setManualHealth(result);
      }
    } catch {
      // leave existing state
    } finally {
      setChecking(false);
    }
  }

  const serverUrl = connectionStatus?.backend && connectionStatus.backend !== "local"
    ? connectionStatus.backend
    : null;

  return jsxs("div", {
    className: "mx-auto max-w-2xl px-4 py-8",
    children: [
      jsxs("div", {
        className: "mb-6 flex items-center justify-between gap-4",
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
                  jsx("h1", { className: "text-base font-bold text-gray-100", children: "حالة السيرفر" }),
                  jsx("p", { className: "text-xs text-gray-500", children: "مراقبة الاتصال وصحة قاعدة البيانات" })
                ]
              })
            ]
          }),
          jsx("button", {
            type: "button",
            onClick: handleRefresh,
            disabled: checking,
            className: "inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-sm text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-50 transition-colors",
            children: [
              jsx(RefreshCw, { className: `h-4 w-4 ${checking ? "animate-spin" : ""}` }),
              checking ? "جاري الفحص…" : "فحص الآن"
            ]
          })
        ]
      }),

      jsxs("div", {
        className: "mb-5 flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4",
        children: [
          jsx(StateIcon, { className: `h-6 w-6 shrink-0 ${stateColor}` }),
          jsxs("div", {
            children: [
              jsx("p", { className: `text-sm font-semibold ${stateColor}`, children: stateLabel }),
              connectionStatus?.lastCheckedAt && jsx("p", {
                className: "text-xs text-gray-600",
                children: `آخر فحص: ${formatDate(connectionStatus.lastCheckedAt)}`
              })
            ]
          }),
          jsx("span", { className: "flex-1" }),
          jsx(StatusDot, { ok: stateKey !== "offline" })
        ]
      }),

      connectionStatus?.lastError && jsx("div", {
        className: "mb-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400",
        children: [
          jsx(XCircle, { className: "mt-0.5 h-4 w-4 shrink-0" }),
          jsx("span", { children: connectionStatus.lastError })
        ]
      }),

      jsxs("div", {
        className: "grid grid-cols-2 gap-3 sm:grid-cols-3",
        children: [
          jsx(MetricCard, {
            icon: jsx(Activity, { className: "h-4 w-4" }),
            label: "زمن الاستجابة",
            value: connectionStatus?.lastLatencyMs != null ? `${connectionStatus.lastLatencyMs} ms` : "—",
            ok: connectionStatus?.lastLatencyMs != null ? connectionStatus.lastLatencyMs < 500 : null
          }),
          jsx(MetricCard, {
            icon: jsx(Database, { className: "h-4 w-4" }),
            label: "قاعدة البيانات",
            value: health?.db?.ok !== false ? "متصلة" : "خطأ",
            sub: health?.db?.latencyMs != null ? `${health.db.latencyMs} ms` : undefined,
            ok: health ? health.db?.ok !== false : null
          }),
          jsx(MetricCard, {
            icon: jsx(Clock, { className: "h-4 w-4" }),
            label: "مدة التشغيل",
            value: health?.uptimeSec != null ? formatUptime(health.uptimeSec) : "—",
            ok: null
          }),
          jsx(MetricCard, {
            icon: jsx(Server, { className: "h-4 w-4" }),
            label: "النوع / الإصدار",
            value: connectionStatus?.engine || connectionStatus?.backend || "محلي",
            sub: health?.version || undefined,
            ok: null
          }),
          jsx(MetricCard, {
            icon: jsx(CheckCircle2, { className: "h-4 w-4" }),
            label: "الحالة العامة",
            value: health?.ok !== false ? "يعمل" : "خطأ",
            ok: health != null ? health.ok !== false : null
          }),
          jsx(MetricCard, {
            icon: jsx(Wifi, { className: "h-4 w-4" }),
            label: "عنوان السيرفر",
            value: serverUrl || "وضع محلي",
            ok: null
          })
        ]
      }),

      jsx("p", {
        className: "mt-6 text-center text-xs text-gray-700",
        children: "يُحدَّث تلقائياً كل دقيقتين أثناء الاتصال بالشبكة"
      })
    ]
  });
}
