"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
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

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ar-SA");
}

export default function BackupPage() {
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
        setListState({ status: "error", message: response.error || "تعذر تحميل قائمة النسخ الاحتياطية." });
      }
    } catch (error) {
      setListState({ status: "error", message: error instanceof Error ? error.message : "تعذر تحميل قائمة النسخ الاحتياطية." });
    }
  }, [api]);

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
        setRunState({ status: "error", message: response.error || "تعذر إنشاء النسخة الاحتياطية." });
      }
    } catch (error) {
      setRunState({ status: "error", message: error instanceof Error ? error.message : "تعذر إنشاء النسخة الاحتياطية." });
    }
  };

  const handlePreview = async (name: string) => {
    setPreviewState({ status: "loading", name });
    try {
      const response = await api.previewBackup({ name });
      if (response.ok) {
        setPreviewState({ status: "ready", preview: response.preview });
      } else {
        setPreviewState({ status: "error", message: response.error || "تعذر معاينة النسخة الاحتياطية." });
      }
    } catch (error) {
      setPreviewState({ status: "error", message: error instanceof Error ? error.message : "تعذر معاينة النسخة الاحتياطية." });
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
        setRestoreState({ status: "error", message: response.error || "تعذرت الاستعادة من النسخة الاحتياطية." });
      }
    } catch (error) {
      setRestoreState({ status: "error", message: error instanceof Error ? error.message : "تعذرت الاستعادة من النسخة الاحتياطية." });
    }
  };

  const backups = listState.status === "ready" ? listState.backups : [];
  const totalSize = backups.reduce((sum, backup) => sum + backup.sizeBytes, 0);
  const isRestoreConfirmed = restoreTarget !== null && restoreConfirmName.trim() === restoreTarget;
  const freshness = buildBackupFreshness(backups.map((backup) => backup.createdAt));

  return (
    <AppShell subtitle="مركز البيانات" navLabel="النسخ الاحتياطي" contentClassName="observability-content" tipsPage="backup">
      <PageToolbar
        eyebrow={<span className="badge">Data Center</span>}
        title="النسخ الاحتياطي والاستعادة"
        description="إدارة النسخ الاحتياطية لمخازن السجلات: إنشاء نسخة فورية، معاينة المحتوى، أو الاستعادة الكاملة (للمشرفين فقط)."
        meta={(
          <>
            <span className="badge">{backups.length} نسخة</span>
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
                {runState.status === "running" ? "جار إنشاء النسخة..." : "إنشاء نسخة احتياطية الآن"}
              </button>
            ) : null}
            <button type="button" className="button button-secondary" onClick={() => void loadBackups()} disabled={listState.status === "loading"}>
              تحديث
            </button>
          </>
        )}
      />
      {listState.status === "ready" ? <div className="state-banner" role="status"><strong>{freshness.summary}</strong><span className="helper-text">{freshness.detail}</span></div> : null}

      {runState.status === "success" ? (
        <div className="state-banner state-banner-success" role="status">
          <strong>تم إنشاء النسخة الاحتياطية</strong>
          <span className="helper-text">
            {runState.backup.name} · {formatBytes(runState.backup.sizeBytes)} · {formatDate(runState.backup.completedAt)}
          </span>
        </div>
      ) : null}

      {runState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر إنشاء النسخة الاحتياطية</strong>
          <span className="helper-text">{redactAdminSecrets(runState.message)}</span>
        </div>
      ) : null}

      {restoreState.status === "success" ? (
        <div className="state-banner state-banner-success" role="status">
          <strong>تمت الاستعادة بنجاح من {restoreState.name}</strong>
          <span className="helper-text">
            {Object.entries(restoreState.counts)
              .map(([store, count]) => `${store}: ${count}`)
              .join(" · ") || "لا سجلات"}
            {" — "}
            {formatDate(restoreState.restoredAt)}
          </span>
        </div>
      ) : null}

      {restoreState.status === "success" && !restoreState.verified ? (
        <div className="state-banner state-banner-warning" role="alert">
          <strong>تحذير: لم يتم التحقق من سلامة النسخة الاحتياطية</strong>
          <span className="helper-text">
            هذه النسخة لا تحتوي على بصمة تحقق (checksum) قديمة من قبل هذه الميزة، فتمت الاستعادة اعتمادًا على فحص البنية فقط دون تأكيد عدم التلاعب أو التلف.
          </span>
        </div>
      ) : null}

      {restoreState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذرت الاستعادة</strong>
          <span className="helper-text">{redactAdminSecrets(restoreState.message)}</span>
        </div>
      ) : null}

      {restoreTarget ? (
        <section className="panel" role="alertdialog" aria-labelledby="restore-dialog-title" aria-describedby="restore-dialog-desc">
          <div className="panel-title-row">
            <div>
              <h2 id="restore-dialog-title">تأكيد الاستعادة — إجراء لا رجعة فيه</h2>
              <p id="restore-dialog-desc">
                الاستعادة من &quot;{restoreTarget}&quot; ستستبدل كل السجلات الحالية في المخازن بمحتوى النسخة الاحتياطية.
                البيانات التي أضيفت بعد هذه النسخة ستفقد نهائيًا.
              </p>
            </div>
            <span className="badge badge-danger">إجراء مدمر</span>
          </div>
          <label>
            <span>اكتب اسم النسخة الاحتياطية بالكامل للتأكيد: {restoreTarget}</span>
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
              {restoreState.status === "running" ? "جار الاستعادة..." : "تأكيد الاستعادة الآن"}
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
              إلغاء
            </button>
          </div>
        </section>
      ) : null}

      {previewState.status === "loading" ? (
        <div className="panel panel-compact" role="status" aria-live="polite">
          <p className="form-status">جار معاينة النسخة {previewState.name}...</p>
        </div>
      ) : null}

      {previewState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذرت المعاينة</strong>
          <span className="helper-text">{redactAdminSecrets(previewState.message)}</span>
        </div>
      ) : null}

      {previewState.status === "ready" ? (
        <section className="panel" aria-label="معاينة النسخة الاحتياطية">
          <div className="panel-title-row">
            <div>
              <h2>معاينة: {previewState.preview.name}</h2>
              <p>عدد السجلات في كل مخزن داخل النسخة الاحتياطية دون تنفيذ أي استعادة.</p>
            </div>
            <span className="badge">{previewState.preview.totalRecords} سجل إجمالي</span>
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
          <Skeleton label="جار تحميل النسخ الاحتياطية..." />
        </div>
      ) : null}

      {listState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل النسخ الاحتياطية</strong>
          <span className="helper-text">{redactAdminSecrets(listState.message)} — هذه الصفحة متاحة للمشرفين فقط.</span>
        </div>
      ) : null}

      {listState.status === "ready" ? (
        backups.length === 0 ? (
          <EmptyState
            title="لا توجد نسخ احتياطية بعد."
            description="أنشئ أول نسخة احتياطية الآن لتأمين مخازن السجلات."
            actions={
              canManageBackup ? (
                <button type="button" className="button button-primary" onClick={() => void handleRunBackup()} disabled={runState.status === "running"}>
                  إنشاء نسخة احتياطية
                </button>
              ) : null
            }
          />
        ) : (
          <section className="panel" aria-label="قائمة النسخ الاحتياطية">
            <div className="panel-title-row">
              <div>
                <h2>النسخ الاحتياطية المتاحة</h2>
                <p>الأحدث أولًا. المعاينة آمنة تمامًا؛ الاستعادة تتطلب تأكيدًا كتابيًا.</p>
              </div>
            </div>
            <div className="scroll-x">
              <table className="data-table" aria-label="النسخ الاحتياطية">
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>الحجم</th>
                    <th>تاريخ الإنشاء</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((backup) => (
                    <tr key={backup.name}>
                      <td className="mono-text wrap-anywhere" dir="ltr">{backup.name}</td>
                      <td className="mono-text text-sm">{formatBytes(backup.sizeBytes)}</td>
                      <td className="text-sm">{formatDate(backup.createdAt)}</td>
                      <td>
                        <div className="button-row">
                          <button type="button" className="button button-secondary button-sm" onClick={() => void handlePreview(backup.name)}>
                            معاينة
                          </button>
                          {canManageBackup ? (
                            <button type="button" className="button button-secondary button-sm" onClick={() => openRestoreDialog(backup.name)}>
                              استعادة
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
