"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import EmptyState from "@/components/EmptyState";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { AppDictionary } from "@/lib/i18n/dictionaries";
import type {
  CreateRelationPayload,
  RelationGraphEdge,
  RelationGraphPayload,
  RelationTypeKey,
  UpdateRelationPayload
} from "@/lib/archive-api";

export function relationEdgeSummary(edge: RelationGraphEdge, t: AppDictionary) {
  if (edge.kind === "manual") {
    return edge.note || edge.label;
  }

  if (edge.kind === "shared-tag" && edge.sharedTags?.length) {
    return edge.sharedTags.join(t.pages.archiveDetail.relations.sharedTagsSeparator);
  }

  if (edge.kind === "same-type" && edge.sharedType) {
    return edge.sharedType;
  }

  return edge.label;
}

export function RelationPreviewPanel({
  graph,
  recordId,
  onCreate,
  onUpdate,
  onDelete,
  canEdit
}: Readonly<{
  graph: RelationGraphPayload | null;
  recordId: string;
  onCreate: (payload: CreateRelationPayload) => Promise<void>;
  onUpdate: (id: string, payload: UpdateRelationPayload) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  canEdit: boolean;
}>) {
  const { t } = useLocale();
  const copy = t.pages.archiveDetail.relations;
  const dialogs = useConfirmDialog();
  const relationTypes = graph?.relationTypes?.length
    ? graph.relationTypes
    : [{ key: "related_to" as RelationTypeKey, label: copy.defaultRelationLabel, inverse: "related_to", bidirectional: true }];
  const nodesById = new Map((graph?.nodes ?? []).map((node) => [node.id, node]));
  const edges = (graph?.edges ?? []).filter((edge) => edge.source === recordId || edge.target === recordId);
  const manualEdges = edges.filter((edge) => edge.kind === "manual" && edge.relationId);
  const manualCount = manualEdges.length;
  const [targetId, setTargetId] = useState("");
  const [type, setType] = useState<RelationTypeKey>("related_to");
  const [note, setNote] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { type: RelationTypeKey; note: string }>>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  function relationTypeFromEdge(edge: RelationGraphEdge): RelationTypeKey {
    return relationTypes.some((option) => option.key === edge.type) ? (edge.type as RelationTypeKey) : "related_to";
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targetId.trim() || busy) return;

    setBusy(true);
    setStatus("");
    try {
      await onCreate({
        sourceId: recordId,
        targetId: targetId.trim(),
        type,
        ...(note.trim() ? { note: note.trim() } : {})
      });
      setTargetId("");
      setNote("");
      setStatus(copy.createSuccess);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.createError);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(edge: RelationGraphEdge) {
    if (!edge.relationId || busy) return;
    const draft = drafts[edge.relationId] ?? { type: relationTypeFromEdge(edge), note: edge.note || "" };

    setBusy(true);
    setStatus("");
    try {
      await onUpdate(edge.relationId, {
        type: draft.type,
        note: draft.note.trim() || null
      });
      setStatus(copy.updateSuccess);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.updateError);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(edge: RelationGraphEdge) {
    if (!edge.relationId || busy) return;
    const confirmed = await dialogs.confirm({
      title: copy.deleteConfirmTitle,
      message: copy.deleteConfirmMessage,
      confirmLabel: copy.deleteConfirmLabel,
      destructive: true
    });
    if (!confirmed) return;

    setBusy(true);
    setStatus("");
    try {
      await onDelete(edge.relationId);
      setStatus(copy.deleteSuccess);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.deleteError);
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
        <span className="badge">{edges.length} {copy.countLabel}</span>
      </div>

      {edges.length ? (
        <>
          <div className="kv-grid">
            <div className="kv-item">
              <strong>{copy.manualLabel}</strong>
              <span>{manualCount}</span>
            </div>
            <div className="kv-item">
              <strong>{copy.inferredLabel}</strong>
              <span>{edges.length - manualCount}</span>
            </div>
          </div>
          <ul className="graph-relation-list">
            {edges.slice(0, 6).map((edge) => {
              const otherId = edge.source === recordId ? edge.target : edge.source;
              const otherNode = nodesById.get(otherId);

              return (
                <li key={edge.id}>
                  <span>
                    <b>{edge.label}</b>
                    <small>{otherNode?.label || otherId} · {relationEdgeSummary(edge, t)}</small>
                  </span>
                  <a className="badge" href={`/archive/${encodeURIComponent(otherId)}`}>{copy.openLabel}</a>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <EmptyState
          title={copy.emptyTitle}
          description={copy.emptyDescription}
        />
      )}

      <a className="button button-primary" href={`/graph?recordId=${encodeURIComponent(recordId)}`}>
        {copy.openGraphButton}
      </a>

      {canEdit && (
        <form className="auth-form relation-inline-form" onSubmit={handleCreate}>
          <div className="panel-section-header">
            <h3>{copy.addSectionTitle}</h3>
          </div>
          <div className="field-row">
            <label>
              {copy.targetLabel}
              <input value={targetId} onChange={(event) => setTargetId(event.target.value)} placeholder={copy.targetPlaceholder} dir="ltr" />
            </label>
            <label>
              {copy.typeLabel}
              <select value={type} onChange={(event) => setType(event.target.value as RelationTypeKey)}>
                {relationTypes.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            {copy.noteLabel}
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder={copy.notePlaceholder} />
          </label>
          <button type="submit" className="button button-secondary" disabled={busy || !targetId.trim()}>
            {copy.addButton}
          </button>
        </form>
      )}

      {canEdit && manualEdges.length ? (
        <div className="relation-editor-list">
          <div className="panel-section-header">
            <h3>{copy.editSectionTitle}</h3>
          </div>
          {manualEdges.map((edge) => {
            const relationId = edge.relationId || edge.id;
            const draft = edge.relationId && drafts[edge.relationId]
              ? drafts[edge.relationId]
              : { type: relationTypeFromEdge(edge), note: edge.note || "" };
            const otherId = edge.source === recordId ? edge.target : edge.source;
            const otherNode = nodesById.get(otherId);

            return (
              <div key={edge.id} className="relation-editor-row">
                <strong>{otherNode?.label || otherId}</strong>
                <select
                  value={draft.type}
                  onChange={(event) => edge.relationId && setDrafts((current) => ({
                    ...current,
                    [edge.relationId!]: { ...draft, type: event.target.value as RelationTypeKey }
                  }))}
                >
                  {relationTypes.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
                <input
                  value={draft.note}
                  onChange={(event) => edge.relationId && setDrafts((current) => ({
                    ...current,
                    [edge.relationId!]: { ...draft, note: event.target.value }
                  }))}
                  placeholder={copy.editNotePlaceholder}
                />
                <button type="button" className="button button-secondary button-sm" onClick={() => void handleUpdate(edge)} disabled={busy || !edge.relationId}>
                  {copy.saveButton}
                </button>
                <button type="button" className="button button-danger button-sm" onClick={() => void handleDelete(edge)} disabled={busy || !edge.relationId}>
                  {copy.deleteButton}
                </button>
                <span className="helper-text mono-text">{relationId}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      {status ? <p className="form-status">{status}</p> : null}
    </article>
  );
}
