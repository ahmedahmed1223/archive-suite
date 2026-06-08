import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { Database, Loader2, PlugZap, Save, ServerCog } from "lucide-react";

import { useAppStore } from "../../stores/index.js";
import { SettingsCard } from "./SettingsControls.jsx";
import { getBackendUrl, resolveBackendChoice } from "../../bootstrap/backendChoice.js";
import { getCloudToken, getCloudUser } from "../../bootstrap/cloudSession.js";
import {
  DATABASE_ENGINES,
  DATABASE_ENGINE_LABELS,
  canManageDb,
  buildDatabaseUrl,
  fetchDbConfig,
  testDbConnection,
  saveDbConfig,
  DbConfigError,
  normalizeDatabaseEngine
} from "./dbConfigClient.js";

const FIELD = "min-h-10 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none focus:border-emerald-500/40";
const DEFAULT_PORT_BY_ENGINE = { postgresql: "5432", mysql: "3306", sqlserver: "1433" };

// Admin-only DB settings (cloud backend). Lets the operator point the server at
// an external PostgreSQL or back to the bundled one. Changes apply on restart.
export function DatabaseSettings() {
  const { showToast } = useAppStore();
  const backend = React.useMemo(() => resolveBackendChoice().backend, []);
  const role = getCloudUser()?.role;
  const enabled = canManageDb({ backend, token: getCloudToken(), role });

  const [active, setActive] = React.useState(null);
  const [loadErr, setLoadErr] = React.useState("");
  const [engine, setEngine] = React.useState("postgresql");
  const [mode, setMode] = React.useState("url");
  const [url, setUrl] = React.useState("");
  const [parts, setParts] = React.useState({ host: "", port: "5432", database: "archive", user: "archive", password: "", file: "./archive.sqlite" });
  const [testing, setTesting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [testMsg, setTestMsg] = React.useState(null);

  const deps = React.useMemo(() => ({ baseUrl: getBackendUrl(), getToken: getCloudToken }), []);

  React.useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    fetchDbConfig(deps)
      .then((cfg) => {
        if (!alive) return;
        setActive(cfg.database);
        if (cfg?.database?.engine) setEngine(normalizeDatabaseEngine(cfg.database.engine));
      })
      .catch((e) => { if (alive) setLoadErr(e?.message || "تعذّر قراءة الإعداد."); });
    return () => { alive = false; };
  }, [enabled, deps]);

  if (!enabled) return null;

  const candidateUrl = () => (mode === "url" ? url.trim() : buildDatabaseUrl({ ...parts, engine, port: Number(parts.port) || DEFAULT_PORT_BY_ENGINE[engine] }));

  const runTest = async () => {
    const u = candidateUrl();
    if (!u) { showToast?.("أدخل بيانات الاتصال أولاً.", "warning"); return; }
    setTesting(true); setTestMsg(null);
    try {
      const r = await testDbConnection({ engine, url: u, ...deps });
      setTestMsg(r.ok ? { ok: true, text: "نجح الاتصال بقاعدة البيانات." } : { ok: false, text: r.error || "فشل الاتصال." });
    } catch (e) {
      setTestMsg({ ok: false, text: e instanceof DbConfigError ? e.message : "فشل الاختبار." });
    } finally { setTesting(false); }
  };

  const runSave = async () => {
    const u = candidateUrl();
    if (!u) { showToast?.("أدخل بيانات الاتصال أولاً.", "warning"); return; }
    setSaving(true);
    try {
      const r = await saveDbConfig({ engine, url: u, ...deps });
      setActive(r.database);
      showToast?.("حُفِظ الإعداد. أعد تشغيل الخادم لتطبيق الاتصال الجديد.", "success");
    } catch (e) {
      showToast?.(e instanceof DbConfigError ? e.message : "فشل الحفظ.", "error");
    } finally { setSaving(false); }
  };

  const setPart = (k, v) => setParts((p) => ({ ...p, [k]: v }));
  const changeEngine = (next) => {
    const normalized = normalizeDatabaseEngine(next);
    setEngine(normalized);
    setParts((p) => ({ ...p, port: DEFAULT_PORT_BY_ENGINE[normalized] || p.port || "", file: p.file || "./archive.sqlite" }));
  };
  const targetBadge = active?.target === "external" ? "خادم خارجي" : active?.target === "bundled" ? "مُجمَّع" : "غير معروف";

  return jsx(SettingsCard, {
    title: "قاعدة البيانات",
    description: "وجّه الخادم إلى محرك SQL خارجي أو أبقِه على القاعدة المُجمَّعة. يُطبَّق التغيير بعد إعادة تشغيل الخادم وترحيل Prisma المناسب.",
    icon: jsx(ServerCog, { className: "h-5 w-5 va-accent-text" }),
    aside: jsx("span", { className: "rounded-full border va-accent-border va-accent-bg-soft px-3 py-1 text-xs va-accent-text-on-soft", children: targetBadge }),
    children: jsxs("div", { className: "space-y-4", dir: "rtl", children: [
      loadErr && jsx("p", { className: "rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200", children: loadErr }),
      active && jsxs("div", { className: "flex flex-wrap items-center gap-2 rounded-xl va-surface-subtle border p-3 text-sm text-gray-300", children: [
        jsx(Database, { className: "h-4 w-4 va-accent-text" }),
        jsx("span", { className: "text-gray-500", children: "النشط:" }),
        jsx("span", { className: "rounded border border-white/10 px-2 py-0.5 text-xs va-accent-text-on-soft", children: DATABASE_ENGINE_LABELS[active.engine] || active.engine || "SQL" }),
        jsx("code", { dir: "ltr", className: "rounded bg-black/30 px-2 py-0.5 text-xs va-accent-text-on-soft", children: active.url || "—" }),
        jsxs("span", { className: "text-xs text-gray-600", children: ["(", active.source, ")"] })
      ] }),

      jsxs("label", { className: "block space-y-1 text-sm text-gray-300", children: [
        jsx("span", { children: "نوع المحرّك" }),
        jsx("select", {
          value: engine,
          onChange: (event) => changeEngine(event.target.value),
          className: FIELD,
          children: DATABASE_ENGINES.map((id) => jsx("option", { value: id, children: DATABASE_ENGINE_LABELS[id] || id }, id))
        })
      ] }),

      jsxs("div", { className: "inline-flex overflow-hidden rounded-xl border border-white/10", role: "group", "aria-label": "نوع الإدخال", children: [
        jsx("button", { type: "button", onClick: () => setMode("url"), "aria-pressed": mode === "url", className: `px-3 py-1.5 text-xs font-semibold ${mode === "url" ? "va-accent-bg-soft va-accent-text-on-soft" : "text-gray-400 hover:bg-white/5"}`, children: "رابط كامل" }),
        jsx("button", { type: "button", onClick: () => setMode("parts"), "aria-pressed": mode === "parts", className: `px-3 py-1.5 text-xs font-semibold ${mode === "parts" ? "va-accent-bg-soft va-accent-text-on-soft" : "text-gray-400 hover:bg-white/5"}`, children: "حقول منفصلة" })
      ] }),

      mode === "url"
        ? jsxs("label", { className: "block space-y-1 text-sm text-gray-300", children: [
            jsx("span", { children: "سلسلة الاتصال" }),
            jsx("input", { value: url, onChange: (e) => setUrl(e.target.value), dir: "ltr", placeholder: engine === "sqlite" ? "file:./archive.sqlite" : `${engine}://user:pass@host:${DEFAULT_PORT_BY_ENGINE[engine] || ""}/db`, className: `${FIELD} text-start` })
          ] })
        : engine === "sqlite"
          ? jsxs("label", { className: "block space-y-1 text-sm text-gray-300", children: [
              jsx("span", { children: "ملف SQLite على الخادم" }),
              jsx("input", { value: parts.file, onChange: (e) => setPart("file", e.target.value), dir: "ltr", placeholder: "./archive.sqlite", className: `${FIELD} text-start` })
            ] })
          : jsxs("div", { className: "grid gap-2 sm:grid-cols-2", children: [
              jsxs("label", { className: "space-y-1 text-sm text-gray-300", children: [jsx("span", { children: "المضيف (host)" }), jsx("input", { value: parts.host, onChange: (e) => setPart("host", e.target.value), dir: "ltr", placeholder: "db.example.com", className: `${FIELD} text-start` })] }),
              jsxs("label", { className: "space-y-1 text-sm text-gray-300", children: [jsx("span", { children: "المنفذ (port)" }), jsx("input", { value: parts.port, onChange: (e) => setPart("port", e.target.value), dir: "ltr", className: `${FIELD} text-start` })] }),
              jsxs("label", { className: "space-y-1 text-sm text-gray-300", children: [jsx("span", { children: "قاعدة البيانات" }), jsx("input", { value: parts.database, onChange: (e) => setPart("database", e.target.value), dir: "ltr", className: `${FIELD} text-start` })] }),
              jsxs("label", { className: "space-y-1 text-sm text-gray-300", children: [jsx("span", { children: "المستخدم" }), jsx("input", { value: parts.user, onChange: (e) => setPart("user", e.target.value), dir: "ltr", className: `${FIELD} text-start` })] }),
              jsxs("label", { className: "space-y-1 text-sm text-gray-300 sm:col-span-2", children: [jsx("span", { children: "كلمة المرور" }), jsx("input", { type: "password", value: parts.password, onChange: (e) => setPart("password", e.target.value), dir: "ltr", className: `${FIELD} text-start` })] })
            ] }),

      testMsg && jsx("p", { className: `rounded-xl border p-3 text-sm ${testMsg.ok ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "border-red-500/20 bg-red-500/10 text-red-200"}`, children: testMsg.text }),

      jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
        jsxs("button", { type: "button", onClick: runTest, disabled: testing || saving, className: "inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-200 hover:bg-white/5 disabled:opacity-50", children: [testing ? jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : jsx(PlugZap, { className: "h-4 w-4" }), "اختبار الاتصال"] }),
        jsxs("button", { type: "button", onClick: runSave, disabled: saving || testing, className: "va-primary-button inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50", children: [saving ? jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : jsx(Save, { className: "h-4 w-4" }), "حفظ (يتطلّب إعادة تشغيل)"] })
      ] }),
      jsx("p", { className: "text-xs leading-6 text-gray-600", children: "تنبيه: لا تُرسَل كلمة مرور القاعدة الحالية إلى الواجهة (تظهر مُقنَّعة). تبديل المحرّك يحتاج إعادة تشغيل الخادم وتشغيل migration مناسب للمحرّك المختار." })
    ] })
  });
}

export default DatabaseSettings;
