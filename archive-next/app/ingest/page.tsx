"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Cloud, FolderSearch, KeyRound, Network, RadioTower, Server, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import PageToolbar from "@/components/PageToolbar";
import { useCapability } from "@/components/RoleGate";
import { createArchiveApiClient, type WatchedIngestBatch } from "@/lib/archive-api";
import "./ingest.css";

type PullResult = { ingested: number; skipped: number };

type OperationState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; result: PullResult }
  | { status: "error"; message: string };

type IngestSource = "scan" | "watched" | "ftp" | "smb" | "dropbox";

const sourceLabels: Record<IngestSource, string> = {
  scan: "مجلد الخادم",
  watched: "مجلد مراقَب",
  ftp: "FTP/FTPS",
  smb: "SMB",
  dropbox: "Dropbox"
};

function operationStatusLabel(state: OperationState) {
  if (state.status === "running") return "جار التنفيذ";
  if (state.status === "success") return `${state.result.ingested} مدخل`;
  if (state.status === "error") return "يتطلب مراجعة";
  return "جاهز";
}

function operationTone(state: OperationState) {
  if (state.status === "success") return "success";
  if (state.status === "error") return "danger";
  if (state.status === "running") return "warning";
  return "info";
}

function ResultBanner({ label, state }: Readonly<{ label: string; state: OperationState }>) {
  if (state.status === "success") {
    return (
      <div className="state-banner state-banner-success" role="status">
        <strong>اكتمل {label}</strong>
        <span className="helper-text">تم إدخال {state.result.ingested} عنصر وتجاوز {state.result.skipped}.</span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="state-banner state-banner-error" role="alert">
        <strong>تعذر {label}</strong>
        <span className="helper-text">{state.message}</span>
      </div>
    );
  }

  return null;
}

