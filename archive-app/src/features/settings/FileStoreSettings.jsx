import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { Cloud, ExternalLink, FolderOpen, HardDrive, KeyRound, Loader2, RefreshCw, Save, ShieldCheck } from "lucide-react";

import { useAppStore } from "../../stores/index.js";
import { SettingsCard } from "./SettingsControls.jsx";
import { getBackendUrl, resolveBackendChoice } from "../../bootstrap/backendChoice.js";
import { getCloudToken, getCloudUser } from "../../bootstrap/cloudSession.js";
import {
  canManageFileStore, fetchFileStoreConfig, fetchFileStoreStatus,
  saveFileStoreConfig, startDropboxOAuth, testFileStoreProvider, FileStoreConfigError
} from "./fileStoreConfigClient.js";

const FIELD = "input input-bordered w-full";

const PROVIDER_LABELS = {
  disk: "قرص الخادم",
  dropbox: "Dropbox",
  s3: "S3-compatible",
  azure: "Azure Blob",
  gdrive: "Google Drive",
  ftp: "FTP / FTPS",
  smb: "SMB / CIFS",
  sftp: "SFTP / SSH",
  webdav: "WebDAV",
  unknown: "غير معروف"
};

const PROVIDER_FIELDS = {
  s3: [["bucket", "Bucket"], ["region", "Region"], ["endpoint", "Endpoint URL"], ["prefix", "Prefix"], ["accessKeyId", "Access key"], ["secretAccessKey", "Secret key", "password"], ["forcePathStyle", "Force path style", "checkbox"]],
  azure: [["container", "Container"], ["connectionString", "Connection string", "password"], ["accountName", "Account name"], ["accountKey", "Account key", "password"], ["accountUrl", "Account URL"], ["sasToken", "SAS token", "password"], ["prefix", "Prefix"]],
  gdrive: [["folderId", "Folder ID"], ["credentials", "Service account JSON", "password"], ["prefix", "Prefix"]],
  ftp: [["host", "Host"], ["port", "Port", "number"], ["user", "Username"], ["password", "Password", "password"], ["root", "Root path"], ["secure", "FTPS", "checkbox"]],
  smb: [["share", "Share"], ["domain", "Domain"], ["username", "Username"], ["password", "Password", "password"], ["root", "Root path"]],
  sftp: [["host", "Host"], ["port", "Port", "number"], ["username", "Username"], ["password", "Password", "password"], ["privateKey", "Private key", "password"], ["passphrase", "Key passphrase", "password"], ["root", "Root path"]],
  webdav: [["url", "Server URL"], ["username", "Username"], ["password", "Password", "password"], ["bearerToken", "Bearer token", "password"], ["root", "Root path"]]
};

function providerLabel(status) {
  return status?.label || PROVIDER_LABELS[status?.kind] || status?.kind || PROVIDER_LABELS.unknown;
}

function capabilityRows(capabilities = {}) {
  return [
    ["upload", "رفع"],
    ["download", "تنزيل"],
    ["list", "استعراض"],
    ["remove", "حذف"],
    ["temporaryUrl", "روابط مؤقتة"]
  ].map(([key, label]) => ({ key, label, enabled: Boolean(capabilities[key]) }));
}

