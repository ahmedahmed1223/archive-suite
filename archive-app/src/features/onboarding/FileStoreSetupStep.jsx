import * as React from "react";
import {
  Cloud,
  Database,
  FolderSync,
  HardDrive,
  Loader2,
  Network,
  Server,
  ShieldCheck
} from "lucide-react";

const ICONS = {
  disk: HardDrive,
  s3: Cloud,
  dropbox: Cloud,
  azure: Cloud,
  gdrive: FolderSync,
  ftp: Network,
  smb: Server,
  sftp: ShieldCheck,
  webdav: Database
};

function statusMeta(provider) {
  if (provider?.active && provider?.configured) return { label: "نشط وجاهز", className: "badge-success" };
  if (provider?.configured) return { label: "مهيأ", className: "badge-info" };
  return { label: "ينقصه إعداد", className: "badge-warning" };
}

export function FileStoreSetupStep({
  providers = [],
  value = "disk",
  onChange,
  onTest,
  testing = false,
  testResult = null
}) {
  return (
    <section dir="rtl" className="space-y-5" aria-labelledby="file-store-setup-title">
      <div>
        <h2 id="file-store-setup-title" className="text-xl font-bold text-base-content">اختر مخزن الملفات</h2>
        <p className="mt-1 text-sm leading-7 text-base-content/65">
          تحفظ المواد الأصلية في المزود المختار، بينما تبقى الفهرسة وبيانات الأرشيف في قاعدة البيانات.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="مزود مخزن الملفات">
        {providers.map((provider) => {
          const Icon = ICONS[provider.id] || HardDrive;
          const selected = value === provider.id;
          const status = statusMeta(provider);
          return (
            <label
              key={provider.id}
              className={`flex min-h-24 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                selected ? "border-primary bg-primary/10" : "border-base-300 bg-base-200/35 hover:bg-base-200/70"
              }`}
            >
              <input
                type="radio"
                name="onboarding-file-store"
                className="radio radio-primary radio-sm mt-1"
                checked={selected}
                onChange={() => onChange?.(provider.id)}
              />
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-base-content/70" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-base-content">{provider.label || provider.id}</span>
                  <span className={`badge badge-sm badge-soft ${status.className}`}>{status.label}</span>
                </span>
                {provider.missingEnv?.length > 0 ? (
                  <span className="mt-2 block break-words text-xs leading-5 text-base-content/55" dir="ltr">
                    {provider.missingEnv.join(" · ")}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>

      {testResult ? (
        <div role="alert" className={`alert alert-soft ${testResult.ok ? "alert-success" : "alert-error"}`}>
          <span>{testResult.text}</span>
        </div>
      ) : null}

      {onTest ? (
        <button type="button" className="btn btn-outline" onClick={() => onTest(value)} disabled={testing}>
          {testing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
          اختبار جاهزية المخزن
        </button>
      ) : null}
    </section>
  );
}

export default FileStoreSetupStep;