export default function IngestPage() {
  const { t } = useLocale();
  const api = useMemo(() => createArchiveApiClient(), []);
  const canManageIngest = useCapability("ingest.manage");

  const [scanState, setScanState] = useState<OperationState>({ status: "idle" });
  const [watchedState, setWatchedState] = useState<OperationState>({ status: "idle" });
  const [watchedBatch, setWatchedBatch] = useState<WatchedIngestBatch | null>(null);
  const [activeSource, setActiveSource] = useState<IngestSource>("scan");

  // Connection params live in component state only — never persisted to localStorage.
  const [ftpState, setFtpState] = useState<OperationState>({ status: "idle" });
  const [ftpHost, setFtpHost] = useState("");
  const [ftpPort, setFtpPort] = useState("");
  const [ftpUser, setFtpUser] = useState("");
  const [ftpPassword, setFtpPassword] = useState("");
  const [ftpRemotePath, setFtpRemotePath] = useState("");
  const [ftpSecure, setFtpSecure] = useState(false);

  const [smbState, setSmbState] = useState<OperationState>({ status: "idle" });
  const [smbShare, setSmbShare] = useState("");
  const [smbPath, setSmbPath] = useState("");
  const [smbUser, setSmbUser] = useState("");
  const [smbPassword, setSmbPassword] = useState("");
  const [smbDomain, setSmbDomain] = useState("");

  const [dropboxState, setDropboxState] = useState<OperationState>({ status: "idle" });

  const runOperation = async (
    setState: (state: OperationState) => void,
    operation: () => Promise<{ ok: true; ingested: unknown[]; skipped: number } | { ok: false; error: string }>
  ) => {
    setState({ status: "running" });
    try {
      const response = await operation();
      if (response.ok) {
        setState({ status: "success", result: { ingested: response.ingested.length, skipped: response.skipped } });
      } else {
        setState({ status: "error", message: response.error || "فشلت العملية." });
      }
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "فشلت العملية." });
    }
  };

  const handleScan = () => void runOperation(setScanState, () => api.ingestScan());

  const updateWatchedState = (batch: WatchedIngestBatch) => {
    setWatchedBatch(batch);
    setWatchedState({
      status: "success",
      result: {
        ingested: batch.entries.filter((entry) => entry.status === "pending" || entry.status === "applied").length,
        skipped: batch.entries.filter((entry) => entry.status === "deferred" || entry.status === "quarantined").length
      }
    });
  };

  const handleWatchedPreview = () => void (async () => {
    setWatchedState({ status: "running" });
    try {
      const response = await api.previewWatchedIngest();
      if (!response.ok) return setWatchedState({ status: "error", message: response.error || "تعذرت معاينة المجلد المراقَب." });
      updateWatchedState(response.batch);
    } catch (error) {
      setWatchedState({ status: "error", message: error instanceof Error ? error.message : "تعذرت معاينة المجلد المراقَب." });
    }
  })();

  const handleWatchedApply = () => void (async () => {
    if (!watchedBatch) return;
    setWatchedState({ status: "running" });
    try {
      const response = await api.applyWatchedIngestBatch(watchedBatch.id);
      if (!response.ok) return setWatchedState({ status: "error", message: response.error || "تعذر تطبيق الدفعة." });
      updateWatchedState(response.batch);
    } catch (error) {
      setWatchedState({ status: "error", message: error instanceof Error ? error.message : "تعذر تطبيق الدفعة." });
    }
  })();

  const handleFtpPull = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void runOperation(setFtpState, () =>
      api.ingestFtpPull({
        host: ftpHost.trim(),
        port: ftpPort ? Number(ftpPort) : undefined,
        user: ftpUser.trim(),
        password: ftpPassword,
        remotePath: ftpRemotePath.trim() || undefined,
        secure: ftpSecure
      })
    );
  };

  const handleSmbPull = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void runOperation(setSmbState, () =>
      api.ingestSmbPull({
        share: smbShare.trim(),
        path: smbPath.trim() || undefined,
        user: smbUser.trim(),
        password: smbPassword,
        domain: smbDomain.trim() || undefined
      })
    );
  };

  const handleDropboxPull = () => void runOperation(setDropboxState, () => api.ingestDropboxPull());

  const isAnyRunning = scanState.status === "running" || watchedState.status === "running" || ftpState.status === "running" || smbState.status === "running" || dropboxState.status === "running";
  const sourceStates: Record<IngestSource, OperationState> = {
    scan: scanState,
    watched: watchedState,
    ftp: ftpState,
    smb: smbState,
    dropbox: dropboxState
  };

  return (
    <AppShell subtitle={t.pageTitles.importContent} navLabel={t.pageTitles.import} contentClassName="observability-content" tipsPage="ingest">
      <PageToolbar
        icon={<RadioTower size={24} />}
        eyebrow={<span className="badge">عمليات الاستيراد</span>}
        title="استيراد المحتوى للأرشيف"
        description="فحص مجلد الاستيراد المحلي، أو سحب ملفات من مصادر FTP وSMB مباشرة إلى مخازن الأرشيف."
        meta={(
          <>
            <span className="badge">{isAnyRunning ? "عملية جارية" : "جاهز"}</span>
          </>
        )}
        actions={(
          <a className="button button-secondary" href="/files">مستعرض الملفات</a>
        )}
      >
        <div className="ingest-source-tabs" role="group" aria-label="مصادر الاستيراد">
          {(Object.keys(sourceLabels) as IngestSource[]).map((source) => (
            <button
              key={source}
              type="button"
              className="badge"
              data-active={activeSource === source ? "true" : "false"}
              onClick={() => setActiveSource(source)}
            >
              {sourceLabels[source]}
              <span>{operationStatusLabel(sourceStates[source])}</span>
            </button>
          ))}
        </div>
      </PageToolbar>

      <section className="ingest-overview-grid" aria-label="ملخص مصادر الاستيراد">
        <article className="health-metric" data-tone={operationTone(scanState)}>
          <span className="health-metric__icon" aria-hidden="true"><FolderSearch size={20} /></span>
          <div className="health-metric__body">
            <span>مجلد الخادم</span>
            <strong>{operationStatusLabel(scanState)}</strong>
            <small>فحص مباشر للملفات الجديدة</small>
          </div>
        </article>
        <article className="health-metric" data-tone={operationTone(watchedState)}>
          <span className="health-metric__icon" aria-hidden="true"><FolderSearch size={20} /></span>
          <div className="health-metric__body">
            <span>مجلد مراقَب</span>
            <strong>{operationStatusLabel(watchedState)}</strong>
            <small>معاينة ثم موافقة صريحة</small>
          </div>
        </article>
        <article className="health-metric" data-tone={operationTone(ftpState)}>
          <span className="health-metric__icon" aria-hidden="true"><Network size={20} /></span>
          <div className="health-metric__body">
            <span>FTP/FTPS</span>
            <strong>{operationStatusLabel(ftpState)}</strong>
            <small>بيانات الاتصال غير محفوظة</small>
          </div>
        </article>
        <article className="health-metric" data-tone={operationTone(smbState)}>
          <span className="health-metric__icon" aria-hidden="true"><Server size={20} /></span>
          <div className="health-metric__body">
            <span>SMB</span>
            <strong>{operationStatusLabel(smbState)}</strong>
            <small>سحب من مشاركة داخلية</small>
          </div>
        </article>
        <article className="health-metric" data-tone={operationTone(dropboxState)}>
          <span className="health-metric__icon" aria-hidden="true"><Cloud size={20} /></span>
          <div className="health-metric__body">
            <span>Dropbox</span>
            <strong>{operationStatusLabel(dropboxState)}</strong>
            <small>سحب قابل للاستئناف من المجلد المتصل</small>
          </div>
        </article>
      </section>

      <div className="state-banner state-banner-info" role="note">
        <strong>فحص ما قبل التنفيذ</strong>
        <span className="helper-text">اختر المصدر، راجع المسار وبيانات الاتصال، ثم نفّذ. تعرض النتيجة عدد العناصر المدخلة والمتجاوزة كمعاينة تشغيلية؛ لا توجد محاكاة dry-run في الـAPI الحالي.</span>
      </div>

      <section className="panel ingest-operation-panel" data-active={activeSource === "scan" ? "true" : "false"} aria-label="فحص مجلد الاستيراد">
        <div className="panel-title-row">
          <div>
            <h2>فحص مجلد الاستيراد</h2>
            <p>يفحص مجلد الاستيراد على الخادم ويُنشئ سجلات أرشيف للملفات الجديدة.</p>
          </div>
          {canManageIngest && (
            <button type="button" className="button button-primary" onClick={handleScan} disabled={scanState.status === "running"}>
              {scanState.status === "running" ? "جار الفحص..." : "بدء الفحص"}
            </button>
          )}
        </div>
        {!canManageIngest && <p className="helper-text">لا تملك صلاحية تشغيل الاستيراد؛ يمكنك مراجعة النتائج فقط.</p>}
        <ResultBanner label="فحص مجلد الاستيراد" state={scanState} />
      </section>

      <section className="panel ingest-operation-panel" data-active={activeSource === "watched" ? "true" : "false"} aria-label="المجلد المراقَب">
        <div className="panel-title-row">
          <div>
            <h2>المجلد المراقَب</h2>
            <p>تظهر الملفات المستقرة أولاً كدفعة مراجعة. لن يُنشأ أي سجل قبل اعتمادك الصريح للدفعة.</p>
          </div>
          {canManageIngest && (
            <div className="button-row">
              <button type="button" className="button button-secondary" onClick={handleWatchedPreview} disabled={watchedState.status === "running"}>معاينة الدفعة</button>
              <button type="button" className="button button-primary" onClick={handleWatchedApply} disabled={watchedState.status === "running" || watchedBatch?.status !== "pending"}>اعتماد وإدخال</button>
            </div>
          )}
        </div>
        {!canManageIngest && <p className="helper-text">لا تملك صلاحية معاينة أو اعتماد دفعات المجلد المراقَب.</p>}
        {watchedState.status === "error" && <p className="helper-text" role="alert">{watchedState.message}</p>}
        {watchedBatch && (
          <div className="table-wrap" aria-live="polite">
            <table>
              <thead><tr><th>الملف</th><th>الحالة</th><th>قاعدة الفرز</th><th>وجهة التجهيز</th><th>سبب المراجعة</th></tr></thead>
              <tbody>{watchedBatch.entries.map((entry) => <tr key={entry.id}><td>{entry.fileName}</td><td>{entry.status}</td><td>{entry.routing?.metadataTemplateId || "افتراضي"}</td><td>{entry.routing?.stagingDirectory || "ingest/watched/accepted"}</td><td>{entry.reason || "جاهز"}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      <div className="analytics-columns">
        <section className="panel ingest-operation-panel" data-active={activeSource === "ftp" ? "true" : "false"} aria-label="سحب من FTP">
          <div className="panel-title-row">
            <div>
              <h2>سحب من FTP</h2>
              <p>بيانات الاتصال تُستخدم لهذه العملية فقط ولا تُحفظ في المتصفح.</p>
            </div>
            <span className="badge"><ShieldCheck size={14} aria-hidden="true" /> مؤقت</span>
          </div>
          {canManageIngest ? (
            <form onSubmit={handleFtpPull}>
              <div className="archive-toolbar-grid">
                <label>
                  <span>الخادم (Host) *</span>
                  <input type="text" dir="ltr" value={ftpHost} onChange={(e) => setFtpHost(e.target.value)} required autoComplete="off" />
                </label>
                <label>
                  <span>المنفذ</span>
                  <input type="number" dir="ltr" min={1} max={65535} value={ftpPort} onChange={(e) => setFtpPort(e.target.value)} placeholder="21" />
                </label>
                <label>
                  <span>المستخدم *</span>
                  <input type="text" dir="ltr" value={ftpUser} onChange={(e) => setFtpUser(e.target.value)} required autoComplete="off" />
                </label>
                <label>
                  <span>كلمة المرور *</span>
                  <input type="password" dir="ltr" value={ftpPassword} onChange={(e) => setFtpPassword(e.target.value)} required autoComplete="new-password" />
                </label>
                <label>
                  <span>المسار البعيد</span>
                  <input type="text" dir="ltr" value={ftpRemotePath} onChange={(e) => setFtpRemotePath(e.target.value)} placeholder="/" />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <input type="checkbox" checked={ftpSecure} onChange={(e) => setFtpSecure(e.target.checked)} />
                  <span>اتصال آمن (FTPS)</span>
                </label>
              </div>
              <div className="button-row">
                <button type="submit" className="button button-primary" disabled={ftpState.status === "running"}>
                  {ftpState.status === "running" ? "جار السحب..." : "سحب من FTP"}
                </button>
              </div>
            </form>
          ) : (
            <p className="helper-text">لا تملك صلاحية السحب من FTP.</p>
          )}
          <ResultBanner label="السحب من FTP" state={ftpState} />
        </section>

        <section className="panel ingest-operation-panel" data-active={activeSource === "smb" ? "true" : "false"} aria-label="سحب من SMB">
          <div className="panel-title-row">
            <div>
              <h2>سحب من SMB</h2>
              <p>بيانات الاتصال تُستخدم لهذه العملية فقط ولا تُحفظ في المتصفح.</p>
            </div>
            <span className="badge"><KeyRound size={14} aria-hidden="true" /> وصول مقيد</span>
          </div>
          {canManageIngest ? (
            <form onSubmit={handleSmbPull}>
              <div className="archive-toolbar-grid">
                <label>
                  <span>المشاركة (Share) *</span>
                  <input type="text" dir="ltr" value={smbShare} onChange={(e) => setSmbShare(e.target.value)} required autoComplete="off" placeholder="\\server\share" />
                </label>
                <label>
                  <span>المسار داخل المشاركة</span>
                  <input type="text" dir="ltr" value={smbPath} onChange={(e) => setSmbPath(e.target.value)} />
                </label>
                <label>
                  <span>المستخدم *</span>
                  <input type="text" dir="ltr" value={smbUser} onChange={(e) => setSmbUser(e.target.value)} required autoComplete="off" />
                </label>
                <label>
                  <span>كلمة المرور *</span>
                  <input type="password" dir="ltr" value={smbPassword} onChange={(e) => setSmbPassword(e.target.value)} required autoComplete="new-password" />
                </label>
                <label>
                  <span>النطاق (Domain)</span>
                  <input type="text" dir="ltr" value={smbDomain} onChange={(e) => setSmbDomain(e.target.value)} />
                </label>
              </div>
              <div className="button-row">
                <button type="submit" className="button button-primary" disabled={smbState.status === "running"}>
                  {smbState.status === "running" ? "جار السحب..." : "سحب من SMB"}
                </button>
              </div>
            </form>
          ) : (
            <p className="helper-text">لا تملك صلاحية السحب من SMB.</p>
          )}
          <ResultBanner label="السحب من SMB" state={smbState} />
        </section>

        <section className="panel ingest-operation-panel" data-active={activeSource === "dropbox" ? "true" : "false"} aria-label="سحب من Dropbox">
          <div className="panel-title-row">
            <div>
              <h2>سحب من Dropbox</h2>
              <p>يسحب الملفات الجديدة من المجلد المتصل في الإعدادات. الملفات الكبيرة تُنزَّل على دفعات، وتستأنف من آخر جزء وصل بدل إعادة البدء عند انقطاع الاتصال.</p>
            </div>
          </div>
          {canManageIngest ? (
            <div className="button-row">
              <button type="button" className="button button-primary" onClick={handleDropboxPull} disabled={dropboxState.status === "running"}>
                {dropboxState.status === "running" ? "جار السحب..." : "سحب من Dropbox"}
              </button>
              <a className="button button-secondary" href="/settings">إعدادات الاتصال</a>
            </div>
          ) : (
            <p className="helper-text">لا تملك صلاحية السحب من Dropbox.</p>
          )}
          <ResultBanner label="السحب من Dropbox" state={dropboxState} />
        </section>
      </div>
    </AppShell>
  );
}
