import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { Activity, Database, RefreshCw, Server, WifiOff } from "lucide-react";

import { getBackendUrl, resolveBackendChoice } from "../../bootstrap/backendChoice.js";
import { useAppStore } from "../../stores/index.js";
import { fetchServerHealth } from "./serverHealthClient.js";

interface ServerStatusBadgeProps {
  compact?: boolean;
}

interface ConnectionStatus {
  state?: string;
  engine?: string;
  backend?: string;
  lastLatencyMs?: number | null;
  lastCheckedAt?: string | null;
  lastError?: string;
  health?: {
    version?: string;
    uptimeSec?: number | null;
    db?: { ok?: boolean };
  };
}

interface ServerHealthErrorLike {
  message?: string;
  status?: number;
}

const STATE_META = {
  local: {
    label: "محلي",
    className: "border-white/10 bg-white/[0.04] text-gray-300",
    Icon: Database
  },
  online: {
    label: "متصل",
    className: "va-accent-border va-accent-bg-soft va-accent-text-on-soft border bg-transparent",
    Icon: Activity
  },
  degraded: {
    label: "متدهور",
    className: "border-amber-500/25 bg-amber-500/10 text-amber-100",
    Icon: Server
  },
  reconnecting: {
    label: "إعادة اتصال",
    className: "border-amber-500/25 bg-amber-500/10 text-amber-100",
    Icon: RefreshCw
  },
  offline: {
    label: "غير متصل",
    className: "border-red-500/25 bg-red-500/10 text-red-100",
    Icon: WifiOff
  }
} as const;

function formatCheckedAt(value?: string | null): string {
  if (!value) return "لم يُفحص بعد";
  try {
    return new Intl.DateTimeFormat("ar", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));
  } catch {
    return value;
  }
}

function backendLabel(status: ConnectionStatus): string {
  if (status.state === "local") {
    return status.engine === "sqlite" ? "SQLite محلي" : "IndexedDB محلي";
  }
  if (status.backend === "postgres") {
    return status.engine ? `SQL / ${status.engine}` : "SQL";
  }
  if (status.backend === "pocketbase") return "PocketBase";
  return status.backend || "خادم";
}

export function ServerStatusBadge({ compact = false }: ServerStatusBadgeProps) {
  const status = useAppStore((state: any) => state.connectionStatus) as ConnectionStatus | undefined;
  const applyServerHealth = useAppStore((state: any) => state.applyServerHealth);
  const markRpcFailure = useAppStore((state: any) => state.markRpcFailure);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const meta = STATE_META[status?.state as keyof typeof STATE_META] || STATE_META.local;
  const Icon = meta.Icon;
  const label = backendLabel(status || {});
  // The state suffix (e.g., "محلي") often already lives inside the engine
  // label ("IndexedDB محلي") — render the suffix only when it adds new info.
  const stateSuffix = meta.label && !label.includes(meta.label) ? meta.label : "";
  const title = `${label}${stateSuffix ? ` - ${stateSuffix}` : ""}${status?.lastLatencyMs != null ? ` - ${status.lastLatencyMs}ms` : ""}`;

  const refresh = async () => {
    const choice = resolveBackendChoice();
    if (choice.backend === "local") return;
    setBusy(true);
    try {
      const health = await fetchServerHealth({ baseUrl: getBackendUrl() });
      applyServerHealth?.(health);
    } catch (error) {
      const serverError = error as ServerHealthErrorLike;
      markRpcFailure?.({ error: serverError?.message || "فشل فحص الخادم", status: serverError?.status });
    } finally {
      setBusy(false);
    }
  };

  return jsxs("span", {
    className: "relative inline-flex",
    dir: "rtl",
    children: [
      jsxs("button", {
        type: "button",
        onClick: () => setOpen((value) => !value),
        className: `inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${meta.className}`,
        title,
        "aria-expanded": open,
        "aria-label": "حالة الخادم وقاعدة البيانات",
        children: [
          jsx(Icon, { className: `h-3.5 w-3.5 ${status?.state === "reconnecting" ? "animate-spin" : ""}` }),
          !compact && jsx("span", { className: "max-w-[12rem] truncate", children: label }),
          stateSuffix && jsx("span", { children: stateSuffix })
        ]
      }),
      open && jsxs("div", {
        className: "absolute start-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-white/10 va-surface-raised p-3 text-start shadow-xl",
        role: "dialog",
        "aria-label": "لوحة صحة الخادم",
        children: [
          jsxs("div", { className: "flex items-start justify-between gap-3", children: [
            jsxs("div", { className: "min-w-0", children: [
              jsx("p", { className: "text-sm font-semibold text-white", children: "حالة التخزين والخادم" }),
              jsx("p", { className: "mt-1 truncate text-xs text-gray-500", dir: "auto", children: label })
            ] }),
            jsx("span", { className: `shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${meta.className}`, children: meta.label })
          ] }),
          jsx("div", { className: "mt-3 grid gap-2 text-xs sm:grid-cols-2", children: [
            ["المحرّك", status?.engine || "indexeddb", /sql|db|file|index|pocket/i.test(status?.engine || "") ? "ltr" : "rtl"],
            ["زمن الاستجابة", status?.lastLatencyMs != null ? `${status.lastLatencyMs}ms` : "—", "ltr"],
            ["آخر فحص", formatCheckedAt(status?.lastCheckedAt), "rtl"],
            ["إصدار الخادم", status?.health?.version || "—", "ltr"],
            ["uptime", status?.health?.uptimeSec != null ? `${status.health.uptimeSec}s` : "—", "ltr"],
            ["DB", status?.health?.db?.ok === false ? "degraded" : status?.state === "local" ? "local" : "ok", "ltr"]
          ].map(([name, value, dir]) => jsxs("div", {
            className: "rounded-xl va-surface-subtle border p-2",
            children: [
              jsx("p", { className: "text-gray-500", children: name }),
              jsx("p", { className: "mt-1 truncate font-semibold text-gray-200", dir, title: String(value), children: value })
            ]
          }, name)) }),
          status?.lastError && jsx("p", {
            className: "mt-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2 text-xs leading-5 text-amber-100",
            children: status.lastError
          }),
          jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-2", children: [
            jsx("button", {
              type: "button",
              onClick: refresh,
              disabled: busy || status?.state === "local",
              className: "inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-white/5 disabled:opacity-50",
              children: [jsx(RefreshCw, { className: `h-3.5 w-3.5 ${busy ? "animate-spin" : ""}` }), "إعادة الاتصال"]
            }),
            jsx("button", {
              type: "button",
              onClick: () => setOpen(false),
              className: "rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-white/5",
              children: "إغلاق"
            })
          ] })
        ]
      })
    ]
  });
}

export default ServerStatusBadge;
