"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import EmptyState from "@/components/EmptyState";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useAuthSession } from "@/lib/auth-session";
import { createArchiveApiClient, type ApprovalRequest, type BulkMacroTarget } from "@/lib/archive-api";

function parseTargets(raw: string): BulkMacroTarget[] {
  return raw.split(",").map((pair) => pair.trim()).filter(Boolean).map((pair) => {
    const [store, id] = pair.split(":").map((part) => part.trim());
    return { store: store || "", id: id || "" };
  }).filter((target) => target.store && target.id);
}

function approvalCounts(request: ApprovalRequest): { approved: number; rejected: number } {
  return request.decisions.reduce(
    (acc, decision) => decision.decision === "approve" ? { ...acc, approved: acc.approved + 1 } : { ...acc, rejected: acc.rejected + 1 },
    { approved: 0, rejected: 0 }
  );
}

export default function ApprovalRequestsPage() {
  const { t } = useLocale();
  const copy = t.pages.approvalRequests;
  const api = useMemo(() => createArchiveApiClient(), []);
  const { user, accessToken } = useAuthSession();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] = useState("");
  const [macroId, setMacroId] = useState("");
  const [targetsText, setTargetsText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const response = await api.approvalRequests({ accessToken });
    if (!response.ok) {
      setLoadError(response.error || copy.errors.load);
      return;
    }
    setLoadError("");
    setRequests(response.requests);
  }, [api, accessToken, copy.errors.load]);

  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const targets = parseTargets(targetsText);
    if (!macroId.trim() || targets.length === 0) return;
    setSubmitting(true);
    const response = await api.createApprovalRequest({ targetType: "bulk-macro", targetId: macroId.trim(), targets }, { accessToken });
    setSubmitting(false);
    if (!response.ok) {
      setStatus(response.error || copy.errors.submit);
      return;
    }
    setRequests((current) => [response.request, ...current]);
    setMacroId("");
    setTargetsText("");
    setStatus("");
  }

  async function decide(request: ApprovalRequest, decision: "approve" | "reject") {
    const response = await api.decideApprovalRequest(request.id, { decision }, { accessToken });
    if (!response.ok) {
      setStatus(response.error || copy.errors.decide);
      return;
    }
    setRequests((current) => current.map((item) => item.id === request.id ? response.request : item));
  }

  async function execute(request: ApprovalRequest) {
    const response = await api.executeApprovalRequest(request.id, { accessToken });
    if (!response.ok) {
      setStatus(response.error || copy.errors.execute);
      return;
    }
    setRequests((current) => current.map((item) => item.id === request.id ? response.request : item));
  }

  return (
    <AppShell subtitle={t.pageTitles.approvalRequests} navLabel={t.pageTitles.approvalRequests} contentClassName="stack">
      <PageToolbar
        eyebrow={<span className="badge">{copy.toolbar.eyebrow}</span>}
        title={copy.toolbar.title}
        description={copy.toolbar.description}
        actions={<button type="button" className="button button-secondary" onClick={() => void load()}>{copy.toolbar.refresh}</button>}
      />

      <form className="panel archive-toolbar-grid" onSubmit={submit} aria-label={copy.submit.ariaLabel}>
        <div className="panel-title-row"><div><h2>{copy.submit.title}</h2><p>{copy.submit.description}</p></div></div>
        <label>{copy.submit.macroId}<input dir="ltr" value={macroId} onChange={(event) => setMacroId(event.target.value)} /></label>
        <label>{copy.submit.targets}<input dir="ltr" value={targetsText} onChange={(event) => setTargetsText(event.target.value)} placeholder="archive-items:alpha, archive-items:bravo" /></label>
        <div className="archive-toolbar-actions">
          <button type="submit" className="button button-primary" disabled={submitting}>{submitting ? copy.submit.submitting : copy.submit.submit}</button>
        </div>
      </form>

      {loadError ? <div className="state-banner state-banner-error" role="alert"><strong>{copy.errors.load}</strong><span className="helper-text">{loadError}</span><div><button type="button" className="button button-secondary button-sm" onClick={() => void load()}>{t.shared.actions.retry}</button></div></div> : null}
      {status ? <div className="state-banner state-banner-error" role="alert">{status}</div> : null}

      {requests.length === 0 ? <EmptyState title={copy.empty} /> : (
        <section className="panel" aria-label={copy.table.ariaLabel}>
          <div className="scroll-x">
            <table className="data-table" aria-label={copy.table.ariaLabel}>
              <thead>
                <tr>
                  <th>{copy.table.id}</th>
                  <th>{copy.table.operation}</th>
                  <th>{copy.table.status}</th>
                  <th>{copy.table.approvals}</th>
                  <th>{copy.table.requestedBy}</th>
                  <th>{copy.table.actions}</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const counts = approvalCounts(request);
                  const isRequester = user ? String(user.id) === String(request.requestedBy) : false;
                  const alreadyDecided = user ? request.decisions.some((decision) => String(decision.approverId) === String(user.id)) : false;
                  return (
                    <tr key={request.id}>
                      <td dir="ltr">{request.id.slice(0, 8)}</td>
                      <td>{request.operationKey}</td>
                      <td><span className="badge">{copy.status[request.status]}</span></td>
                      <td>{copy.decidedCount.replace("{approved}", String(counts.approved)).replace("{rejected}", String(counts.rejected))} / {request.requiredApprovals}</td>
                      <td dir="ltr">{request.requestedBy}</td>
                      <td>
                        {request.status === "pending" ? (
                          isRequester ? (
                            <span className="helper-text">{copy.actions.selfApprovalBlocked}</span>
                          ) : alreadyDecided ? (
                            <span className="helper-text">{copy.actions.alreadyDecided}</span>
                          ) : (
                            <>
                              <button type="button" className="button button-secondary" onClick={() => void decide(request, "approve")}>{copy.actions.approve}</button>
                              <button type="button" className="button button-secondary" onClick={() => void decide(request, "reject")}>{copy.actions.reject}</button>
                            </>
                          )
                        ) : null}
                        {request.status === "approved" ? (
                          <button type="button" className="button button-primary" onClick={() => void execute(request)}>{copy.actions.execute}</button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AppShell>
  );
}