export function FileStoreSettings() {
  const { showToast } = useAppStore();
  const backend = React.useMemo(() => resolveBackendChoice().backend, []);
  const role = getCloudUser()?.role;
  const enabled = canManageFileStore({ backend, token: getCloudToken(), role });
  const deps = React.useMemo(() => ({ baseUrl: getBackendUrl(), getToken: getCloudToken }), []);

  const [status, setStatus] = React.useState(null);
  const [config, setConfig] = React.useState(null);
  const [kind, setKind] = React.useState("disk");
  const [diskRootDir, setDiskRootDir] = React.useState("");
  const [dropboxRootPath, setDropboxRootPath] = React.useState("");
  const [dropboxAccessToken, setDropboxAccessToken] = React.useState("");
  const [dropboxRefreshToken, setDropboxRefreshToken] = React.useState("");
  const [dropboxAppKey, setDropboxAppKey] = React.useState("");
  const [dropboxAppSecret, setDropboxAppSecret] = React.useState("");
  const [dropboxSelectUser, setDropboxSelectUser] = React.useState("");
  const [dropboxSelectAdmin, setDropboxSelectAdmin] = React.useState("");
  const [providerConfig, setProviderConfig] = React.useState({});
  const [loadErr, setLoadErr] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [oauthBusy, setOauthBusy] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setLoadErr("");
    try {
      const next = await fetchFileStoreStatus(deps);
      setStatus(next);
    } catch (error) {
      const message = error instanceof FileStoreConfigError ? error.message : "تعذّر قراءة حالة مخزن الملفات.";
      setLoadErr(message);
    } finally {
      setLoading(false);
    }
  }, [deps, enabled]);

  React.useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    fetchFileStoreConfig(deps)
      .then((next) => {
        if (!alive) return;
        setConfig(next);
        setKind(PROVIDER_LABELS[next?.kind] ? next.kind : "disk");
        setProviderConfig(next?.config || {});
        setDiskRootDir(next?.disk?.rootDir || "");
        setDropboxRootPath(next?.dropbox?.rootPath || "");
        setDropboxAppKey(next?.dropbox?.appKey || "");
        setDropboxSelectUser(next?.dropbox?.selectUser || "");
        setDropboxSelectAdmin(next?.dropbox?.selectAdmin || "");
        setDropboxAccessToken("");
        setDropboxRefreshToken("");
        setDropboxAppSecret("");
      })
      .catch((error) => {
        if (alive) setLoadErr(error?.message || "تعذّر قراءة إعداد مخزن الملفات.");
      });
    refresh();
    return () => { alive = false; };
  }, [deps, enabled, refresh]);

  if (!enabled) return null;

  const runSave = async () => {
    const hasSavedDropboxAuth = config?.dropbox?.hasAccessToken || config?.dropbox?.hasRefreshToken;
    const hasTypedDropboxAuth = dropboxAccessToken.trim() || dropboxRefreshToken.trim();
    const hasOAuthSetup = dropboxAppKey.trim() && (dropboxAppSecret.trim() || config?.dropbox?.hasAppSecret);
    if (kind === "dropbox" && !hasTypedDropboxAuth && !hasSavedDropboxAuth && !hasOAuthSetup) {
      showToast?.("أدخل Dropbox token أو App key/secret للربط عبر OAuth.", "warning");
      return;
    }
    setSaving(true);
    try {
      const result = await saveFileStoreConfig({
        kind,
        ...(kind !== "disk" && kind !== "dropbox" ? { config: providerConfig } : {}),
        diskRootDir,
        dropboxRootPath,
        dropboxAccessToken,
        dropboxRefreshToken,
        dropboxAppKey,
        dropboxAppSecret,
        dropboxSelectUser,
        dropboxSelectAdmin,
        ...deps
      });
      setConfig(result.fileStore);
      setDropboxAccessToken("");
      setDropboxRefreshToken("");
      setDropboxAppSecret("");
      showToast?.("حُفِظ مخزن الملفات. أعد تشغيل الخادم لتطبيق الاختيار.", "success");
    } catch (error) {
      const message = error instanceof FileStoreConfigError ? error.message : "فشل حفظ مخزن الملفات.";
      showToast?.(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const runProviderTest = async () => {
    setLoading(true);
    try {
      const candidate = kind === "disk"
        ? { rootDir: diskRootDir }
        : kind === "dropbox"
          ? { rootPath: dropboxRootPath, accessToken: dropboxAccessToken, refreshToken: dropboxRefreshToken, appKey: dropboxAppKey, appSecret: dropboxAppSecret, selectUser: dropboxSelectUser, selectAdmin: dropboxSelectAdmin }
          : providerConfig;
      const result = await testFileStoreProvider({ kind, config: candidate, ...deps });
      showToast?.(`نجح الاتصال خلال ${result?.latencyMs ?? 0}ms.`, "success");
    } catch (error) {
      showToast?.(error instanceof FileStoreConfigError ? error.message : "فشل اختبار الاتصال.", "error");
    } finally {
      setLoading(false);
    }
  };

  const runDropboxOAuth = async () => {
    setOauthBusy(true);
    try {
      if (dropboxAppKey.trim() || dropboxAppSecret.trim() || dropboxSelectUser.trim() || dropboxSelectAdmin.trim()) {
        const result = await saveFileStoreConfig({
          kind: "dropbox",
          dropboxRootPath,
          dropboxAccessToken,
          dropboxRefreshToken,
          dropboxAppKey,
          dropboxAppSecret,
          dropboxSelectUser,
          dropboxSelectAdmin,
          ...deps
        });
        setConfig(result.fileStore);
        setDropboxAccessToken("");
        setDropboxRefreshToken("");
        setDropboxAppSecret("");
      }
      const result = await startDropboxOAuth({
        rootPath: dropboxRootPath,
        selectUser: dropboxSelectUser,
        selectAdmin: dropboxSelectAdmin,
        returnTo: typeof window !== "undefined" ? window.location.href : "",
        ...deps
      });
      if (result?.authUrl && typeof window !== "undefined") {
        window.location.assign(result.authUrl);
      } else {
        showToast?.("تم تجهيز رابط Dropbox OAuth.", "success");
      }
    } catch (error) {
      const message = error instanceof FileStoreConfigError ? error.message : "تعذّر بدء ربط Dropbox.";
      showToast?.(message, "error");
    } finally {
      setOauthBusy(false);
    }
  };

  const label = providerLabel(status);
  const location = status?.rootPath || status?.rootDir || status?.bucket || status?.container || status?.prefix || "—";
  const listOk = status?.health?.listOk;
  const healthText = listOk
    ? `تم اختبار الاستعراض بنجاح (${status?.health?.listCount ?? 0} ملف).`
    : status?.health?.error || "لم يكتمل اختبار الاستعراض بعد.";

  return jsx(SettingsCard, {
    title: "مخزن الملفات",
    description: "اعرض نوع التخزين النشط واختبر الاتصال بدون كشف مفاتيح Dropbox أو أي مزوّد سحابي للواجهة.",
    icon: jsx(Cloud, { className: "h-5 w-5 text-cyan-300" }),
    aside: jsx("span", { className: "rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100", children: label }),
    children: jsxs("div", { className: "space-y-4", dir: "rtl", children: [
      loadErr && jsx("p", { className: "rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200", children: loadErr }),

      jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [
        jsxs("div", { className: "rounded-xl va-surface-subtle border p-3", children: [
          jsxs("p", { className: "flex items-center gap-2 text-sm font-semibold text-white", children: [jsx(HardDrive, { className: "h-4 w-4 text-cyan-300" }), "المزوّد النشط"] }),
          jsx("p", { className: "mt-2 text-sm text-gray-300", children: label }),
          jsx("p", { dir: "ltr", className: "mt-1 truncate text-xs text-gray-500", title: status?.kind || "", children: status?.kind || "unknown" })
        ] }),
        jsxs("div", { className: "rounded-xl va-surface-subtle border p-3", children: [
          jsxs("p", { className: "flex items-center gap-2 text-sm font-semibold text-white", children: [jsx(FolderOpen, { className: "h-4 w-4 text-cyan-300" }), "النطاق"] }),
          jsx("p", { dir: "ltr", className: "mt-2 truncate text-sm text-gray-300", title: location, children: location }),
          jsx("p", { className: "mt-1 text-xs text-gray-500", children: status?.auth ? `التفويض: ${status.auth}` : "التفويض server-side" })
        ] })
      ] }),

      jsxs("div", { className: `rounded-xl border p-3 text-sm ${listOk ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "border-amber-500/20 bg-amber-500/10 text-amber-100"}`, children: [
        jsxs("p", { className: "flex items-center gap-2 font-semibold", children: [jsx(ShieldCheck, { className: "h-4 w-4" }), listOk ? "الاتصال يعمل" : "حالة الاتصال" ] }),
        jsx("p", { className: "mt-1 leading-6", children: healthText })
      ] }),

      jsx("div", { className: "flex flex-wrap gap-2", children: capabilityRows(status?.capabilities).map((item) => jsx("span", {
        className: `rounded-full border px-2.5 py-1 text-xs ${item.enabled ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "border-white/10 text-gray-500"}`,
        children: item.label
      }, item.key)) }),

      jsxs("div", { className: "rounded-xl va-surface-subtle border p-3", children: [
        jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
          jsxs("p", { className: "flex items-center gap-2 text-sm font-semibold text-white", children: [jsx(KeyRound, { className: "h-4 w-4 text-cyan-300" }), "الإعداد المحفوظ"] }),
          config && jsxs("span", { className: "rounded-full border border-white/10 px-2.5 py-1 text-xs text-gray-400", children: [config.source || "file", " / ", config.kind || "disk"] })
        ] }),
        jsxs("label", { className: "mt-3 block space-y-1 text-sm text-gray-300", children: [
          jsx("span", { children: "نوع مخزن الملفات" }),
          jsx("select", { value: kind, onChange: (event) => { setKind(event.target.value); setProviderConfig(event.target.value === config?.kind ? config?.config || {} : {}); }, className: "select select-bordered w-full", children: Object.entries(PROVIDER_LABELS).filter(([id]) => id !== "unknown").map(([id, name]) => jsx("option", { value: id, children: name }, id)) })
        ] }),

        kind === "dropbox"
          ? jsxs("div", { className: "mt-3 grid gap-2 md:grid-cols-2", children: [
              jsxs("label", { className: "space-y-1 text-sm text-gray-300", children: [
                jsx("span", { children: "Dropbox root path" }),
                jsx("input", { value: dropboxRootPath, onChange: (e) => setDropboxRootPath(e.target.value), dir: "ltr", placeholder: "/archive", className: FIELD })
              ] }),
              jsxs("label", { className: "space-y-1 text-sm text-gray-300", children: [
                jsx("span", { children: "Dropbox App key" }),
                jsx("input", { value: dropboxAppKey, onChange: (e) => setDropboxAppKey(e.target.value), dir: "ltr", className: FIELD })
              ] }),
              jsxs("label", { className: "space-y-1 text-sm text-gray-300", children: [
                jsxs("span", { children: ["Dropbox App secret", config?.dropbox?.hasAppSecret ? " (محفوظ)" : ""] }),
                jsx("input", { type: "password", value: dropboxAppSecret, onChange: (e) => setDropboxAppSecret(e.target.value), dir: "ltr", className: FIELD })
              ] }),
              jsxs("label", { className: "space-y-1 text-sm text-gray-300", children: [
                jsxs("span", { children: ["Refresh token", config?.dropbox?.hasRefreshToken ? " (اتركه فارغًا للإبقاء على الحالي)" : ""] }),
                jsx("input", { type: "password", value: dropboxRefreshToken, onChange: (e) => setDropboxRefreshToken(e.target.value), dir: "ltr", className: FIELD })
              ] }),
              jsxs("label", { className: "space-y-1 text-sm text-gray-300", children: [
                jsxs("span", { children: ["Access token", config?.dropbox?.hasAccessToken ? " (اتركه فارغًا للإبقاء على الحالي)" : ""] }),
                jsx("input", { type: "password", value: dropboxAccessToken, onChange: (e) => setDropboxAccessToken(e.target.value), dir: "ltr", className: FIELD })
              ] }),
              jsxs("label", { className: "space-y-1 text-sm text-gray-300", children: [
                jsx("span", { children: "Dropbox-API-Select-User" }),
                jsx("input", { value: dropboxSelectUser, onChange: (e) => setDropboxSelectUser(e.target.value), dir: "ltr", placeholder: "dbid:...", className: FIELD })
              ] }),
              jsxs("label", { className: "space-y-1 text-sm text-gray-300", children: [
                jsx("span", { children: "Dropbox-API-Select-Admin" }),
                jsx("input", { value: dropboxSelectAdmin, onChange: (e) => setDropboxSelectAdmin(e.target.value), dir: "ltr", placeholder: "dbid:...", className: FIELD })
              ] })
            ] })
          : kind === "disk" ? jsxs("label", { className: "mt-3 block space-y-1 text-sm text-gray-300", children: [
              jsx("span", { children: "مسار ملفات الخادم" }),
              jsx("input", { value: diskRootDir, onChange: (e) => setDiskRootDir(e.target.value), dir: "ltr", placeholder: ".archive-files", className: FIELD })
            ] }) : jsx("div", { className: "mt-3 grid gap-2 md:grid-cols-2", children: (PROVIDER_FIELDS[kind] || []).map(([field, fieldLabel, type = "text"]) => type === "checkbox"
              ? jsxs("label", { className: "flex items-center gap-3 rounded-lg border border-white/10 p-3 text-sm text-gray-300", children: [jsx("input", { type: "checkbox", checked: Boolean(providerConfig[field]), onChange: (event) => setProviderConfig((current) => ({ ...current, [field]: event.target.checked })), className: "toggle toggle-primary" }), jsx("span", { children: fieldLabel })] }, field)
              : jsxs("label", { className: "space-y-1 text-sm text-gray-300", children: [jsxs("span", { children: [fieldLabel, config?.config?.[`has${field[0].toUpperCase()}${field.slice(1)}`] ? " (محفوظ)" : ""] }), jsx("input", { type, value: providerConfig[field] ?? "", onChange: (event) => setProviderConfig((current) => ({ ...current, [field]: type === "number" ? Number(event.target.value) : event.target.value })), dir: "ltr", className: FIELD })] }, field)) }),

        jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-2", children: [
          jsxs("button", { type: "button", onClick: runSave, disabled: saving || loading, className: "btn btn-primary gap-2", children: [saving ? jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : jsx(Save, { className: "h-4 w-4" }), "حفظ (يتطلّب إعادة تشغيل)"] }),
          kind === "dropbox" && jsxs("button", { type: "button", onClick: runDropboxOAuth, disabled: oauthBusy || saving || loading, className: "inline-flex items-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/15 disabled:opacity-50", children: [oauthBusy ? jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : jsx(ExternalLink, { className: "h-4 w-4" }), "ربط Dropbox"] }),
          jsx("p", { className: "text-xs leading-6 text-gray-600", children: "لا يتم عرض token الحالي في الواجهة؛ الحفظ يكتب الإعداد على الخادم فقط." })
        ] })
      ] }),

      jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
        jsxs("button", { type: "button", onClick: runProviderTest, disabled: loading, className: "btn btn-ghost gap-2", children: [loading ? jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : jsx(RefreshCw, { className: "h-4 w-4" }), "اختبار الإعداد الحالي"] }),
        status?.kind === "dropbox" && jsx("p", { className: "text-xs leading-6 text-gray-500", children: "اختبار الاتصال يستخدم المخزن النشط الآن؛ الإعداد المحفوظ يظهر بعد إعادة التشغيل." })
      ] })
    ] })
  });
}

export default FileStoreSettings;
