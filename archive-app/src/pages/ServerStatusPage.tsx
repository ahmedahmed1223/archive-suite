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
import {
  MotionPage,
  PageHero,
  StatusBadge,
  Button,
  Surface
} from "../components/ui/index.js";

const MONO = "font-[family-name:var(--va-font-mono)]";

function formatUptime(seconds: any) {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}ي ${h}س`;
  if (h > 0) return `${h}س ${m}د`;
  return `${m}د`;
}

function formatDate(iso: any) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ar-SA", { dateStyle: "short", timeStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function StatusDot({ ok }: any) {
  return jsx("span", {
    className: "inline-block h-3 w-3 shrink-0 rounded-[var(--va-radius-full)]",
    style: { background: ok ? "var(--va-status-success)" : "var(--va-status-danger)" },
    "aria-hidden": "true"
  });
}

// ok === true → success tile, ok === false → danger tile, ok == null → neutral tile.
function metricTileTone(ok: any) {
  if (ok === false) {
    return { border: "color-mix(in oklab, var(--va-status-danger) 30%, transparent)", bg: "color-mix(in oklab, var(--va-status-danger) 12%, transparent)", color: "var(--va-status-danger)" };
  }
  if (ok === true) {
    return { border: "color-mix(in oklab, var(--va-status-success) 30%, transparent)", bg: "color-mix(in oklab, var(--va-status-success) 12%, transparent)", color: "var(--va-status-success)" };
  }
  return { border: "var(--va-border-soft)", bg: "var(--va-surface-2)", color: "var(--va-text-muted)" };
}

function MetricCard({ icon, label, value, sub, ok }: any) {
  const tone = metricTileTone(ok);
  return jsxs(Surface, {
    elevation: 0,
    padding: "p-4",
    className: "flex flex-row items-start gap-3",
    children: [
      jsx("span", {
        className: "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--va-radius-md)] border",
        style: { borderColor: tone.border, background: tone.bg, color: tone.color },
        children: icon
      }),
      jsxs("div", {
        className: "min-w-0",
        children: [
          jsx("p", { className: "text-xs text-[var(--va-text-muted)]", children: label }),
          jsx("p", { className: `mt-0.5 text-sm font-semibold text-[var(--va-text)] break-all ${MONO}`, dir: "ltr", style: { textAlign: "start" }, children: value }),
          sub && jsx("p", { className: `mt-0.5 text-xs text-[var(--va-text-muted)] ${MONO}`, dir: "ltr", style: { textAlign: "start" }, children: sub })
        ]
      })
    ]
  });
}

const STATE_CONFIG = {
  local:        { label: "محلي (أوفلاين)", tone: "info",   token: "var(--va-status-info)",    Icon: Database,       ok: true  },
  online:       { label: "متصل",            tone: "success", token: "var(--va-status-success)", Icon: Wifi,           ok: true  },
  degraded:     { label: "أداء متدني",      tone: "warning", token: "var(--va-status-warning)", Icon: AlertTriangle,  ok: null  },
  reconnecting: { label: "يعيد الاتصال…",   tone: "warning", token: "var(--va-status-warning)", Icon: RefreshCw,      ok: null  },
  offline:      { label: "غير متصل",        tone: "danger",  token: "var(--va-status-danger)",  Icon: WifiOff,        ok: false }
};

export default function ServerStatusPage() {
  const { connectionStatus, runSystemHealthCheck } = useAppStore();
  const [checking, setChecking] = React.useState(false);
  const [manualHealth, setManualHealth] = React.useState<any>(null);

  const health = manualHealth || connectionStatus?.health || null;
  const stateKey = connectionStatus?.state || "local";
  const stateCfg = (STATE_CONFIG as any)[stateKey] || STATE_CONFIG.local;
  const StateIcon = stateCfg.Icon;

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

  return jsxs(MotionPage, {
    className: "mx-auto max-w-2xl space-y-5 p-4 sm:p-6",
    children: [
      jsx(PageHero, {
        icon: jsx(Server, { className: "h-6 w-6 va-accent-text" }),
        title: "حالة السيرفر",
        description: "مراقبة الاتصال وصحة قاعدة البيانات.",
        actions: jsx(Button, {
          variant: "secondary",
          size: "sm",
          onClick: handleRefresh,
          disabled: checking,
          leadingIcon: jsx(RefreshCw, { className: `h-4 w-4 ${checking ? "animate-spin" : ""}` }),
          children: checking ? "جاري الفحص…" : "فحص الآن"
        })
      }),

      jsxs(Surface, {
        elevation: 1,
        padding: "p-4",
        className: "flex items-center gap-3",
        children: [
          jsx(StateIcon, { className: "h-6 w-6 shrink-0", style: { color: stateCfg.token } }),
          jsxs("div", {
            children: [
              jsx("p", { className: "text-sm font-semibold", style: { color: stateCfg.token }, children: stateCfg.label }),
              connectionStatus?.lastCheckedAt && jsx("p", {
                className: "text-xs text-[var(--va-text-muted)]",
                children: `آخر فحص: ${formatDate(connectionStatus.lastCheckedAt)}`
              })
            ]
          }),
          jsx("span", { className: "flex-1" }),
          jsx(StatusDot, { ok: stateKey !== "offline" })
        ]
      }),

      connectionStatus?.lastError && jsxs("div", {
        className: "flex items-start gap-2 rounded-[var(--va-radius-lg)] border p-3 text-sm",
        style: {
          borderColor: "color-mix(in oklab, var(--va-status-danger) 25%, transparent)",
          background: "color-mix(in oklab, var(--va-status-danger) 10%, transparent)",
          color: "var(--va-status-danger)"
        },
        role: "alert",
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
        className: "mt-2 text-center text-xs text-[var(--va-text-muted)]",
        children: "يُحدَّث تلقائياً كل دقيقتين أثناء الاتصال بالشبكة"
      })
    ]
  });
}
