"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createArchiveApiClient, type ApiEnvelope } from "@/lib/archive-api";

// Simple SVG icons as components
function IconServer() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <rect x="2" y="2" width="20" height="8" rx="1" strokeWidth="2" />
      <rect x="2" y="14" width="20" height="8" rx="1" strokeWidth="2" />
      <line x1="6" y1="6" x2="6" y2="6.01" strokeWidth="2" />
      <line x1="6" y1="18" x2="6" y2="18.01" strokeWidth="2" />
    </svg>
  );
}

function IconWifi() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" strokeWidth="2" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" strokeWidth="2" />
      <line x1="12" y1="20" x2="12" y2="20.01" strokeWidth="2" />
    </svg>
  );
}

function IconWifiOff() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <line x1="1" y1="1" x2="23" y2="23" strokeWidth="2" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" strokeWidth="2" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.64-2.64" strokeWidth="2" />
      <path d="M19.23 15.56c.6.6 1.1 1.25 1.53 1.97" strokeWidth="2" />
      <path d="M2 17s.6 1.03 1.94 2.97" strokeWidth="2" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <polyline points="23 4 23 10 17 10" strokeWidth="2" />
      <path d="M20.49 15a9 9 0 1 1-2-8.83" strokeWidth="2" />
    </svg>
  );
}

function IconAlertCircle() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" />
      <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" />
    </svg>
  );
}

interface HealthResponse {
  backend: string;
  engine: string;
  uptimeSec: number;
}

interface StatusState {
  status: "loading" | "success" | "error";
  health: HealthResponse | null;
  lastChecked: Date | null;
  error: string | null;
}

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}د ${h}س`;
  if (h > 0) return `${h}س ${m}د`;
  return `${m}د`;
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  isOnline?: boolean;
}

function MetricCard({ icon, label, value, isOnline }: MetricCardProps) {
  const colorVar =
    isOnline === true
      ? "var(--color-status-success)"
      : isOnline === false
        ? "var(--color-status-error)"
        : "var(--color-text-tertiary)";

  return (
    <div className="panel p-4 flex items-center gap-3 min-h-24">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border-2"
        style={{ borderColor: colorVar, color: colorVar }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-600 dark:text-gray-400">{label}</p>
        <p
          className="mt-1 text-sm font-semibold break-all font-mono"
          dir="ltr"
          style={{ textAlign: "start" }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

export default function StatusPage() {
  const [state, setState] = useState<StatusState>({
    status: "loading",
    health: null,
    lastChecked: null,
    error: null,
  });
  const apiRef = useRef(createArchiveApiClient());
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkHealth = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "loading" }));
    try {
      const response = (await apiRef.current.health()) as ApiEnvelope<HealthResponse>;

      if (!response.ok) {
        setState({
          status: "error",
          health: null,
          lastChecked: new Date(),
          error: response.error || "فشل الاتصال بالخادم",
        });
        return;
      }

      setState({
        status: "success",
        health: response as unknown as HealthResponse,
        lastChecked: new Date(),
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "خطأ غير معروف";
      setState({
        status: "error",
        health: null,
        lastChecked: new Date(),
        error: `خطأ في الاتصال: ${message}`,
      });
    }
  }, []);

  // Initial fetch and auto-refresh every 30 seconds
  useEffect(() => {
    void checkHealth();

    refreshIntervalRef.current = setInterval(() => {
      void checkHealth();
    }, 30000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [checkHealth]);

  const isOnline = state.status === "success";

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      {/* Hero section */}
      <section className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 mt-1 shrink-0" style={{ color: "var(--color-brand-primary)" }}>
            <IconServer />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              حالة النظام
            </h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              مراقبة الاتصال بالخادم الخلفي وصحة قاعدة البيانات.
            </p>
          </div>
        </div>
      </section>

      {/* Connection status banner */}
      <div className="panel p-4 flex items-center gap-3">
        <div
          className="h-5 w-5"
          style={{
            color: isOnline
              ? "var(--color-status-success)"
              : "var(--color-status-error)",
          }}
        >
          {isOnline ? <IconWifi /> : <IconWifiOff />}
        </div>
        <div className="flex-1">
          <p
            className="text-sm font-semibold"
            style={{
              color: isOnline
                ? "var(--color-status-success)"
                : "var(--color-status-error)",
            }}
          >
            {isOnline ? "متصل بالخادم" : "غير متصل"}
          </p>
          {state.lastChecked && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              آخر فحص: {formatDateTime(state.lastChecked.toISOString())}
            </p>
          )}
        </div>
        <button
          onClick={() => void checkHealth()}
          disabled={state.status === "loading"}
          className="button button-secondary shrink-0 gap-2"
          aria-label="فحص الحالة الآن"
        >
          <div
            className={`h-4 w-4 ${state.status === "loading" ? "animate-spin" : ""}`}
          >
            <IconRefresh />
          </div>
          <span className="hidden sm:inline">
            {state.status === "loading" ? "جاري الفحص…" : "فحص الآن"}
          </span>
        </button>
      </div>

      {/* Error state banner */}
      {state.error && (
        <div
          className="panel p-4 flex gap-3 text-sm"
          style={{
            borderLeftColor: "var(--color-status-error)",
            backgroundColor: "color-mix(in oklab, var(--color-status-error) 10%, transparent)",
            color: "var(--color-status-error)",
          }}
          role="alert"
        >
          <div className="h-5 w-5 shrink-0 mt-0.5">
            <IconAlertCircle />
          </div>
          <p>{state.error}</p>
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          icon={
            <div className="h-5 w-5">
              <IconServer />
            </div>
          }
          label="نوع المحرك"
          value={state.health?.engine || "—"}
        />
        <MetricCard
          icon={
            <div className="h-5 w-5">
              <IconServer />
            </div>
          }
          label="الخادم الخلفي"
          value={state.health?.backend || "محلي"}
          isOnline={isOnline}
        />
        <MetricCard
          icon={
            <div className="h-5 w-5">
              <IconRefresh />
            </div>
          }
          label="مدة التشغيل"
          value={
            state.health?.uptimeSec != null
              ? formatUptime(state.health.uptimeSec)
              : "—"
          }
        />
      </div>

      {/* Status indicator */}
      <div className="text-center py-4 text-xs text-gray-500 dark:text-gray-400">
        <p>التحديث التلقائي كل 30 ثانية</p>
        {state.lastChecked && (
          <p>آخر فحص: {formatDateTime(state.lastChecked.toISOString())}</p>
        )}
      </div>
    </main>
  );
}
