"use client";

import { AlertTriangle, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export type StorageOperationView = { id: string; type: string; status: "preview" | "running" | "completed" | "failed" | "cancelled"; completedItems: number; totalItems: number; message?: string; conflict?: "skip" | "copy" | "replace"; quotaExceeded?: boolean; retryable?: boolean };

export default function StorageOperationPanel({ operation, onConfirm, onCancel, onRetry }: Readonly<{ operation?: StorageOperationView; onConfirm?: () => void; onCancel?: () => void; onRetry?: () => void }>) {
  const { t } = useLocale();
  const copy = t.pages.files.storageOperation;
  const panelRef = useRef<HTMLElement>(null);
  const actionTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (operation?.status !== "preview") return;
    actionTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
  }, [operation?.id, operation?.status]);

  const cancelPreview = () => {
    onCancel?.();
    queueMicrotask(() => {
      if (actionTriggerRef.current?.isConnected) actionTriggerRef.current.focus();
    });
  };

  if (!operation) return <section className="workspace-panel" aria-label={copy.ariaLabel}><h2>{copy.title}</h2><p className="helper-text">{copy.empty}</p></section>;
  const progress = operation.totalItems ? Math.round((operation.completedItems / operation.totalItems) * 100) : 0;
  const isPreview = operation.status === "preview";
  const conflictPolicy = operation.conflict === "skip" ? copy.conflictSkip : operation.conflict === "copy" ? copy.conflictCopy : copy.conflictReplace;
  return <section ref={panelRef} className="workspace-panel" aria-label={copy.ariaLabel} aria-live="polite" tabIndex={isPreview ? -1 : undefined} onKeyDown={(event) => { if (isPreview && event.key === "Escape") { event.preventDefault(); cancelPreview(); } }}><div className="workspace-panel__header"><div><h2>{copy.operationTitle.replace("{type}", operation.type)}</h2><p>{copy.progress.replace("{completed}", String(operation.completedItems)).replace("{total}", String(operation.totalItems)).replace("{progress}", String(progress))}</p></div><span className="badge">{copy.statuses[operation.status]}</span></div><progress value={operation.completedItems} max={operation.totalItems || 1}>{progress}%</progress>{operation.conflict ? <p className="state-banner state-banner-warning"><AlertTriangle size={18} aria-hidden="true" />{copy.conflict.replace("{policy}", conflictPolicy)}</p> : null}{operation.quotaExceeded ? <p className="state-banner state-banner-error"><XCircle size={18} aria-hidden="true" />{copy.quotaExceeded}</p> : null}{operation.message ? <p className={operation.status === "failed" ? "state-banner state-banner-error" : "helper-text"}>{operation.message}</p> : null}<div className="button-row">{isPreview ? <button type="button" className="button button-primary" onClick={onConfirm}><CheckCircle2 size={16} aria-hidden="true" />{copy.confirm}</button> : null}{(isPreview || operation.status === "running") ? <button type="button" className="button button-secondary" onClick={isPreview ? cancelPreview : onCancel}>{copy.cancel}</button> : null}{operation.retryable ? <button type="button" className="button button-secondary" onClick={onRetry}><RotateCcw size={16} aria-hidden="true" />{copy.retry}</button> : null}</div></section>;
}
