"use client";

import { AlertTriangle, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { useEffect, useRef } from "react";

export type StorageOperationView = { id: string; type: string; status: "preview" | "running" | "completed" | "failed" | "cancelled"; completedItems: number; totalItems: number; message?: string; conflict?: "skip" | "copy" | "replace"; quotaExceeded?: boolean; retryable?: boolean };

export default function StorageOperationPanel({ operation, onConfirm, onCancel, onRetry }: Readonly<{ operation?: StorageOperationView; onConfirm?: () => void; onCancel?: () => void; onRetry?: () => void }>) {
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

  if (!operation) return <section className="workspace-panel" aria-label="حالة نقل الملفات"><h2>العمليات</h2><p className="helper-text">لا توجد عملية نقل أو نسخ قيد المتابعة.</p></section>;
  const progress = operation.totalItems ? Math.round((operation.completedItems / operation.totalItems) * 100) : 0;
  const isPreview = operation.status === "preview";
  return <section ref={panelRef} className="workspace-panel" aria-label="حالة نقل الملفات" aria-live="polite" tabIndex={isPreview ? -1 : undefined} onKeyDown={(event) => { if (isPreview && event.key === "Escape") { event.preventDefault(); cancelPreview(); } }}><div className="workspace-panel__header"><div><h2>عملية {operation.type}</h2><p>{operation.completedItems} من {operation.totalItems} عناصر ({progress}%)</p></div><span className="badge">{operation.status}</span></div><progress value={operation.completedItems} max={operation.totalItems || 1}>{progress}%</progress>{operation.conflict ? <p className="state-banner state-banner-warning"><AlertTriangle size={18} aria-hidden="true" />تعارض اسم: السياسة المختارة {operation.conflict === "skip" ? "تخطي" : operation.conflict === "copy" ? "إنشاء نسخة" : "استبدال مؤكد"}.</p> : null}{operation.quotaExceeded ? <p className="state-banner state-banner-error"><XCircle size={18} aria-hidden="true" />تجاوزت العملية المساحة المتاحة في وحدة التخزين.</p> : null}{operation.message ? <p className={operation.status === "failed" ? "state-banner state-banner-error" : "helper-text"}>{operation.message}</p> : null}<div className="button-row">{isPreview ? <button type="button" className="button button-primary" onClick={onConfirm}><CheckCircle2 size={16} aria-hidden="true" />تأكيد العملية</button> : null}{(isPreview || operation.status === "running") ? <button type="button" className="button button-secondary" onClick={isPreview ? cancelPreview : onCancel}>إلغاء</button> : null}{operation.retryable ? <button type="button" className="button button-secondary" onClick={onRetry}><RotateCcw size={16} aria-hidden="true" />إعادة المحاولة</button> : null}</div></section>;
}
