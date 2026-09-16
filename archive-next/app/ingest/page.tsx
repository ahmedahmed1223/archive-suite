"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleDashed, KeyRound, Lock, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useCapability } from "@/components/RoleGate";
import { OperationalPage } from "@/components/operations/OperationalPage";
import { StateNotice } from "@/components/operations/StateNotice";
import { ContextPanel } from "@/components/operations/ContextPanel";
import { createArchiveApiClient, type WatchedIngestBatch } from "@/lib/archive-api";
import type { AppDictionary } from "@/lib/i18n/dictionaries";
import {
  canReachStep,
  completePreview,
  createIngestWizardDraft,
  decide,
  goToStep,
  INGEST_STEPS,
  isStepValid,
  nextStep,
  previousStep,
  selectSource,
  setDestinationProjectId,
  setInspectionAcknowledged,
  setRightsConfirmed,
  setSourceConfigured,
  sourceRequiresConfig,
  stepIndex,
  type IngestSourceKind,
  type IngestStep,
  type IngestWizardDraft
} from "@/lib/ingest-wizard";
import "./ingest.css";

type IngestedRecordLink = { id: string; fileName: string };
type PullResult = { ingested: number; skipped: number; records?: IngestedRecordLink[] };

type OperationState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; result: PullResult; phase?: "preview" | "applied" }
  | { status: "error"; message: string };

function ingestedRecordLinks(items: unknown[]): IngestedRecordLink[] {
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as { id?: unknown; fileName?: unknown };
    return typeof candidate.id === "string" && typeof candidate.fileName === "string"
      ? [{ id: candidate.id, fileName: candidate.fileName }]
      : [];
  });
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
        {state.result.records?.length ? (
          <div className="button-row">
            {state.result.records.map((record) => (
              <a key={record.id} className="button button-secondary button-sm" href={`/archive/${encodeURIComponent(record.id)}`}>
                {tt.openRecord.replace("{fileName}", record.fileName)}
              </a>
            ))}
          </div>
        ) : null}
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

