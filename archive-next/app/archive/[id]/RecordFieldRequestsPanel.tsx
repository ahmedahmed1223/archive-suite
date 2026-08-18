"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { RecordFieldRequest } from "@/lib/archive-api";

export function RecordFieldRequestsPanel({
  requests,
  loading,
  error,
  onCreate,
  onResolve,
  canEdit
}: Readonly<{
  requests: RecordFieldRequest[];
  loading: boolean;
  error: string | null;
  onCreate: (payload: { field: string; message: string; assignee?: string; dueDate?: string }) => Promise<void>;
  onResolve: (id: string) => Promise<void>;
  canEdit: boolean;
}>) {
  const { t } = useLocale();
  const copy = t.pages.archiveDetail.fieldRequests;
  const [field, setField] = useState("");
  const [message, setMessage] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const openRequests = requests.filter((request) => !request.resolvedAt);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!field.trim() || !message.trim() || busy) return;

    setBusy(true);
    setStatus("");
    try {
      await onCreate({
        field: field.trim(),
        message: message.trim(),
        ...(assignee.trim() ? { assignee: assignee.trim() } : {}),
        ...(dueDate ? { dueDate } : {})
      });
      setField("");
      setMessage("");
      setAssignee("");
      setDueDate("");
      setStatus(copy.assignSuccess);
    } catch (submitError) {
      setStatus(submitError instanceof Error ? submitError.message : copy.assignError);
    } finally {
      setBusy(false);
    }
  }

  async function handleResolve(id: string) {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      await onResolve(id);
      setStatus(copy.resolveSuccess);
    } catch (resolveError) {
      setStatus(resolveError instanceof Error ? resolveError.message : copy.resolveError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel">
      <div className="panel-section-header panel-title-row">
        <div>
          <h2>{copy.title}</h2>
          <p className="helper-text">{copy.description}</p>
        </div>
        <span className="badge">{openRequests.length} {copy.openCountLabel}</span>
      </div>

      {loading ? <Skeleton label={copy.loadingLabel} /> : null}
      {error ? <p className="form-status" role="alert">{error}</p> : null}

      {canEdit ? (
        <form className="auth-form record-note-form" onSubmit={handleSubmit}>
          <label>{copy.fieldLabel}
            <input value={field} onChange={(event) => setField(event.target.value)} placeholder={copy.fieldPlaceholder} required />
          </label>
          <label>{copy.messageLabel}
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={2} placeholder={copy.messagePlaceholder} required />
          </label>
          <div className="form-grid">
            <label>{copy.assigneeLabel}
              <input value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder={copy.assigneePlaceholder} />
            </label>
            <label>{copy.dueDateLabel}
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </label>
          </div>
          <button type="submit" className="button button-secondary" disabled={busy || !field.trim() || !message.trim()}>
            {busy ? copy.submittingButton : copy.submitButton}
          </button>
          {status ? <p className="form-status">{status}</p> : null}
        </form>
      ) : null}

      {!loading && requests.length ? (
        <ul className="record-note-list">
          {requests.map((request) => (
            <li key={request.id}>
              <div>
                <div className="helper-row">
                  <strong>{request.field}</strong>
                  <span className="badge">{request.resolvedAt ? copy.statusClosed : copy.statusOpen}</span>
                </div>
                <p>{request.message}</p>
                <small className="helper-text">
                  {request.assignee ? copy.assigneePrefix.replace("{assignee}", request.assignee) : copy.noAssignee}
                  {request.dueDate ? copy.dueDatePrefix.replace("{date}", request.dueDate) : ""}
                </small>
              </div>
              {canEdit && !request.resolvedAt ? (
                <button type="button" className="button button-secondary button-sm" onClick={() => void handleResolve(request.id)} disabled={busy}>
                  {copy.resolveButton}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : !loading ? (
        <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
      ) : null}
    </article>
  );
}
