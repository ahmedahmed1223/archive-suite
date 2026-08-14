"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { ArchiveRecord } from "@/lib/archive-api";
import RecordEditClaimBanner from "@/components/RecordEditClaimBanner";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { clearEditDraftPosition, getEditDraftPosition, saveEditDraftPosition } from "@/lib/edit-draft-position";
import { missingDescribeFields } from "@/lib/record-status";
import { canRedo, canUndo, emptyUndoStack, pushUndo, redo, undo, type UndoStack } from "@/lib/undo-stack";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";

export type RecordDescribePatch = {
  title: string;
  description: string;
  type: string;
  subtype: string | null;
  tags: string[];
};

// V1-732C: a real undo/redo stack for the describe form, checkpointed on
// field blur (not per keystroke - that would push hundreds of entries for
// one sentence). Each entry is a {previous, next} pair of full-form
// snapshots, the same shape as KanbanMove/ParentChange elsewhere in this
// undo-stack.ts rollout, so undo/redo just replays the whole form state.
interface FormSnapshot {
  title: string;
  description: string;
  type: string;
  subtype: string;
  tags: string;
}

interface FormChange {
  previous: FormSnapshot;
  next: FormSnapshot;
}

function snapshotsEqual(a: FormSnapshot, b: FormSnapshot): boolean {
  return a.title === b.title && a.description === b.description && a.type === b.type && a.subtype === b.subtype && a.tags === b.tags;
}

