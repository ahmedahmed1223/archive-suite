"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient } from "@/lib/archive-api";

type PullResult = { ingested: number; skipped: number };

type OperationState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; result: PullResult }
  | { status: "error"; message: string };

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
  const api = useMemo(() => createArchiveApiClient(), []);

  const [scanState, setScanState] = useState<OperationState>({ status: "idle" });

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

  const isAnyRunning = scanState.status === "running" || ftpState.status === "running" || smbState.status === "running";

  return (
    <AppShell subtitle="استيراد المحتوى" navLabel="الاستيراد" contentClassName="observability-content">
      <PageToolbar
        eyebrow={<span className="badge">Ingest Operations</span>}
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
      />

      <section className="panel" aria-label="فحص مجلد الاستيراد">
        <div className="panel-title-row">
          <div>
            <h2>فحص مجلد الاستيراد</h2>
            <p>يفحص مجلد الاستيراد على الخادم ويُنشئ سجلات أرشيف للملفات الجديدة.</p>
          </div>
          <button type="button" className="button button-primary" onClick={handleScan} disabled={scanState.status === "running"}>
            {scanState.status === "running" ? "جار الفحص..." : "بدء الفحص"}
          </button>
        </div>
        <ResultBanner label="فحص مجلد الاستيراد" state={scanState} />
      </section>

      <div className="analytics-columns">
        <section className="panel" aria-label="سحب من FTP">
          <div className="panel-title-row">
            <div>
              <h2>سحب من FTP</h2>
              <p>بيانات الاتصال تُستخدم لهذه العملية فقط ولا تُحفظ في المتصفح.</p>
            </div>
          </div>
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
          <ResultBanner label="السحب من FTP" state={ftpState} />
        </section>

        <section className="panel" aria-label="سحب من SMB">
          <div className="panel-title-row">
            <div>
              <h2>سحب من SMB</h2>
              <p>بيانات الاتصال تُستخدم لهذه العملية فقط ولا تُحفظ في المتصفح.</p>
            </div>
          </div>
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
          <ResultBanner label="السحب من SMB" state={smbState} />
        </section>
      </div>
    </AppShell>
  );
}