function WatchedBatchTable({
  batch,
  emptyTitle,
  tt
}: Readonly<{ batch: WatchedIngestBatch; emptyTitle: string; tt: AppDictionary["pages"]["ingest"] }>) {
  if (batch.entries.length === 0) {
    return <StateNotice state="empty" title={emptyTitle} description={tt.watchedAppliedEmpty} />;
  }
  return (
    <div className="table-wrap" aria-live="polite">
      <table>
        <thead>
          <tr>
            <th>{tt.tableHeaders.file}</th>
            <th>{tt.tableHeaders.status}</th>
            <th>{tt.tableHeaders.routingRule}</th>
            <th>{tt.tableHeaders.stagingDestination}</th>
            <th>{tt.tableHeaders.reviewReason}</th>
          </tr>
        </thead>
        <tbody>
          {batch.entries.map((entry) => (
            <tr key={entry.id}>
              <td>{entry.recordId ? <a href={`/archive/${encodeURIComponent(entry.recordId)}`}>{tt.openRecord.replace("{fileName}", entry.fileName)}</a> : entry.fileName}</td>
              <td>{entry.status}</td>
              <td>{entry.routing?.metadataTemplateId || tt.defaultValue}</td>
              <td>{entry.routing?.stagingDirectory || "ingest/watched/accepted"}</td>
              <td>{entry.reason || tt.readyLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Textual step status -- never conveyed by color alone. */
function stepStatusLabel(step: IngestStep, current: IngestStep, draft: IngestWizardDraft, tt: AppDictionary["pages"]["ingest"]) {
  if (step === current) return tt.wizard.stepStatus.current;
  if (stepIndex(step) < stepIndex(current)) return tt.wizard.stepStatus.complete;
  if (!canReachStep(step, draft)) return tt.wizard.stepStatus.blocked;
  return tt.wizard.stepStatus.pending;
}

export default function IngestPage() {
  const { t } = useLocale();
  const ti = t.pages.ingest;
  const tw = ti.wizard;
  const api = useMemo(() => createArchiveApiClient(), []);
  const canManageIngest = useCapability("ingest.manage");

  const [draft, setDraft] = useState<IngestWizardDraft>(() => createIngestWizardDraft());
  const [step, setStep] = useState<IngestStep>("source");

  const [scanState, setScanState] = useState<OperationState>({ status: "idle" });
  const [watchedState, setWatchedState] = useState<OperationState>({ status: "idle" });
  const [watchedBatch, setWatchedBatch] = useState<WatchedIngestBatch | null>(null);

  // Connection params live in component state only -- never persisted to localStorage.
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
  const [destinationInput, setDestinationInput] = useState("");

  const activeSource = draft.source;

  // Connection-parameter sources become "configured" once their required fields are filled in;
  // sources with nothing to configure are handled by selectSource() itself.
  useEffect(() => {
    if (activeSource === "ftp") {
      setDraft((d) => setSourceConfigured(d, Boolean(ftpHost.trim() && ftpUser.trim() && ftpPassword)));
    } else if (activeSource === "smb") {
      setDraft((d) => setSourceConfigured(d, Boolean(smbShare.trim() && smbUser.trim() && smbPassword)));
    }
  }, [activeSource, ftpHost, ftpUser, ftpPassword, smbShare, smbUser, smbPassword]);

  const runOperation = async (
    setState: (state: OperationState) => void,
    operation: () => Promise<{ ok: true; ingested: unknown[]; skipped: number } | { ok: false; error: string }>
  ) => {
    setState({ status: "running" });
    try {
      const response = await operation();
      if (response.ok) {
        setState({ status: "success", result: { ingested: response.ingested.length, skipped: response.skipped, records: ingestedRecordLinks(response.ingested) } });
        setDraft((d) => completePreview(d));
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
      setDraft((d) => completePreview(d));
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

  const sourceStates: Record<IngestSourceKind, OperationState> = {
    scan: scanState,
    watched: watchedState,
    ftp: ftpState,
    smb: smbState,
    dropbox: dropboxState
  };
  const isAnyRunning = Object.values(sourceStates).some((s) => s.status === "running");
  const activeSourceState = activeSource ? sourceStates[activeSource] : { status: "idle" as const };

  const batchMaterialCount = activeSource === "watched"
    ? (watchedBatch?.entries.length ?? 0)
    : activeSourceState.status === "success" ? activeSourceState.result.ingested + activeSourceState.result.skipped : 0;
  const batchAcceptedCount = activeSource === "watched"
    ? (watchedBatch?.entries.filter((entry) => entry.status === "applied").length ?? 0)
    : activeSourceState.status === "success" ? activeSourceState.result.ingested : 0;
  const batchReviewCount = activeSource === "watched"
    ? (watchedBatch?.entries.filter((entry) => entry.status === "deferred" || entry.status === "quarantined").length ?? 0)
    : activeSourceState.status === "success" ? activeSourceState.result.skipped : 0;

  const handleSelectSource = (source: IngestSourceKind) => {
    setDraft((d) => selectSource(d, source));
    setStep("source");
  };

  const handleStepClick = (target: IngestStep) => {
    if (stepIndex(target) <= stepIndex(step)) {
      setDraft((d) => goToStep(target, d));
      setStep(target);
    } else if (canReachStep(target, draft)) {
      setStep(target);
    }
  };

  const handleNext = () => {
    const target = nextStep(step, draft);
    if (target) setStep(target);
  };

  const handleBack = () => {
    const target = previousStep(step);
    if (target) handleStepClick(target);
  };

  const handleDestinationChange = (value: string) => {
    setDestinationInput(value);
    setDraft((d) => setDestinationProjectId(d, value));
  };

  const handleRightsChange = (checked: boolean) => {
    setDraft((d) => setRightsConfirmed(d, checked));
  };

  const handleInspectionAcknowledgeChange = (checked: boolean) => {
    setDraft((d) => setInspectionAcknowledged(d, checked));
  };

  const handleDecision = (decision: "accept" | "quarantine") => {
    setDraft((d) => decide(d, decision));
  };

  const handleStartOver = () => {
    setDraft(createIngestWizardDraft());
    setDestinationInput("");
    setStep("source");
    setScanState({ status: "idle" });
    setWatchedState({ status: "idle" });
    setWatchedBatch(null);
    setFtpState({ status: "idle" });
    setSmbState({ status: "idle" });
    setDropboxState({ status: "idle" });
  };

  return (
    <AppShell subtitle={t.pageTitles.importContent} navLabel={t.pageTitles.import} contentClassName="observability-content" tipsPage="ingest">
      <OperationalPage
        eyebrow={<span className="badge">{ti.eyebrowLabel}</span>}
        title={ti.pageTitle}
        description={ti.pageDescription}
        status={<span className="badge">{isAnyRunning ? ti.operationInProgressLabel : ti.readyLabel}</span>}
        actionsLabel={tw.ariaLabel}
        secondaryActions={(
          <>
            <a className="button button-secondary" href="/files">{ti.filesBrowserLink}</a>
            <a className="button button-secondary" href="/media/jobs">{tw.inspection.jobsLink}</a>
          </>
        )}
        contentLabel={tw.ariaLabel}
      >
        <p role="status" aria-live="polite" className="ui-visually-hidden">
          {tw.currentStepAnnouncement.replace("{label}", tw.steps[step])}
        </p>

        <section className="ingest-batch-workspace">
        <div className="ingest-batch-workspace__main">
        <ol className="ingest-workflow-stages" aria-label={tw.stepperAriaLabel}>
          {INGEST_STEPS.map((s) => {
            const reachable = canReachStep(s, draft) || stepIndex(s) <= stepIndex(step);
            const statusLabel = stepStatusLabel(s, step, draft, ti);
            const state = s === step ? "current" : stepIndex(s) < stepIndex(step) ? "complete" : reachable ? "pending" : "blocked";
            const StepIcon = state === "complete" ? CheckCircle2 : state === "blocked" ? Lock : CircleDashed;
            return (
              <li key={s} data-state={state}>
                <button
                  type="button"
                  onClick={() => handleStepClick(s)}
                  aria-current={s === step ? "step" : undefined}
                  disabled={!reachable && stepIndex(s) > stepIndex(step)}
                >
                  <StepIcon size={14} aria-hidden="true" />
                  <strong>{tw.steps[s]}</strong>
                </button>
                <span>{statusLabel}</span>
              </li>
            );
          })}
        </ol>

        <div className="ingest-current-stage" role="region" aria-label={tw.currentStepAriaLabel}>
          {step === "source" && (
            <>
              <strong>{tw.source.title}</strong>
              <p>{tw.source.description}</p>
              <div className="ingest-source-tabs" role="group" aria-label={ti.sourceTabsAriaLabel}>
                {(Object.keys(ti.sourceLabels) as IngestSourceKind[]).map((source) => (
                  <button
                    key={source}
                    type="button"
                    className="badge"
                    data-active={activeSource === source ? "true" : "false"}
                    onClick={() => handleSelectSource(source)}
                  >
                    {ti.sourceLabels[source]}
                  </button>
                ))}
              </div>

              {activeSource === "ftp" && (
                <div className="archive-toolbar-grid">
                  <label>
                    <span>{ti.hostLabel}</span>
                    <input type="text" dir="ltr" value={ftpHost} onChange={(e) => setFtpHost(e.target.value)} autoComplete="off" />
                  </label>
                  <label>
                    <span>{ti.portLabel}</span>
                    <input type="number" dir="ltr" min={1} max={65535} value={ftpPort} onChange={(e) => setFtpPort(e.target.value)} placeholder="21" />
                  </label>
                  <label>
                    <span>{ti.userLabel}</span>
                    <input type="text" dir="ltr" value={ftpUser} onChange={(e) => setFtpUser(e.target.value)} autoComplete="off" />
                  </label>
                  <label>
                    <span>{ti.passwordLabel}</span>
                    <input type="password" dir="ltr" value={ftpPassword} onChange={(e) => setFtpPassword(e.target.value)} autoComplete="new-password" />
                  </label>
                  <label>
                    <span>{ti.remotePathLabel}</span>
                    <input type="text" dir="ltr" value={ftpRemotePath} onChange={(e) => setFtpRemotePath(e.target.value)} placeholder="/" />
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <input type="checkbox" checked={ftpSecure} onChange={(e) => setFtpSecure(e.target.checked)} />
                    <span>{ti.secureConnectionLabel}</span>
                  </label>
                  <p className="helper-text">{ti.connectionNotStoredHint}</p>
                </div>
              )}

              {activeSource === "smb" && (
                <div className="archive-toolbar-grid">
                  <label>
                    <span>{ti.shareLabel}</span>
                    <input type="text" dir="ltr" value={smbShare} onChange={(e) => setSmbShare(e.target.value)} autoComplete="off" placeholder="\\server\share" />
                  </label>
                  <label>
                    <span>{ti.pathInShareLabel}</span>
                    <input type="text" dir="ltr" value={smbPath} onChange={(e) => setSmbPath(e.target.value)} />
                  </label>
                  <label>
                    <span>{ti.userLabel}</span>
                    <input type="text" dir="ltr" value={smbUser} onChange={(e) => setSmbUser(e.target.value)} autoComplete="off" />
                  </label>
                  <label>
                    <span>{ti.passwordLabel}</span>
                    <input type="password" dir="ltr" value={smbPassword} onChange={(e) => setSmbPassword(e.target.value)} autoComplete="new-password" />
                  </label>
                  <label>
                    <span>{ti.domainLabel}</span>
                    <input type="text" dir="ltr" value={smbDomain} onChange={(e) => setSmbDomain(e.target.value)} />
                  </label>
                  <p className="helper-text">{ti.connectionNotStoredHint}</p>
                </div>
              )}

              {activeSource === "dropbox" && <p className="helper-text">{ti.dropboxPanelDescription}</p>}
              {activeSource === "watched" && <p className="helper-text">{ti.watchedPanelDescription}</p>}
              {activeSource === "scan" && <p className="helper-text">{ti.scanPanelDescription}</p>}
            </>
          )}

          {step === "preview" && activeSource && (
            <>
              <strong>{tw.preview.title}</strong>
              <p>{activeSource === "watched" ? tw.preview.watchedNotice : tw.preview.noDryRunNotice}</p>

              {activeSource === "scan" && (
                <section aria-label={ti.scanPanelAriaLabel}>
                  {canManageIngest ? (
                    <div className="button-row">
                      <button type="button" className="button button-primary" onClick={handleScan} disabled={scanState.status === "running"}>
                        {scanState.status === "running" ? ti.scanRunningButton : ti.scanStartButton}
                      </button>
                    </div>
                  ) : <p className="helper-text">{ti.scanNoPermission}</p>}
                  <ResultBanner label={ti.scanPanelTitle} state={scanState} tt={ti} />
                </section>
              )}

              {activeSource === "ftp" && (
                <section aria-label={ti.ftpPanelAriaLabel}>
                  <p className="helper-text"><ShieldCheck size={14} aria-hidden="true" /> {ti.temporaryBadge}</p>
                  {canManageIngest ? (
                    <form onSubmit={handleFtpPull}>
                      <div className="button-row">
                        <button type="submit" className="button button-primary" disabled={ftpState.status === "running"}>
                          {ftpState.status === "running" ? ti.pullingButton : ti.ftpPullButton}
                        </button>
                      </div>
                    </form>
                  ) : <p className="helper-text">{ti.ftpNoPermission}</p>}
                  <ResultBanner label={ti.ftpPullButton} state={ftpState} tt={ti} />
                </section>
              )}

              {activeSource === "smb" && (
                <section aria-label={ti.smbPanelAriaLabel}>
                  <p className="helper-text"><KeyRound size={14} aria-hidden="true" /> {ti.restrictedAccessBadge}</p>
                  {canManageIngest ? (
                    <form onSubmit={handleSmbPull}>
                      <div className="button-row">
                        <button type="submit" className="button button-primary" disabled={smbState.status === "running"}>
                          {smbState.status === "running" ? ti.pullingButton : ti.smbPullButton}
                        </button>
                      </div>
                    </form>
                  ) : <p className="helper-text">{ti.smbNoPermission}</p>}
                  <ResultBanner label={ti.smbPullButton} state={smbState} tt={ti} />
                </section>
              )}

              {activeSource === "dropbox" && (
                <section aria-label={ti.dropboxPanelAriaLabel}>
                  {canManageIngest ? (
                    <div className="button-row">
                      <button type="button" className="button button-primary" onClick={handleDropboxPull} disabled={dropboxState.status === "running"}>
                        {dropboxState.status === "running" ? ti.pullingButton : ti.dropboxPullButton}
                      </button>
                      <a className="button button-secondary" href="/settings">{ti.connectionSettingsLink}</a>
                    </div>
                  ) : <p className="helper-text">{ti.dropboxNoPermission}</p>}
                  <ResultBanner label={ti.dropboxPullButton} state={dropboxState} tt={ti} />
                </section>
              )}

              {activeSource === "watched" && (
                <section aria-label={ti.watchedPanelAriaLabel}>
                  {canManageIngest ? (
                    <div className="button-row">
                      <button type="button" className="button button-secondary" onClick={handleWatchedPreview} disabled={watchedState.status === "running"}>{ti.previewBatchButton}</button>
                    </div>
                  ) : <p className="helper-text">{ti.watchedNoPermission}</p>}
                  <ResultBanner label={ti.watchedPanelTitle} state={watchedState} tt={ti} />
                  {watchedBatch && <WatchedBatchTable batch={watchedBatch} emptyTitle={tw.preview.title} tt={ti} />}
                </section>
              )}

              {draft.previewCompleted && <p className="helper-text" role="status">{tw.preview.completeHint}</p>}
            </>
          )}

          {step === "metadata" && (
            <>
              <strong>{tw.metadata.title}</strong>
              <p>{tw.metadata.description}</p>
              <label>
                <span>{tw.metadata.destinationLabel}</span>
                <input
                  type="text"
                  value={destinationInput}
                  onChange={(e) => handleDestinationChange(e.target.value)}
                  placeholder={tw.metadata.destinationPlaceholder}
                />
              </label>
              <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <input type="checkbox" checked={draft.rightsConfirmed} onChange={(e) => handleRightsChange(e.target.checked)} />
                <span>{tw.metadata.rightsLabel}</span>
              </label>
              {!draft.rightsConfirmed && <p className="helper-text">{tw.metadata.rightsHint}</p>}

              {activeSource === "watched" && watchedBatch && (
                <>
                  <p className="helper-text">{tw.metadata.watchedApplyHint}</p>
                  {canManageIngest ? (
                    <div className="button-row">
                      <button
                        type="button"
                        className="button button-primary"
                        onClick={handleWatchedApply}
                        disabled={watchedState.status === "running" || watchedBatch.status !== "pending" || !draft.rightsConfirmed}
                      >
                        {ti.approveIngestButton}
                      </button>
                    </div>
                  ) : <p className="helper-text">{ti.watchedNoPermission}</p>}
                  <ResultBanner label={ti.watchedPanelTitle} state={watchedState} tt={ti} />
                  {watchedState.status === "success" && watchedState.phase === "applied" && (
                    <WatchedBatchTable batch={watchedBatch} emptyTitle={tw.metadata.title} tt={ti} />
                  )}
                </>
              )}
            </>
          )}

          {step === "inspection" && (
            <>
              <strong>{tw.inspection.title}</strong>
              <p>{tw.inspection.description}</p>
              <a className="button button-secondary" href="/media/jobs">{tw.inspection.jobsLink}</a>
              <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={draft.inspectionAcknowledged}
                  onChange={(e) => handleInspectionAcknowledgeChange(e.target.checked)}
                />
                <span>{tw.inspection.acknowledgeLabel}</span>
              </label>
            </>
          )}

          {step === "decision" && (
            <>
              <strong>{tw.decision.title}</strong>
              <p>{tw.decision.description}</p>
              {draft.decision ? (
                <div className={`state-banner ${draft.decision === "accept" ? "state-banner-success" : "state-banner-info"}`} role="status">
                  {draft.decision === "accept" ? <CheckCircle2 size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
                  <strong>{draft.decision === "accept" ? tw.decision.acceptedBanner : tw.decision.quarantinedBanner}</strong>
                </div>
              ) : (
                // Accept and quarantine are equally weighted paths -- neither is styled as the "primary", default choice.
                <div className="button-row">
                  <button type="button" className="button button-secondary" onClick={() => handleDecision("accept")}>
                    <CheckCircle2 size={14} aria-hidden="true" /> {tw.decision.acceptButton}
                  </button>
                  <button type="button" className="button button-secondary" onClick={() => handleDecision("quarantine")}>
                    <Lock size={14} aria-hidden="true" /> {tw.decision.quarantineButton}
                  </button>
                </div>
              )}
              {draft.decision && (
                <div className="button-row">
                  <button type="button" className="button button-secondary" onClick={handleStartOver}>
                    {tw.decision.startOverButton}
                  </button>
                </div>
              )}
            </>
          )}

          <div className="button-row">
            {step !== "source" && (
              <button type="button" className="button button-secondary" onClick={handleBack}>
                {tw.backButton}
              </button>
            )}
            {step !== "decision" && (
              <button type="button" className="button button-primary" onClick={handleNext} disabled={!isStepValid(step, draft)}>
                {tw.nextButton}
              </button>
            )}
          </div>
          {!isStepValid(step, draft) && <p className="helper-text">{tw.stepIncompleteHint}</p>}
        </div>
        </div>

        <ContextPanel title={tw.context.title} presentation="inline">
          <dl aria-label={tw.context.ariaLabel}>
            <div>
              <dt>{tw.context.sourceLabel}</dt>
              <dd>{activeSource ? ti.sourceLabels[activeSource] : tw.context.noSource}</dd>
            </div>
            <div>
              <dt>{tw.context.materialsLabel}</dt>
              <dd>{tw.context.materialCount.replace("{count}", String(batchMaterialCount))}</dd>
            </div>
            <div>
              <dt>{tw.context.acceptedLabel}</dt>
              <dd>{tw.context.acceptedCount.replace("{count}", String(batchAcceptedCount))}</dd>
            </div>
            <div>
              <dt>{tw.context.reviewLabel}</dt>
              <dd>{tw.context.reviewCount.replace("{count}", String(batchReviewCount))}</dd>
            </div>
            <div>
              <dt>{tw.context.decisionLabel}</dt>
              <dd>{draft.decision === "accept" ? tw.decision.acceptedBanner : draft.decision === "quarantine" ? tw.decision.quarantinedBanner : tw.context.decisionPending}</dd>
            </div>
          </dl>
        </ContextPanel>
        </section>
      </OperationalPage>
    </AppShell>
  );
}