export function RecordDescribeForm({
  record,
  onSave
}: Readonly<{
  record: ArchiveRecord;
  onSave: (patch: RecordDescribePatch) => Promise<void>;
}>) {
  const { t, locale } = useLocale();
  const initialSnapshot: FormSnapshot = {
    title: record.title || "",
    description: record.description || "",
    type: record.type || "",
    subtype: record.subtype || "",
    tags: (record.tags ?? []).join("، ")
  };
  const [title, setTitle] = useState(initialSnapshot.title);
  const [description, setDescription] = useState(initialSnapshot.description);
  const [type, setType] = useState(initialSnapshot.type);
  const [subtype, setSubtype] = useState(initialSnapshot.subtype);
  const [tags, setTags] = useState(initialSnapshot.tags);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<UndoStack<FormChange>>(emptyUndoStack);
  const [restoredField, setRestoredField] = useState<string | null>(null);
  const lastCommittedRef = useRef<FormSnapshot>(initialSnapshot);
  // V1-826: restore the user's last-edited field on return, without touching
  // form content - a pure focus/scroll nudge, never an auto-applied value.
  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});

  useEffect(() => {
    const position = getEditDraftPosition();
    if (!position || position.recordId !== record.id) return;
    const target = fieldRefs.current[position.field];
    if (!target) return;
    target.focus();
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setRestoredField(position.field);
  }, [record.id]);

  function handleFieldFocus(field: string) {
    saveEditDraftPosition(record.id, field);
  }
  // commitCheckpoint()'s setHistory() doesn't land until the next render, so
  // a caller that reads `history` in the same synchronous call (handleUndo
  // does, right after calling commitCheckpoint) would see the pre-commit
  // value. historyRef mirrors `history` but updates immediately, sidestepping
  // that - same stale-closure shape as the toast-undo fix elsewhere in this
  // rollout, just triggered by a same-call sequencing instead of a toast.
  const historyRef = useRef(history);

  function currentSnapshot(): FormSnapshot {
    return { title, description, type, subtype, tags };
  }

  function applySnapshot(snapshot: FormSnapshot) {
    setTitle(snapshot.title);
    setDescription(snapshot.description);
    setType(snapshot.type);
    setSubtype(snapshot.subtype);
    setTags(snapshot.tags);
  }

  function updateHistory(next: UndoStack<FormChange>) {
    historyRef.current = next;
    setHistory(next);
  }

  function commitCheckpoint() {
    const current = currentSnapshot();
    if (snapshotsEqual(current, lastCommittedRef.current)) return;
    updateHistory(pushUndo(historyRef.current, { previous: lastCommittedRef.current, next: current }));
    lastCommittedRef.current = current;
  }

  function handleUndo() {
    commitCheckpoint();
    const result = undo(historyRef.current);
    if (!result) return;
    applySnapshot(result.entry.previous);
    lastCommittedRef.current = result.entry.previous;
    updateHistory(result.stack);
  }

  function handleRedo() {
    const result = redo(historyRef.current);
    if (!result) return;
    applySnapshot(result.entry.next);
    lastCommittedRef.current = result.entry.next;
    updateHistory(result.stack);
  }

  const isDirty = useMemo(
    () =>
      title !== (record.title || "") ||
      description !== (record.description || "") ||
      type !== (record.type || "") ||
      subtype !== (record.subtype || "") ||
      tags !== (record.tags ?? []).join("، "),
    [title, description, type, subtype, tags, record]
  );
  useUnsavedChangesGuard(isDirty);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    // V1-843: the title is the one mandatory rule this form already enforced --
    // it just returned silently, so the button looked broken. Keep the block,
    // say why. Every other gap is reported after the save, never blocking it.
    if (!title.trim()) {
      setStatus(t.pages.recordDescribeForm.titleRequiredError);
      return;
    }

    setBusy(true);
    setStatus("");
    const parsedTags = tags.split(/[،,]/).map((tag) => tag.trim()).filter(Boolean);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        type: type.trim(),
        subtype: subtype.trim() ? subtype.trim() : null,
        tags: parsedTags
      });
      const missing = missingDescribeFields({
        title: title.trim(),
        description: description.trim(),
        type: type.trim(),
        tags: parsedTags
      }, locale);
      setStatus(
        missing.length
          ? t.pages.recordDescribeForm.savedWithMissingFields.replace("{fields}", missing.join("، "))
          : t.pages.recordDescribeForm.savedSuccess
      );
      clearEditDraftPosition();
      setRestoredField(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t.pages.recordDescribeForm.saveError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel">
      <div className="panel-section-header panel-title-row">
        <div>
          <h2>{t.pages.recordDescribeForm.title}</h2>
          <p className="helper-text">{t.pages.recordDescribeForm.description}</p>
          {restoredField ? (
            <p className="helper-text">{t.pages.recordDescribeForm.resumedEditingNotice}</p>
          ) : null}
        </div>
      </div>
      <RecordEditClaimBanner recordId={record.id} />
      <form id="record-describe-form" className="auth-form" onSubmit={handleSubmit}>
        <label>
          {t.pages.recordDescribeForm.titleLabel}
          <input
            ref={(node) => { fieldRefs.current.title = node; }}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onFocus={() => handleFieldFocus("title")}
            onBlur={commitCheckpoint}
          />
        </label>
        <label>
          {t.pages.recordDescribeForm.descriptionLabel}
          <textarea
            ref={(node) => { fieldRefs.current.description = node; }}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onFocus={() => handleFieldFocus("description")}
            onBlur={commitCheckpoint}
            rows={4}
            placeholder={t.pages.recordDescribeForm.descriptionPlaceholder}
          />
        </label>
        <div className="field-row">
          <label>
            {t.pages.recordDescribeForm.typeLabel}
            <input
              ref={(node) => { fieldRefs.current.type = node; }}
              value={type}
              onChange={(event) => setType(event.target.value)}
              onFocus={() => handleFieldFocus("type")}
              onBlur={commitCheckpoint}
              dir="ltr"
              placeholder="video"
              list="record-type-options"
            />
          </label>
          <label>
            {t.pages.recordDescribeForm.subtypeLabel}
            <input
              ref={(node) => { fieldRefs.current.subtype = node; }}
              value={subtype}
              onChange={(event) => setSubtype(event.target.value)}
              onFocus={() => handleFieldFocus("subtype")}
              onBlur={commitCheckpoint}
              dir="ltr"
              placeholder="interview / raw"
              list="record-subtype-options"
            />
          </label>
        </div>
        <label>
          {t.pages.recordDescribeForm.tagsLabel}
          <input
            id="record-tags-input"
            ref={(node) => { fieldRefs.current.tags = node; }}
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            onFocus={() => handleFieldFocus("tags")}
            onBlur={commitCheckpoint}
            placeholder={t.pages.recordDescribeForm.tagsPlaceholder}
          />
        </label>
        <datalist id="record-type-options">
          <option value="video" />
          <option value="audio" />
          <option value="image" />
          <option value="document" />
          <option value="map" />
        </datalist>
        <datalist id="record-subtype-options">
          <option value="interview" />
          <option value="raw" />
          <option value="report" />
          <option value="broadcast" />
          <option value="highlights" />
        </datalist>
        <div className="record-form-actions">
          <button type="submit" className="button button-primary" disabled={busy || !title.trim()}>
            {busy ? t.pages.recordDescribeForm.savingButton : t.pages.recordDescribeForm.saveButton}
          </button>
          <button
            type="button"
            className="button button-secondary button-sm"
            disabled={!canUndo(history) && snapshotsEqual(currentSnapshot(), lastCommittedRef.current)}
            onClick={handleUndo}
          >
            {t.pages.recordDescribeForm.undoButton}{history.past.length > 0 ? ` (${history.past.length})` : ""}
          </button>
          <button
            type="button"
            className="button button-secondary button-sm"
            disabled={!canRedo(history)}
            onClick={handleRedo}
          >
            {t.pages.recordDescribeForm.redoButton}{history.future.length > 0 ? ` (${history.future.length})` : ""}
          </button>
          {status ? <p className="form-status">{status}</p> : null}
        </div>
      </form>
    </article>
  );
}
