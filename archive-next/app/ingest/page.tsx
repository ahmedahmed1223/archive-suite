"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Cloud, FolderSearch, KeyRound, Network, Server, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useCapability } from "@/components/RoleGate";
import { OperationalPage } from "@/components/operations/OperationalPage";
import { StateNotice } from "@/components/operations/StateNotice";
import { createArchiveApiClient, type WatchedIngestBatch } from "@/lib/archive-api";
import type { AppDictionary } from "@/lib/i18n/dictionaries";
import "./ingest.css";

type PullResult = { ingested: number; skipped: number };

type OperationState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; result: PullResult; phase?: "preview" | "applied" }
  | { status: "error"; message: string };

type IngestSource = "scan" | "watched" | "ftp" | "smb" | "dropbox";
type IngestStage = "source" | "inventory" | "metadata" | "processing" | "review";

function operationStatusLabel(state: OperationState, tt: AppDictionary["pages"]["ingest"]) {
  if (state.status === "running") return tt.runningLabel;
  if (state.status === "success" && state.phase === "preview") return tt.watchedPreviewReady;
  if (state.status === "success") return tt.ingestedCount.replace("{count}", String(state.result.ingested));
  if (state.status === "error") return tt.needsReviewLabel;
  return tt.readyLabel;
}

function operationTone(state: OperationState) {
  if (state.status === "success") return "success";
  if (state.status === "error") return "danger";
  if (state.status === "running") return "warning";
  return "info";
}

function ResultBanner({
  label,
  state,
  tt
}: Readonly<{ label: string; state: OperationState; tt: AppDictionary["pages"]["ingest"] }>) {
  if (state.status === "success") {
    if (state.phase === "preview") {
      return <div className="state-banner state-banner-info" role="status"><strong>{tt.watchedPreviewReady}</strong></div>;
    }
    return (
      <div className="state-banner state-banner-success" role="status">
        <strong>{tt.completedLabel.replace("{label}", label)}</strong>
        <span className="helper-text">
          {tt.resultSummary.replace("{ingested}", String(state.result.ingested)).replace("{skipped}", String(state.result.skipped))}
        </span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <StateNotice
        state="error"
        title={tt.failedLabel.replace("{label}", label)}
        description={state.message}
      />
    );
  }

  return null;
}

