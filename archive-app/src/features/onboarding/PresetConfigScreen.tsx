import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { CheckCircle2, Circle, Database, Server, Wifi, WifiOff, X, Zap } from "lucide-react";

const BACKEND_LABELS = { postgres: "PostgreSQL", sqlserver: "SQL Server", pocketbase: "PocketBase", local: "محلي" };

function StatusRow({ label, value, ok, placeholder }: any) {
  return jsxs("div", {
    className: "flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5",
    children: [
      jsx("span", { className: "text-sm text-gray-400", children: label }),
      jsxs("span", {
        className: `flex items-center gap-1.5 text-sm font-medium ${ok ? "text-emerald-300" : "text-gray-500"}`,
        children: [
          ok
            ? jsx(CheckCircle2, { className: "h-4 w-4 text-emerald-400", "aria-hidden": "true" })
            : jsx(Circle, { className: "h-4 w-4", "aria-hidden": "true" }),
          value || placeholder || "—"
        ]
      })
    ]
  });
}

/**
 * PresetConfigScreen — shown in the onboarding wizard when a .env is already
 * configured. Lets the user confirm existing settings with one click instead
 * of re-entering them across multiple wizard steps.
 *
 * @param {object} props
 * @param {object} props.config - result from GET /api/setup/preset-config
 * @param {() => void} props.onUsePreset - called when user confirms preset
 * @param {() => void} props.onManualSetup - skip to manual wizard steps
 */
export function PresetConfigScreen({ config, onUsePreset, onManualSetup }: any) {
  const backendLabel = (BACKEND_LABELS as any)[config?.backend] || config?.backend || "—";
  const isPostgres = config?.backend === "postgres";
  const isSqlServer = config?.backend === "sqlserver";
  const isPocketBase = config?.backend === "pocketbase";

  return jsxs("div", {
    dir: "rtl",
    className: "space-y-5",
    children: [
      jsxs("div", {
        className: "space-y-1",
        children: [
          jsxs("div", {
            className: "flex items-center gap-2",
            children: [
              jsx(Zap, { className: "h-5 w-5 text-emerald-400", "aria-hidden": "true" }),
              jsx("h2", { className: "text-lg font-semibold text-white", children: "إعداد مسبق مكتشف" })
            ]
          }),
          jsx("p", {
            className: "text-sm text-gray-400",
            children: "تم اكتشاف إعدادات في ملف .env — يمكنك تأكيدها بنقرة واحدة بدلاً من إدخالها يدوياً."
          })
        ]
      }),

      jsxs("div", {
        className: "space-y-2",
        children: [
          jsxs("div", {
            className: "flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500",
            children: [jsx(Database, { className: "h-3.5 w-3.5", "aria-hidden": "true" }), "التخزين"]
          }),
          jsx(StatusRow, { label: "نوع قاعدة البيانات", value: backendLabel, ok: !!config?.backend }),
          isPocketBase && jsx(StatusRow, {
            label: "رابط PocketBase",
            value: config?.pocketbaseUrl ? config.pocketbaseUrl.replace(/https?:\/\//, "") : null,
            ok: !!config?.pocketbaseUrl,
            placeholder: "غير مُعدّ"
          }),
          (isPostgres || isSqlServer) && jsx(StatusRow, {
            label: isSqlServer ? "قاعدة بيانات SQL Server" : "قاعدة بيانات PostgreSQL",
            value: config?.hasDatabaseUrl ? `${isSqlServer ? "SQLSERVER_URL" : "DATABASE_URL"} موجود ✓` : null,
            ok: !!config?.hasDatabaseUrl,
            placeholder: isSqlServer ? "SQLSERVER_URL غير موجود" : "DATABASE_URL غير موجود"
          }),

          jsxs("div", {
            className: "flex items-center gap-2 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-500",
            children: [jsx(Server, { className: "h-3.5 w-3.5", "aria-hidden": "true" }), "حساب المدير"]
          }),
          jsx(StatusRow, {
            label: "البريد الإلكتروني",
            value: config?.adminEmail || null,
            ok: !!config?.hasAdminEmail,
            placeholder: "ADMIN_EMAIL غير موجود"
          }),
          jsx(StatusRow, {
            label: "كلمة المرور",
            value: config?.hasAdminPassword ? "ADMIN_PASSWORD محدد ✓" : null,
            ok: !!config?.hasAdminPassword,
            placeholder: "ADMIN_PASSWORD غير موجود"
          }),
          jsx(StatusRow, {
            label: "مفتاح JWT",
            value: config?.hasJwtSecret ? "JWT_SECRET محدد ✓" : null,
            ok: !!config?.hasJwtSecret,
            placeholder: "JWT_SECRET غير موجود"
          }),

          jsxs("div", {
            className: `flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${
              config?.dbReachable
                ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
                : "border-amber-500/20 bg-amber-500/5 text-amber-300"
            }`,
            children: [
              config?.dbReachable
                ? jsx(Wifi, { className: "h-4 w-4 shrink-0", "aria-hidden": "true" })
                : jsx(WifiOff, { className: "h-4 w-4 shrink-0", "aria-hidden": "true" }),
              jsx("span", {
                children: config?.dbReachable
                  ? "قاعدة البيانات متصلة وجاهزة"
                  : "تعذّر الاتصال بقاعدة البيانات — تحقق من الإعدادات"
              })
            ]
          })
        ]
      }),

      jsxs("div", {
        className: "flex flex-col gap-2 sm:flex-row sm:justify-end",
        children: [
          jsxs("button", {
            type: "button",
            onClick: onManualSetup,
            className: "flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-gray-300 transition-colors hover:bg-white/5",
            children: [jsx(X, { className: "h-4 w-4", "aria-hidden": "true" }), "إعداد يدوي"]
          }),
          jsxs("button", {
            type: "button",
            onClick: onUsePreset,
            disabled: !config?.isFullyConfigured,
            title: config?.isFullyConfigured ? undefined : "بعض الإعدادات المطلوبة ناقصة",
            className: "flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50",
            children: [jsx(Zap, { className: "h-4 w-4", "aria-hidden": "true" }), "استخدام الإعدادات المكتشفة"]
          })
        ]
      })
    ]
  });
}

PresetConfigScreen.displayName = "PresetConfigScreen";
