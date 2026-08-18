"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import EmptyState from "@/components/EmptyState";
import MentionTextarea from "@/components/MentionTextarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { AppDictionary } from "@/lib/i18n/dictionaries";
import type { RecordNote } from "@/lib/archive-api";

export function formatNoteTime(seconds: unknown) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return "0:00";
  const whole = Math.floor(total);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

export function noteAnchor(note: RecordNote, t: AppDictionary) {
  const copy = t.pages.archiveDetail.notes;
  if (note.timestampSeconds !== null && note.timestampSeconds !== undefined) {
    return copy.anchorAt.replace("{time}", formatNoteTime(note.timestampSeconds));
  }

  if (note.region) {
    return copy.anchorRegion;
  }

  return copy.anchorGeneral;
}

export function sortRecordNotes(notes: RecordNote[]) {
  return [...notes].sort((left, right) => {
    const leftTime = left.timestampSeconds;
    const rightTime = right.timestampSeconds;
    if (leftTime !== null && leftTime !== undefined && rightTime !== null && rightTime !== undefined && leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    if (leftTime !== null && leftTime !== undefined) return -1;
    if (rightTime !== null && rightTime !== undefined) return 1;
    return new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime();
  });
}

export function RecordNotesPanel({
  notes,
  loading,
  error,
  onCreate,
  onDelete
}: Readonly<{
  notes: RecordNote[];
  loading: boolean;
  error: string | null;
  onCreate: (payload: { body: string; timestampSeconds?: number | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}>) {
  const { t, locale } = useLocale();
  const copy = t.pages.archiveDetail.notes;
  const [body, setBody] = useState("");
  const [timestampText, setTimestampText] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || busy) return;

    const parsedTimestamp = timestampText.trim() === "" ? null : Number(timestampText);
    if (parsedTimestamp !== null && (!Number.isFinite(parsedTimestamp) || parsedTimestamp < 0)) {
      setStatus(copy.invalidTimestamp);
      return;
    }

    setBusy(true);
    setStatus("");
    try {
      await onCreate({ body: trimmed, timestampSeconds: parsedTimestamp });
      setBody("");
      setTimestampText("");
      setStatus(copy.saveSuccess);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.saveError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel record-notes-panel">
      <div className="panel-section-header panel-title-row">
        <div>
          <h2>{copy.title}</h2>
          <p className="helper-text">{copy.description}</p>
        </div>
        <span className="badge">{notes.length} {copy.countLabel}</span>
      </div>

      {loading ? (
        <Skeleton label={copy.loadingLabel} />
      ) : null}

      {error ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.loadErrorTitle}</strong>
          <span className="helper-text">{error}</span>
        </div>
      ) : null}

      <form className="auth-form record-note-form" onSubmit={handleSubmit}>
        <label>
          {copy.newNoteLabel}
          <MentionTextarea
            value={body}
            onChange={setBody}
            placeholder={copy.bodyPlaceholder}
            rows={4}
          />
        </label>
        <div className="field-row">
          <label>
            {copy.timestampLabel}
            <input
              inputMode="decimal"
              value={timestampText}
              onChange={(event) => setTimestampText(event.target.value)}
              placeholder={copy.timestampPlaceholder}
            />
          </label>
          <button type="submit" className="button button-primary" disabled={busy || !body.trim()}>
            {busy ? copy.savingButton : copy.addButton}
          </button>
        </div>
        {status ? <p className="form-status">{status}</p> : null}
      </form>

      {!loading && notes.length ? (
        <ul className="record-note-list">
          {notes.map((note) => (
            <li key={note.id}>
              <div>
                <div className="helper-row">
                  <span className="badge">{noteAnchor(note, t)}</span>
                  <span className="helper-text">{note.authorName || copy.anonymousAuthor}</span>
                </div>
                <p>{note.body}</p>
                {note.createdAt ? (
                  <small className="helper-text">{new Date(note.createdAt).toLocaleString(locale === "en" ? "en-US" : "ar-SA")}</small>
                ) : null}
              </div>
              <button
                type="button"
                className="button button-danger button-sm"
                onClick={() => void onDelete(note.id)}
                aria-label={copy.deleteAriaLabel}
              >
                {copy.deleteButton}
              </button>
            </li>
          ))}
        </ul>
      ) : !loading ? (
        <EmptyState
          title={copy.emptyTitle}
          description={copy.emptyDescription}
        />
      ) : null}
    </article>
  );
}
