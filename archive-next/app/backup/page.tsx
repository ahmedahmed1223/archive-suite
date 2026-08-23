"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useDisplaySettings } from "@/lib/display-settings-context";
import { formatDateTime } from "@/lib/display-settings";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { useCapability } from "@/components/RoleGate";
import {
  createArchiveApiClient,
  type BackupInfo,
  type BackupPreview,
  type BackupRunResult
} from "@/lib/archive-api";
import { buildBackupFreshness, redactAdminSecrets } from "@/lib/admin-action-summary";
import { Skeleton } from "@/components/ui/Skeleton";

type BackupListState =
  | { status: "loading" }
  | { status: "ready"; backups: BackupInfo[] }
  | { status: "error"; message: string };

type RunState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; backup: BackupRunResult }
  | { status: "error"; message: string };

type PreviewState =
  | { status: "idle" }
  | { status: "loading"; name: string }
  | { status: "ready"; preview: BackupPreview }
  | { status: "error"; message: string };

type RestoreState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; name: string; counts: Record<string, number>; restoredAt: string; verified: boolean }
  | { status: "error"; message: string };

function formatBytes(bytes?: number): string {
  if (bytes === undefined) return "-";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

function formatDate(value: string | undefined, settings: import("@/lib/display-settings").DisplaySettings, locale: import("@/lib/i18n/types").AppLocale) {
  if (!value) return "-";
  return formatDateTime(value, settings, locale, value);
}

export default function BackupPage() {
  const { locale, t } = useLocale();
  const { settings: displaySettings } = useDisplaySettings();
  const api = useMemo(() => createArchiveApiClient(), []);
  const [listState, setListState] = useState<BackupListState>({ status: "loading" });
  const [runState, setRunState] = useState<RunState>({ status: "idle" });
  const [previewState, setPreviewState] = useState<PreviewState>({ status: "idle" });
  const [restoreState, setRestoreState] = useState<RestoreState>({ status: "idle" });
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [restoreConfirmName, setRestoreConfirmName] = useState("");
  const canManageBackup = useCapability("backup.manage");

  const loadBackups = useCallback(async () => {
    setListState({ status: "loading" });
    try {
      const response = await api.listBackups();
      if (response.ok) {
        setListState({ status: "ready", backups: response.backups });
      } else {
        setListState({ status: "error", message: response.error || t.pages.backup.loadErrorMessage });
      }
    } catch (error) {
      setListState({ status: "error", message: error instanceof Error ? error.message : t.pages.backup.loadErrorMessage });
    }
  }, [api, t]);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups]);

  const handleRunBackup = async () => {
    setRunState({ status: "running" });
    try {
      const response = await api.runBackup();
      if (response.ok) {
        setRunState({ status: "success", backup: response.backup });
        await loadBackups();
      } else {
        setRunState({ status: "error", message: response.error || t.pages.backup.runErrorMessage });
      }
    } catch (error) {
      setRunState({ status: "error", message: error instanceof Error ? error.message : t.pages.backup.runErrorMessage });
    }
  };

  const handlePreview = async (name: string) => {
    setPreviewState({ status: "loading", name });
    try {
      const response = await api.previewBackup({ name });
      if (response.ok) {
        setPreviewState({ status: "ready", preview: response.preview });
      } else {
        setPreviewState({ status: "error", message: response.error || t.pages.backup.previewErrorMessage });
      }
    } catch (error) {
      setPreviewState({ status: "error", message: error instanceof Error ? error.message : t.pages.backup.previewErrorMessage });
    }
  };

  const openRestoreDialog = (name: string) => {
    setRestoreTarget(name);
    setRestoreConfirmName("");
    setRestoreState({ status: "idle" });
  };

  const handleRestore = async () => {
    if (!restoreTarget || restoreConfirmName.trim() !== restoreTarget) return;

    setRestoreState({ status: "running" });
    try {
      const response = await api.restoreBackup({ name: restoreTarget });
      if (response.ok) {
        setRestoreState({
          status: "success",
          name: response.result.name,
          counts: response.result.counts,
          restoredAt: response.result.restoredAt,
          verified: response.result.verified
        });
        setRestoreTarget(null);
        setRestoreConfirmName("");
      } else {
        setRestoreState({ status: "error", message: response.error || t.pages.backup.restoreErrorMessage });
      }
    } catch (error) {
      setRestoreState({ status: "error", message: error instanceof Error ? error.message : t.pages.backup.restoreErrorMessage });
    }
  };

  const backups = listState.status === "ready" ? listState.backups : [];
  const totalSize = backups.reduce((sum, backup) => sum + backup.sizeBytes, 0);
  const isRestoreConfirmed = restoreTarget !== null && restoreConfirmName.trim() === restoreTarget;
  const freshness = buildBackupFreshness(backups.map((backup) => backup.createdAt));

  return (
    <AppShell subtitle={t.pageTitles.dataCenter} navLabel={t.pageTitles.backups} contentClassName="observability-content" tipsPage="backup">
      <PageToolbar
        eyebrow={<span className="badge">{t.pages.backup.eyebrow}</span>}
        title={t.pages.backup.title}
        description={t.pages.backup.description}
        meta={(
          <>
            <span className="badge">{backups.length} {t.pages.backup.countSuffix}</span>
            <span className="badge">{formatBytes(totalSize)}</span>
            <span className={`badge badge-${freshness.tone}`}>{freshness.label}</span>
          </>
        )}
        actions={(
          <>
            {canManageBackup ? (
              <button
                type="button"
                className="button button-primary"
                onClick={() => void handleRunBackup()}
                disabled={runState.status === "running"}
              >
                {runState.status === "running" ? t.pages.backup.running : t.pages.backup.runNow}
              </button>
            ) : (
              <span className="helper-text">{t.pages.backup.noPermissionNote}</span>
            )}
            <button type="button" className="button button-secondary" onClick={() => void loadBackups()} disabled={listState.status === "loading"}>
              {t.pages.backup.refresh}
            </button>
          </>
        )}
      />
      {listState.status === "ready" ? <div className="state-banner" role="status"><strong>{freshness.summary}</strong><span className="helper-text">{freshness.detail}</span></div> : null}

      {runState.status === "success" ? (
        <div className="state-banner state-banner-success" role="status">
          <strong>{t.pages.backup.runSuccessTitle}</strong>
          <span className="helper-text">
            {runState.backup.name} · {formatBytes(runState.backup.sizeBytes)} · {formatDate(runState.backup.completedAt, displaySettings, locale)}
          </span>
        </div>
      ) : null}

      {runState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{t.pages.backup.runErrorTitle}</strong>
          <span className="helper-text">{redactAdminSecrets(runState.message)}</span>
        </div>
      ) : null}

      {restoreState.status === "success" ? (
        <div className="state-banner state-banner-success" role="status">
          <strong>{t.pages.backup.restoreSuccessTitle.replace("{name}", restoreState.name)}</strong>
          <span className="helper-text">
            {Object.entries(restoreState.counts)
              .map(([store, count]) => `${store}: ${count}`)
              .join(" · ") || t.pages.backup.noRecords}
            {" — "}
            {formatDate(restoreState.restoredAt, displaySettings, locale)}
          </span>
        </div>
      ) : null}

      {restoreState.status === "success" && !restoreState.verified ? (
        <div className="state-banner state-banner-warning" role="alert">
          <strong>{t.pages.backup.restoreUnverifiedTitle}</strong>
          <span className="helper-text">
            {t.pages.backup.restoreUnverifiedDescription}
          </span>
        </div>
      ) : null}

      {restoreState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{t.pages.backup.restoreErrorTitle}</strong>
          <span className="helper-text">{redactAdminSecrets(restoreState.message)}</span>
        </div>
      ) : null}

      {restoreTarget ? (
        <section className="panel" role="alertdialog" aria-labelledby="restore-dialog-title" aria-describedby="restore-dialog-desc">
          <div className="panel-title-row">
            <div>
              <h2 id="restore-dialog-title">{t.pages.backup.restoreDialogTitle}</h2>
              <p id="restore-dialog-desc">
                {t.pages.backup.restoreDialogDescription.replace("{name}", restoreTarget)}
              </p>
            </div>
            <span className="badge badge-danger">{t.pages.backup.destructiveBadge}</span>
          </div>
          <label>
            <span>{t.pages.backup.confirmNameLabel.replace("{name}", restoreTarget)}</span>
            <input
              type="text"
              dir="ltr"
              value={restoreConfirmName}
              onChange={(e) => setRestoreConfirmName(e.target.value)}
              placeholder={restoreTarget}
              autoComplete="off"
            />
          </label>
          <div className="button-row">
            <button
              type="button"
              className="button button-primary"
              onClick={() => void handleRestore()}
              disabled={!isRestoreConfirmed || restoreState.status === "running"}
            >
              {restoreState.status === "running" ? t.pages.backup.restoring : t.pages.backup.confirmRestoreNow}
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setRestoreTarget(null);
                setRestoreConfirmName("");
              }}
              disabled={restoreState.status === "running"}
            >
              {t.pages.backup.cancel}
            </button>
          </div>
        </section>
      ) : null}

      {previewState.status === "loading" ? (
        <div className="panel panel-compact" role="status" aria-live="polite">
          <p className="form-status">{t.pages.backup.previewingLabel.replace("{name}", previewState.name)}</p>
        </div>
      ) : null}

      {previewState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{t.pages.backup.previewErrorTitle}</strong>
          <span className="helper-text">{redactAdminSecrets(previewState.message)}</span>
        </div>
      ) : null}

      {previewState.status === "ready" ? (
        <section className="panel" aria-label={t.pages.backup.previewAriaLabel}>
          <div className="panel-title-row">
            <div>
              <h2>{t.pages.backup.previewTitle.replace("{name}", previewState.preview.name)}</h2>
              <p>{t.pages.backup.previewDescription}</p>
            </div>
            <span className="badge">{previewState.preview.totalRecords} {t.pages.backup.totalRecordsSuffix}</span>
          </div>
          <div className="analytics-chip-list">
            {Object.entries(previewState.preview.stores).map(([store, count]) => (
              <span key={store} className="badge">
                {store} ({count})
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {listState.status === "loading" ? (
        <div className="panel panel-compact">
          <Skeleton label={t.pages.backup.loadingBackups} />
        </div>
      ) : null}

      {listState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{t.pages.backup.loadErrorTitle}</strong>
          <span className="helper-text">{redactAdminSecrets(listState.message)} — {t.pages.backup.loadErrorAdminOnly}</span>
        </div>
      ) : null}

      {listState.status === "ready" ? (
        backups.length === 0 ? (
          <EmptyState
            title={t.pages.backup.emptyTitle}
            description={t.pages.backup.emptyDescription}
            actions={
              canManageBackup ? (
                <button type="button" className="button button-primary" onClick={() => void handleRunBackup()} disabled={runState.status === "running"}>
                  {t.pages.backup.emptyAction}
                </button>
              ) : null
            }
          />
        ) : (
          <section className="panel" aria-label={t.pages.backup.listAriaLabel}>
            <div className="panel-title-row">
              <div>
                <h2>{t.pages.backup.listTitle}</h2>
                <p>{t.pages.backup.listDescription}</p>
              </div>
            </div>
            <div className="scroll-x">
              <table className="data-table" aria-label={t.pages.backup.tableAriaLabel}>
                <thead>
                  <tr>
                    <th>{t.pages.backup.colName}</th>
                    <th>{t.pages.backup.colSize}</th>
                    <th>{t.pages.backup.colCreatedAt}</th>
                    <th className="data-table-sticky-end">{t.pages.backup.colActions}</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((backup) => (
                    <tr key={backup.name}>
                      <td className="mono-text wrap-anywhere" dir="ltr">{backup.name}</td>
                      <td className="mono-text text-sm">{formatBytes(backup.sizeBytes)}</td>
                      <td className="text-sm">{formatDate(backup.createdAt, displaySettings, locale)}</td>
                      <td className="data-table-sticky-end">
                        <div className="button-row">
                          <button type="button" className="button button-secondary button-sm" onClick={() => void handlePreview(backup.name)}>
                            {t.pages.backup.preview}
                          </button>
                          {canManageBackup ? (
                            <button type="button" className="button button-secondary button-sm" onClick={() => openRestoreDialog(backup.name)}>
                              {t.pages.backup.restore}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      ) : null}
    </AppShell>
  );
}