export default function IngestPage() {
  const { t } = useLocale();
  const ti = t.pages.ingest;
  const api = useMemo(() => createArchiveApiClient(), []);
  const canManageIngest = useCapability("ingest.manage");

  const [scanState, setScanState] = useState<OperationState>({ status: "idle" });
  const [watchedState, setWatchedState] = useState<OperationState>({ status: "idle" });
  const [watchedBatch, setWatchedBatch] = useState<WatchedIngestBatch | null>(null);
  const [activeSource, setActiveSource] = useState<IngestSource>("scan");
  const [activeStage, setActiveStage] = useState<IngestStage>("source");

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
        setState({ status: "error", message: response.error || ti.genericOperationError });
      }
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : ti.genericOperationError });
    }
  };

  const handleScan = () => void runOperation(setScanState, () => api.ingestScan());

  const updateWatchedState = (batch: WatchedIngestBatch, phase: "preview" | "applied") => {
    setWatchedBatch(batch);
    setWatchedState({
      status: "success",
      result: {
        ingested: batch.entries.filter((entry) => entry.status === "applied").length,
        skipped: batch.entries.filter((entry) => entry.status === "deferred" || entry.status === "quarantined").length
      },
      phase
    });
  };

  const handleWatchedPreview = () => void (async () => {
    setWatchedState({ status: "running" });
    try {
      const response = await api.previewWatchedIngest();
      if (!response.ok) return setWatchedState({ status: "error", message: response.error || ti.watchedPreviewError });
      updateWatchedState(response.batch, "preview");
    } catch (error) {
      setWatchedState({ status: "error", message: error instanceof Error ? error.message : ti.watchedPreviewError });
    }
  })();

  const handleWatchedApply = () => void (async () => {
    if (!watchedBatch) return;
    setWatchedState({ status: "running" });
    try {
      const response = await api.applyWatchedIngestBatch(watchedBatch.id);
      if (!response.ok) return setWatchedState({ status: "error", message: response.error || ti.watchedApplyError });
      updateWatchedState(response.batch, "applied");
    } catch (error) {
      setWatchedState({ status: "error", message: error instanceof Error ? error.message : ti.watchedApplyError });
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
  const activeSourceState = sourceStates[activeSource];
  const activeSourceCreatedRecords = activeSourceState.status === "success" && activeSourceState.phase !== "preview" && activeSourceState.result.ingested > 0;
  const batchMaterialCount = watchedBatch?.entries.length ?? 0;
  const batchAcceptedCount = watchedBatch?.entries.filter((entry) => entry.status === "applied").length ?? 0;
  const batchReviewCount = watchedBatch?.entries.filter((entry) => entry.status === "deferred" || entry.status === "quarantined").length ?? 0;
  const stageDescriptions: Record<IngestStage, string> = {
    source: ti.workspace.stageDescriptions.source,
    inventory: watchedBatch ? ti.workspace.stageDescriptions.inventoryReady : ti.workspace.stageDescriptions.inventory,
    metadata: ti.workspace.stageDescriptions.metadata,
    processing: ti.workspace.stageDescriptions.processing,
    review: ti.workspace.stageDescriptions.review
  };

  return (
    <AppShell subtitle={t.pageTitles.importContent} navLabel={t.pageTitles.import} contentClassName="observability-content" tipsPage="ingest">
      <OperationalPage
        eyebrow={<span className="badge">{ti.eyebrowLabel}</span>}
        title={ti.pageTitle}
        description={ti.pageDescription}
        status={<span className="badge">{isAnyRunning ? ti.operationInProgressLabel : ti.readyLabel}</span>}
        actionsLabel={ti.workflow.actionsLabel}
        secondaryActions={(
          <>
            <a className="button button-secondary" href="/files">{ti.filesBrowserLink}</a>
            <a className="button button-secondary" href="/media/jobs">{ti.workflow.jobsLink}</a>
          </>
        )}
        contentLabel={ti.pageTitle}
      >
        <section className="ingest-batch-workspace" aria-label={ti.workspace.ariaLabel}>
          <div className="ingest-batch-workspace__main">
            <div className="ingest-source-tabs" role="group" aria-label={ti.sourceTabsAriaLabel}>
              {(Object.keys(ti.sourceLabels) as IngestSource[]).map((source) => (
                <button
                  key={source}
                  type="button"
                  className="badge"
                  data-active={activeSource === source ? "true" : "false"}
                  onClick={() => { setActiveSource(source); setActiveStage("source"); }}
                >
                  {ti.sourceLabels[source]}
                  <span>{operationStatusLabel(sourceStates[source], ti)}</span>
                </button>
              ))}
            </div>

            <ol className="ingest-workflow-stages" aria-label={ti.workflow.ariaLabel}>
              {(Object.keys(ti.workspace.stages) as IngestStage[]).map((stage) => {
                const complete = stage === "source"
                  ? activeSourceState.status === "success"
                  : stage === "inventory"
                    ? watchedBatch !== null
                    : stage === "metadata"
                      ? activeSourceCreatedRecords
                      : false;
                const blocked = stage === "source" && activeSourceState.status === "error";
                return (
                  <li key={stage} data-state={blocked ? "blocked" : complete ? "complete" : activeStage === stage ? "current" : "pending"}>
                    <button type="button" onClick={() => setActiveStage(stage)} aria-current={activeStage === stage ? "step" : undefined}>
                      <strong>{ti.workspace.stages[stage]}</strong>
                    </button>
                    {stage === "source" && <span>{ti.workflow.receive}: {activeSourceState.status === "running"
                      ? ti.workflow.sourceRunning
                      : activeSourceState.status === "success"
                        ? ti.workflow.sourceCompleted
                        : activeSourceState.status === "error"
                          ? ti.workflow.sourceNeedsReview
                          : ti.workflow.sourceSelected.replace("{source}", ti.sourceLabels[activeSource])}</span>}
                    {stage === "inventory" && <span>{activeSourceCreatedRecords ? ti.workflow.recordCreated : ti.workflow.recordPending}</span>}
                    {stage === "processing" && <span>{ti.workflow.technicalPending}</span>}
                    {stage === "review" && <span>{ti.workflow.reviewPending}</span>}
                  </li>
                );
              })}
            </ol>

            <div className="ingest-current-stage" role="region" aria-label={ti.workspace.currentStageAriaLabel}>
              <strong>{ti.workspace.stages[activeStage]}</strong>
              <p>{stageDescriptions[activeStage]}</p>
              {activeStage === "processing" && <a className="button button-secondary" href="/media/jobs">{ti.workflow.jobsLink}</a>}
            </div>
          </div>

          <aside className="ingest-batch-context" aria-label={ti.workspace.contextAriaLabel}>
            <span>{ti.workspace.batchLabel}</span>
            <strong>{watchedBatch?.id ?? ti.workspace.noBatch}</strong>
            <dl>
              <div><dt>{ti.workspace.sourceLabel}</dt><dd>{ti.sourceLabels[activeSource]}</dd></div>
              <div><dt>{ti.workspace.materialsLabel}</dt><dd>{ti.workspace.materialCount.replace("{count}", String(batchMaterialCount))}</dd></div>
              <div><dt>{ti.workspace.acceptedLabel}</dt><dd>{ti.workspace.acceptedCount.replace("{count}", String(batchAcceptedCount))}</dd></div>
              <div><dt>{ti.workspace.reviewLabel}</dt><dd>{ti.workspace.reviewCount.replace("{count}", String(batchReviewCount))}</dd></div>
            </dl>
          </aside>
        </section>

      <section className="ingest-overview-grid" aria-label={ti.overviewAriaLabel}>
        <article className="health-metric" data-tone={operationTone(scanState)}>
          <span className="health-metric__icon" aria-hidden="true"><FolderSearch size={20} /></span>
          <div className="health-metric__body">
            <span>{ti.sourceLabels.scan}</span>
            <strong>{operationStatusLabel(scanState, ti)}</strong>
            <small>{ti.scanHint}</small>
          </div>
        </article>
        <article className="health-metric" data-tone={operationTone(watchedState)}>
          <span className="health-metric__icon" aria-hidden="true"><FolderSearch size={20} /></span>
          <div className="health-metric__body">
            <span>{ti.sourceLabels.watched}</span>
            <strong>{operationStatusLabel(watchedState, ti)}</strong>
            <small>{ti.watchedHint}</small>
          </div>
        </article>
        <article className="health-metric" data-tone={operationTone(ftpState)}>
          <span className="health-metric__icon" aria-hidden="true"><Network size={20} /></span>
          <div className="health-metric__body">
            <span>{ti.sourceLabels.ftp}</span>
            <strong>{operationStatusLabel(ftpState, ti)}</strong>
            <small>{ti.ftpHint}</small>
          </div>
        </article>
        <article className="health-metric" data-tone={operationTone(smbState)}>
          <span className="health-metric__icon" aria-hidden="true"><Server size={20} /></span>
          <div className="health-metric__body">
            <span>{ti.sourceLabels.smb}</span>
            <strong>{operationStatusLabel(smbState, ti)}</strong>
            <small>{ti.smbHint}</small>
          </div>
        </article>
        <article className="health-metric" data-tone={operationTone(dropboxState)}>
          <span className="health-metric__icon" aria-hidden="true"><Cloud size={20} /></span>
          <div className="health-metric__body">
            <span>{ti.sourceLabels.dropbox}</span>
            <strong>{operationStatusLabel(dropboxState, ti)}</strong>
            <small>{ti.dropboxHint}</small>
          </div>
        </article>
      </section>

      <div className="state-banner state-banner-info" role="note">
        <strong>{ti.preflightTitle}</strong>
        <span className="helper-text">{ti.preflightDescription}</span>
      </div>

      <section className="panel ingest-operation-panel" data-active={activeSource === "scan" ? "true" : "false"} aria-label={ti.scanPanelAriaLabel}>
        <div className="panel-title-row">
          <div>
            <h2>{ti.scanPanelTitle}</h2>
            <p>{ti.scanPanelDescription}</p>
          </div>
          {canManageIngest && (
            <button type="button" className="button button-primary" onClick={handleScan} disabled={scanState.status === "running"}>
              {scanState.status === "running" ? ti.scanRunningButton : ti.scanStartButton}
            </button>
          )}
        </div>
        {!canManageIngest && <p className="helper-text">{ti.scanNoPermission}</p>}
        <ResultBanner label={ti.scanPanelTitle} state={scanState} tt={ti} />
      </section>

      <section className="panel ingest-operation-panel" data-active={activeSource === "watched" ? "true" : "false"} aria-label={ti.watchedPanelAriaLabel}>
        <div className="panel-title-row">
          <div>
            <h2>{ti.watchedPanelTitle}</h2>
            <p>{ti.watchedPanelDescription}</p>
          </div>
          {canManageIngest && (
            <div className="button-row">
              <button type="button" className="button button-secondary" onClick={handleWatchedPreview} disabled={watchedState.status === "running"}>{ti.previewBatchButton}</button>
              <button type="button" className="button button-primary" onClick={handleWatchedApply} disabled={watchedState.status === "running" || watchedBatch?.status !== "pending"}>{ti.approveIngestButton}</button>
            </div>
          )}
        </div>
        {!canManageIngest && <p className="helper-text">{ti.watchedNoPermission}</p>}
        <ResultBanner label={ti.watchedPanelTitle} state={watchedState} tt={ti} />
        {watchedState.status === "success" && watchedState.phase === "applied" && watchedState.result.ingested === 0 && <p className="helper-text" role="status">{ti.watchedAppliedEmpty}</p>}
        {watchedBatch && (
          <>
            {watchedBatch.entries.length === 0 ? (
              <StateNotice state="empty" title={ti.workflow.watchedEmptyTitle} description={ti.workflow.watchedEmptyDescription} />
            ) : (
              <div className="table-wrap" aria-live="polite">
                <table>
                  <thead><tr><th>{ti.tableHeaders.file}</th><th>{ti.tableHeaders.status}</th><th>{ti.tableHeaders.routingRule}</th><th>{ti.tableHeaders.stagingDestination}</th><th>{ti.tableHeaders.reviewReason}</th></tr></thead>
                  <tbody>{watchedBatch.entries.map((entry) => <tr key={entry.id}><td>{entry.fileName}</td><td>{entry.status}</td><td>{entry.routing?.metadataTemplateId || ti.defaultValue}</td><td>{entry.routing?.stagingDirectory || "ingest/watched/accepted"}</td><td>{entry.reason || ti.readyLabel}</td></tr>)}</tbody>
                </table>
              </div>
            )}
            {watchedBatch.entries.some((entry) => entry.status === "deferred" || entry.status === "quarantined") && (
              <StateNotice state="conflict" title={ti.workflow.watchedPartialTitle} description={ti.workflow.watchedPartialDescription} />
            )}
          </>
        )}
      </section>

      <div className="analytics-columns">
        <section className="panel ingest-operation-panel" data-active={activeSource === "ftp" ? "true" : "false"} aria-label={ti.ftpPanelAriaLabel}>
          <div className="panel-title-row">
            <div>
              <h2>{ti.ftpPanelTitle}</h2>
              <p>{ti.connectionNotStoredHint}</p>
            </div>
            <span className="badge"><ShieldCheck size={14} aria-hidden="true" /> {ti.temporaryBadge}</span>
          </div>
          {canManageIngest ? (
            <form onSubmit={handleFtpPull}>
              <div className="archive-toolbar-grid">
                <label>
                  <span>{ti.hostLabel}</span>
                  <input type="text" dir="ltr" value={ftpHost} onChange={(e) => setFtpHost(e.target.value)} required autoComplete="off" />
                </label>
                <label>
                  <span>{ti.portLabel}</span>
                  <input type="number" dir="ltr" min={1} max={65535} value={ftpPort} onChange={(e) => setFtpPort(e.target.value)} placeholder="21" />
                </label>
                <label>
                  <span>{ti.userLabel}</span>
                  <input type="text" dir="ltr" value={ftpUser} onChange={(e) => setFtpUser(e.target.value)} required autoComplete="off" />
                </label>
                <label>
                  <span>{ti.passwordLabel}</span>
                  <input type="password" dir="ltr" value={ftpPassword} onChange={(e) => setFtpPassword(e.target.value)} required autoComplete="new-password" />
                </label>
                <label>
                  <span>{ti.remotePathLabel}</span>
                  <input type="text" dir="ltr" value={ftpRemotePath} onChange={(e) => setFtpRemotePath(e.target.value)} placeholder="/" />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <input type="checkbox" checked={ftpSecure} onChange={(e) => setFtpSecure(e.target.checked)} />
                  <span>{ti.secureConnectionLabel}</span>
                </label>
              </div>
              <div className="button-row">
                <button type="submit" className="button button-primary" disabled={ftpState.status === "running"}>
                  {ftpState.status === "running" ? ti.pullingButton : ti.ftpPullButton}
                </button>
              </div>
            </form>
          ) : (
            <p className="helper-text">{ti.ftpNoPermission}</p>
          )}
          <ResultBanner label={ti.ftpPullButton} state={ftpState} tt={ti} />
        </section>

        <section className="panel ingest-operation-panel" data-active={activeSource === "smb" ? "true" : "false"} aria-label={ti.smbPanelAriaLabel}>
          <div className="panel-title-row">
            <div>
              <h2>{ti.smbPanelTitle}</h2>
              <p>{ti.connectionNotStoredHint}</p>
            </div>
            <span className="badge"><KeyRound size={14} aria-hidden="true" /> {ti.restrictedAccessBadge}</span>
          </div>
          {canManageIngest ? (
            <form onSubmit={handleSmbPull}>
              <div className="archive-toolbar-grid">
                <label>
                  <span>{ti.shareLabel}</span>
                  <input type="text" dir="ltr" value={smbShare} onChange={(e) => setSmbShare(e.target.value)} required autoComplete="off" placeholder="\\server\share" />
                </label>
                <label>
                  <span>{ti.pathInShareLabel}</span>
                  <input type="text" dir="ltr" value={smbPath} onChange={(e) => setSmbPath(e.target.value)} />
                </label>
                <label>
                  <span>{ti.userLabel}</span>
                  <input type="text" dir="ltr" value={smbUser} onChange={(e) => setSmbUser(e.target.value)} required autoComplete="off" />
                </label>
                <label>
                  <span>{ti.passwordLabel}</span>
                  <input type="password" dir="ltr" value={smbPassword} onChange={(e) => setSmbPassword(e.target.value)} required autoComplete="new-password" />
                </label>
                <label>
                  <span>{ti.domainLabel}</span>
                  <input type="text" dir="ltr" value={smbDomain} onChange={(e) => setSmbDomain(e.target.value)} />
                </label>
              </div>
              <div className="button-row">
                <button type="submit" className="button button-primary" disabled={smbState.status === "running"}>
                  {smbState.status === "running" ? ti.pullingButton : ti.smbPullButton}
                </button>
              </div>
            </form>
          ) : (
            <p className="helper-text">{ti.smbNoPermission}</p>
          )}
          <ResultBanner label={ti.smbPullButton} state={smbState} tt={ti} />
        </section>

        <section className="panel ingest-operation-panel" data-active={activeSource === "dropbox" ? "true" : "false"} aria-label={ti.dropboxPanelAriaLabel}>
          <div className="panel-title-row">
            <div>
              <h2>{ti.dropboxPanelTitle}</h2>
              <p>{ti.dropboxPanelDescription}</p>
            </div>
          </div>
          {canManageIngest ? (
            <div className="button-row">
              <button type="button" className="button button-primary" onClick={handleDropboxPull} disabled={dropboxState.status === "running"}>
                {dropboxState.status === "running" ? ti.pullingButton : ti.dropboxPullButton}
              </button>
              <a className="button button-secondary" href="/settings">{ti.connectionSettingsLink}</a>
            </div>
          ) : (
            <p className="helper-text">{ti.dropboxNoPermission}</p>
          )}
          <ResultBanner label={ti.dropboxPullButton} state={dropboxState} tt={ti} />
        </section>
      </div>
      </OperationalPage>
    </AppShell>
  );
}
