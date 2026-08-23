"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArchiveRestore, LockKeyhole, RefreshCw, ServerCog, ShieldCheck, Trash2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import PageToolbar from "@/components/PageToolbar";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/Dialog";
import { createArchiveApiClient, type SystemControlAction, type SystemControlResult } from "@/lib/archive-api";
import { formatKvValue } from "@/lib/kv-format";

type GateState =
  | { status: "loading" }
  | { status: "enabled" }
  | { status: "disabled" }
  | { status: "forbidden" }
  | { status: "error"; message: string };

type ActionState =
  | { status: "idle" }
  | { status: "running"; action: SystemControlAction }
  | { status: "success"; action: SystemControlAction; result: SystemControlResult }
  | { status: "error"; action: SystemControlAction; message: string };

export default function SystemControlPage() {
  const { t } = useLocale();
  const ACTIONS: { id: SystemControlAction; label: string; description: string; audit: string; icon: typeof Trash2 }[] = [
    {
      id: "clear-cache",
      label: t.pages.systemControl.actions.clearCache.label,
      description: t.pages.systemControl.actions.clearCache.description,
      audit: t.pages.systemControl.actions.clearCache.audit,
      icon: Trash2
    },
    {
      id: "run-backup",
      label: t.pages.systemControl.actions.runBackup.label,
      description: t.pages.systemControl.actions.runBackup.description,
      audit: t.pages.systemControl.actions.runBackup.audit,
      icon: ArchiveRestore
    }
  ];

  function gateLabel(status: GateState["status"]) {
    return t.pages.systemControl.gateStatusLabels[status];
  }

  const [gate, setGate] = useState<GateState>({ status: "loading" });
  const [actionState, setActionState] = useState<ActionState>({ status: "idle" });
  const [isClearCacheConfirmOpen, setIsClearCacheConfirmOpen] = useState(false);
  const apiRef = useRef(createArchiveApiClient());

  // Probe the gate by attempting a harmless status read; the definitive,
  // server-side enforcement lives in SystemControlService — this page only
  // reflects that state, it never enables anything on its own.
  const loadGate = useCallback(async () => {
    setGate({ status: "loading" });
    try {
      const response = await apiRef.current.systemStatus();
      if (!response.ok) {
        // ponytail: `error === "Forbidden."` is a transitional fallback for
        // an older API that predates the `code` field — drop once the API
        // is guaranteed to always send `code`.
        if (response.code === "FORBIDDEN" || response.error === "Forbidden.") {
          setGate({ status: "forbidden" });
          return;
        }
        setGate({ status: "error", message: response.error || t.pages.systemControl.statusCheckFallbackError });
        return;
      }
      // systemStatus succeeding only confirms admin access; the actual
      // enabled/disabled gate is discovered on first action attempt below,
      // since there is no separate "is control enabled" read endpoint.
      setGate({ status: "enabled" });
    } catch (error) {
      setGate({ status: "error", message: error instanceof Error ? error.message : t.pages.systemControl.unknownError });
    }
  }, [t]);

  useEffect(() => {
    void loadGate();
  }, [loadGate]);

  const runAction = async (action: SystemControlAction) => {
    setActionState({ status: "running", action });
    try {
      const response = await apiRef.current.runSystemControlAction(action);
      if (!response.ok) {
        // ponytail: `error === "..."` is a transitional fallback for an
        // older API that predates the `code` field — drop once the API is
        // guaranteed to always send `code`.
        if (response.code === "SYSTEM_CONTROL_DISABLED" || response.error === "System control actions are disabled.") {
          setGate({ status: "disabled" });
        }
        setActionState({ status: "error", action, message: response.error || t.pages.systemControl.actionRunFallbackError });
        return;
      }
      setActionState({ status: "success", action, result: response.result });
    } catch (error) {
      setActionState({ status: "error", action, message: error instanceof Error ? error.message : t.pages.systemControl.unknownError });
    }
  };

  const isDisabledGate = gate.status === "disabled";
  const clearCacheDisabled = gate.status !== "enabled" || actionState.status === "running";

  const requestAction = (action: SystemControlAction) => {
    if (action === "clear-cache") {
      setIsClearCacheConfirmOpen(true);
      return;
    }
    void runAction(action);
  };

  return (
    <AppShell subtitle={t.pageTitles.systemControl} navLabel={t.pageTitles.systemControl} contentClassName="observability-content" tipsPage="system-control">
      <PageToolbar
        icon={<ServerCog size={24} />}
        eyebrow={<span className="badge badge-danger">{t.pages.systemControl.highRiskBadge}</span>}
        title={t.pages.systemControl.pageTitle}
        description={t.pages.systemControl.pageDescription}
        meta={
          <>
            <span className={gate.status === "enabled" ? "badge badge-success" : "badge badge-warning"}>{gateLabel(gate.status)}</span>
            <span className="badge">{t.pages.systemControl.auditEnforcedBadge}</span>
          </>
        }
        actions={
          <button type="button" className="button button-secondary" onClick={() => void loadGate()} disabled={gate.status === "loading"}>
            <RefreshCw size={16} aria-hidden="true" />
            {t.pages.systemControl.refreshButton}
          </button>
        }
      />

      <section className="control-gate-grid" aria-label={t.pages.systemControl.gateStatusSectionLabel}>
        <article className="system-health-strip" data-tone={gate.status === "enabled" ? "success" : "danger"}>
          <span className="system-health-strip__icon" aria-hidden="true">
            {gate.status === "enabled" ? <ShieldCheck size={20} /> : <LockKeyhole size={20} />}
          </span>
          <div>
            <strong>{gateLabel(gate.status)}</strong>
            <p>{gate.status === "enabled" ? t.pages.systemControl.gateAvailableNote : t.pages.systemControl.gateRestrictedNote}</p>
          </div>
        </article>
        <article className="system-health-strip" data-tone="danger">
          <span className="system-health-strip__icon" aria-hidden="true">
            <AlertTriangle size={20} />
          </span>
          <div>
            <strong>{t.pages.systemControl.sensitiveScopeTitle}</strong>
            <p>{t.pages.systemControl.sensitiveScopeNote}</p>
          </div>
        </article>
      </section>

      {gate.status === "forbidden" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{t.pages.systemControl.forbiddenTitle}</strong>
          <p>{t.pages.systemControl.forbiddenNote}</p>
        </div>
      ) : null}

      {gate.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{t.pages.systemControl.statusErrorTitle}</strong>
          <p>{gate.message}</p>
        </div>
      ) : null}

      {isDisabledGate ? (
        <div className="state-banner state-banner-error" role="alert" data-testid="system-control-disabled-banner">
          <strong>{t.pages.systemControl.disabledTitle}</strong>
          <p>{t.pages.systemControl.disabledNote}</p>
        </div>
      ) : null}

      {actionState.status === "success" ? (
        <div className="state-banner state-banner-success" role="status">
          <strong>{t.pages.systemControl.successTitle.replace("{action}", actionState.result.action)}</strong>
          {Object.keys(actionState.result.detail).length > 0 ? (
            <div className="kv-grid">
              {Object.entries(actionState.result.detail).map(([key, value]) => (
                <div className="kv-item" key={key}>
                  <strong>{key}</strong>
                  <span dir="auto">{formatKvValue(value, t.pages.systemControl.detailNotAvailable)}</span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="button-row">
            <a className="button button-secondary" href="/status">{t.pages.systemControl.checkResultLink}</a>
            <a className="button button-secondary" href="/first-run">{t.pages.systemControl.continueOnboardingLink}</a>
          </div>
        </div>
      ) : null}

      {actionState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{t.pages.systemControl.actionErrorTitle}</strong>
          <p>{actionState.message}</p>
          <a className="button button-secondary" href="/status">{t.pages.systemControl.reviewStatusLink}</a>
        </div>
      ) : null}

      <section className="panel" aria-label={t.pages.systemControl.actionsSectionLabel}>
        <div className="panel-title-row">
          <div>
            <h2>{t.pages.systemControl.availableActionsHeading}</h2>
            <p>{t.pages.systemControl.availableActionsNote}</p>
          </div>
        </div>
        <div className="system-action-grid">
          {ACTIONS.map((action) => {
            const isRunning = actionState.status === "running" && actionState.action === action.id;
            const disallowed = gate.status !== "enabled" || actionState.status === "running";
            const Icon = action.icon;

            return (
              <article key={action.id} className="system-action-card" data-disabled={disallowed ? "true" : "false"}>
                <div className="system-action-card__header">
                  <span aria-hidden="true"><Icon size={20} /></span>
                  <strong>{action.label}</strong>
                </div>
                <p className="helper-text">{action.description}</p>
                <span className="badge">{action.audit}</span>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => requestAction(action.id)}
                  disabled={disallowed}
                  title={isDisabledGate ? t.pages.systemControl.disabledButtonTitle : action.label}
                >
                  {isRunning ? t.pages.systemControl.runningLabel : t.pages.systemControl.executeLabel}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <Dialog open={isClearCacheConfirmOpen} onOpenChange={setIsClearCacheConfirmOpen}>
        <DialogContent
          className="system-control-confirmation"
          title={t.pages.systemControl.confirmDialogTitle}
          description={t.pages.systemControl.confirmDialogDescription}
        >
          <div className="system-control-confirmation__body">
            <p>{t.pages.systemControl.confirmDialogBody}</p>
            <div className="system-control-confirmation__actions">
              <DialogClose asChild>
                <Button type="button" variant="secondary">{t.pages.systemControl.cancelButton}</Button>
              </DialogClose>
              <Button
                type="button"
                variant="danger"
                disabled={clearCacheDisabled}
                onClick={() => {
                  setIsClearCacheConfirmOpen(false);
                  void runAction("clear-cache");
                }}
              >
                <Trash2 size={16} aria-hidden="true" />
                {t.pages.systemControl.confirmClearButton}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
