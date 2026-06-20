/**
 * CloudControlTab — unified cloud infrastructure panel for SettingsPage.
 *
 * Aggregates DatabaseSettings, FileStoreSettings, and live connection health
 * into a single admin tab.  When the app runs in local mode, shows an
 * informational LocalModeCard instead of the cloud-specific controls.
 *
 * Connected to: SettingsPage.jsx, settingsTabs.js
 */
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import {
  Activity,
  CheckCircle2,
  CloudOff,
  Database,
  HardDrive,
  RefreshCw,
  Server,
  WifiOff,
  XCircle
} from "lucide-react";

import { useAppStore } from "../../stores/index.js";
import { SettingsCard } from "./SettingsControls.jsx";
import { DatabaseSettings } from "./DatabaseSettings.jsx";
import { FileStoreSettings } from "./FileStoreSettings.jsx";
import { resolveBackendChoice } from "../../bootstrap/backendChoice.js";
import { fetchServerHealth } from "../server-status/serverHealthClient.js";

/* ── helpers ──────────────────────────────────────────────────── */

const STATE_STYLES = {
  online:       { color: "text-[var(--va-status-success)]", bg: "bg-[var(--va-status-success)]/10 border-[var(--va-status-success)]/25", label: "متصل" },
  degraded:     { color: "text-[var(--va-status-warning)]", bg: "bg-[var(--va-status-warning)]/10 border-[var(--va-status-warning)]/25", label: "متدهور" },
  reconnecting: { color: "text-[var(--va-status-warning)]", bg: "bg-[var(--va-status-warning)]/10 border-[var(--va-status-warning)]/25", label: "إعادة اتصال" },
  offline:      { color: "text-[var(--va-status-danger)]",  bg: "bg-[var(--va-status-danger)]/10 border-[var(--va-status-danger)]/25",  label: "غير متصل" },
  local:        { color: "text-[var(--va-text-muted)]",     bg: "bg-[var(--va-surface-2)] border-[var(--va-border-soft)]",              label: "محلي" }
};

function StatusPill({ state = "local", children }) {
  const s = STATE_STYLES[state] || STATE_STYLES.local;
  const Icon = state === "online" ? CheckCircle2
    : state === "offline" ? XCircle
    : state === "reconnecting" ? RefreshCw
    : state === "degraded" ? WifiOff
    : null;

  return jsxs("span", {
    className: `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${s.bg} ${s.color}`,
    children: [
      Icon && jsx(Icon, { className: "h-3 w-3 shrink-0", "aria-hidden": "true" }),
      children || s.label
    ]
  });
}

function MetricRow({ icon, label, value, pill }) {
  return jsxs("div", {
    className: "flex items-center justify-between gap-3 border-b border-[var(--va-border-soft)] px-4 py-2.5 last:border-0",
    children: [
      jsxs("div", {
        className: "flex min-w-0 items-center gap-2.5",
        children: [
          jsx("span", { className: "text-[var(--va-text-muted)]", children: icon }),
          jsx("span", { className: "text-sm text-[var(--va-text-2)]", children: label })
        ]
      }),
      jsxs("div", {
        className: "flex shrink-0 items-center gap-2",
        children: [
          value && jsx("span", { className: "text-xs text-[var(--va-text-muted)]", children: value }),
          pill
        ]
      })
    ]
  });
}

/* ── local mode card ────────────────────────────────────────────── */

function LocalModeCard() {
  return jsx(SettingsCard, {
    title: "وضع محلي",
    description: "التطبيق يعمل حالياً بدون خادم — البيانات محفوظة في المتصفح فقط.",
    icon: jsx(CloudOff, { className: "h-5 w-5 text-[var(--va-text-muted)]" }),
    children: jsx("div", {
      className: "space-y-3 rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-4",
      children: jsx("p", { className: "text-sm leading-6 text-[var(--va-text-2)]", children: "لتفعيل ميزات Cloud Control (قاعدة بيانات خارجية، تخزين السحابة، JWT، CORS، Redis)، أعد الإعداد باستخدام خادم Archive Suite." })
    })
  });
}

/* ── live health dashboard ──────────────────────────────────────── */

function HealthDashboard({ connectionStatus }) {
  const applyServerHealth = useAppStore((s) => s.applyServerHealth);
  const markRpcFailure = useAppStore((s) => s.markRpcFailure);
  const [refreshing, setRefreshing] = React.useState(false);

  const { state, engine, lastLatencyMs, lastCheckedAt, health } = connectionStatus;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const result = await fetchServerHealth();
      applyServerHealth?.({ health: result, engine: result.engine || engine });
    } catch (err) {
      markRpcFailure?.({ error: err?.message });
    } finally {
      setRefreshing(false);
    }
  }

  const dbState      = health?.db      === "ok" ? "online" : health?.db      ? "degraded" : state;
  const storageState = health?.storage === "ok" ? "online" : health?.storage ? "degraded" : state;

  const checkedLabel = lastCheckedAt
    ? new Intl.DateTimeFormat("ar", { hour: "2-digit", minute: "2-digit" }).format(new Date(lastCheckedAt))
    : null;

  return jsx(SettingsCard, {
    title: "لوحة الصحة الحيّة",
    description: "مؤشرات الاتصال في الوقت الفعلي لمكوّنات البنية التحتية.",
    icon: jsx(Activity, { className: "h-5 w-5 va-accent-text" }),
    aside: jsxs("button", {
      type: "button",
      onClick: handleRefresh,
      disabled: refreshing,
      className: "btn btn-ghost btn-sm gap-1.5",
      children: [
        jsx(RefreshCw, { className: `h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`, "aria-hidden": "true" }),
        refreshing ? "جار الفحص..." : "تحديث"
      ]
    }),
    children: jsx("div", {
      className: "overflow-hidden rounded-xl border border-[var(--va-border-soft)]",
      children: jsxs("div", {
        className: "divide-y divide-[var(--va-border-soft)]",
        children: [
          jsx(MetricRow, {
            icon: jsx(Server, { className: "h-4 w-4" }),
            label: "الخادم",
            value: checkedLabel,
            pill: jsx(StatusPill, { state })
          }),
          jsx(MetricRow, {
            icon: jsx(Database, { className: "h-4 w-4" }),
            label: engine ? `قاعدة البيانات (${engine})` : "قاعدة البيانات",
            value: lastLatencyMs != null ? `${lastLatencyMs}ms` : null,
            pill: jsx(StatusPill, { state: dbState })
          }),
          jsx(MetricRow, {
            icon: jsx(HardDrive, { className: "h-4 w-4" }),
            label: "التخزين",
            pill: jsx(StatusPill, { state: storageState })
          })
        ]
      })
    })
  });
}

/* ── main export ─────────────────────────────────────────────────── */

export function CloudControlTab() {
  const connectionStatus = useAppStore((s) => s.connectionStatus);
  const backend = React.useMemo(() => resolveBackendChoice().backend, []);
  const isCloud = backend !== "local";

  if (!isCloud) return jsx(LocalModeCard, {});

  return jsxs("div", {
    className: "space-y-4",
    children: [
      jsx(HealthDashboard, { connectionStatus }),
      jsx(DatabaseSettings, {}),
      jsx(FileStoreSettings, {})
    ]
  });
}

export default CloudControlTab;
