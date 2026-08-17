"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { createArchiveApiClient, type MediaClip } from "@/lib/archive-api";
import { isValidClipRange } from "@/lib/media/clip-range";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const api = createArchiveApiClient();

export interface ClipListVersion {
  /** null means the record's primary source (no attachment row). */
  attachmentId: string | null;
  label: string;
}

interface ClipListPanelProps {
  recordId: string;
  store: string;
  versionA: ClipListVersion;
  versionB: ClipListVersion;
  /** Live playhead of whichever player is showing this side, in seconds. */
  currentTimeA: number;
  currentTimeB: number;
}

type ClipsState = { status: "loading" } | { status: "ready"; clips: MediaClip[] } | { status: "error"; message: string };

function formatSeconds(seconds: number): string {
  return Number.isFinite(seconds) ? seconds.toFixed(2) : "0";
}

/**
 * Non-destructive clip list scoped to one of the two versions being
 * compared (V3-MEDIA-004). Clips are pure metadata -- creating, editing, or
 * deleting one never touches the underlying media file.
 */
export default function ClipListPanel({ recordId, store, versionA, versionB, currentTimeA, currentTimeB }: Readonly<ClipListPanelProps>) {
  const { t } = useLocale();
  const copy = t.pages.mediaCompare.clips;
  const [scope, setScope] = useState<"a" | "b">("a");
  const [state, setState] = useState<ClipsState>({ status: "loading" });
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [inSeconds, setInSeconds] = useState("0");
  const [outSeconds, setOutSeconds] = useState("1");
  const [fps, setFps] = useState("25");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<"json" | "csv" | null>(null);
  const [formStatus, setFormStatus] = useState("");

  const activeVersion = scope === "a" ? versionA : versionB;
  const activeCurrentTime = scope === "a" ? currentTimeA : currentTimeB;

  const load = useCallback(async () => {
    setState({ status: "loading" });
    const response = await api.mediaClips(recordId, {
      store,
      attachmentId: activeVersion.attachmentId ?? undefined
    });
    if (!response.ok) {
      setState({ status: "error", message: response.error });
      return;
    }
    // The API only filters by attachmentId when one is given -- a null
    // (primary-source) scope has to be narrowed client-side, same
    // limitation review-sessions' index has for the same reason.
    const clips = activeVersion.attachmentId === null ? response.clips.filter((clip) => clip.attachmentId === null) : response.clips;
    setState({ status: "ready", clips });
  }, [recordId, store, activeVersion.attachmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const inValue = Number(inSeconds);
    const outValue = Number(outSeconds);
    const fpsValue = Number(fps) || 25;

    if (!title.trim() || !isValidClipRange(inValue, outValue)) {
      setFormStatus(copy.rangeError);
      return;
    }

    setBusy(true);
    setFormStatus("");
    const response = await api.createMediaClip(recordId, {
      store,
      attachmentId: activeVersion.attachmentId,
      title: title.trim(),
      notes: notes.trim() || null,
      inSeconds: inValue,
      outSeconds: outValue,
      fps: fpsValue
    });
    setBusy(false);

    if (!response.ok) {
      setFormStatus(response.error || copy.addError);
      return;
    }

    setTitle("");
    setNotes("");
    setState((current) => (current.status === "ready" ? { status: "ready", clips: [...current.clips, response.clip] } : current));
  }

  async function handleDelete(clipId: string) {
    if (!window.confirm(copy.deleteConfirm)) return;
    const response = await api.deleteMediaClip(clipId);
    if (!response.ok) {
      setFormStatus(response.error);
      return;
    }
    setState((current) => (current.status === "ready" ? { status: "ready", clips: current.clips.filter((clip) => clip.id !== clipId) } : current));
  }

  async function handleExport(format: "json" | "csv") {
    setExporting(format);
    setFormStatus("");
    const response = await api.downloadMediaClipsExport(recordId, format, { store, attachmentId: activeVersion.attachmentId ?? undefined });
    setExporting(null);

    if (!response.ok) {
      setFormStatus(response.error || copy.exportError);
      return;
    }

    const href = URL.createObjectURL(response.blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = response.filename;
    link.click();
    URL.revokeObjectURL(href);
  }

  const clips = state.status === "ready" ? state.clips : [];

  return (
    <article className="panel" aria-label={copy.title}>
      <div className="panel-title-row">
        <div>
          <h2>{copy.title}</h2>
          <p className="helper-text">{copy.description}</p>
        </div>
        <span className="badge">
          {clips.length} {copy.countLabel}
        </span>
      </div>

      <div className="checkbox-row" role="group" aria-label={copy.belongsToLabel}>
        <button type="button" className={`button button-sm ${scope === "a" ? "button-primary" : "button-secondary"}`} aria-pressed={scope === "a"} onClick={() => setScope("a")}>
          {versionA.label}
        </button>
        <button type="button" className={`button button-sm ${scope === "b" ? "button-primary" : "button-secondary"}`} aria-pressed={scope === "b"} onClick={() => setScope("b")}>
          {versionB.label}
        </button>
      </div>

      {state.status === "loading" ? <Skeleton label={copy.loadingLabel} /> : null}
      {state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.loadError}</strong>
          <span className="helper-text">{state.message}</span>
        </div>
      ) : null}

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          {copy.titleLabel}
          <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={copy.titlePlaceholder} required />
        </label>
        <label>
          {copy.notesLabel}
          <input type="text" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={copy.notesPlaceholder} />
        </label>
        <div className="media-compare-grid">
          <label>
            {copy.inLabel}
            <input type="number" min={0} step="0.01" value={inSeconds} onChange={(event) => setInSeconds(event.target.value)} />
          </label>
          <button type="button" className="button button-secondary button-sm" onClick={() => setInSeconds(formatSeconds(activeCurrentTime))}>
            {copy.useCurrentTimeIn}
          </button>
          <label>
            {copy.outLabel}
            <input type="number" min={0} step="0.01" value={outSeconds} onChange={(event) => setOutSeconds(event.target.value)} />
          </label>
          <button type="button" className="button button-secondary button-sm" onClick={() => setOutSeconds(formatSeconds(activeCurrentTime))}>
            {copy.useCurrentTimeOut}
          </button>
          <label>
            {copy.fpsLabel}
            <input type="number" min={1} max={120} step="1" value={fps} onChange={(event) => setFps(event.target.value)} />
          </label>
        </div>
        <button type="submit" className="button button-primary" disabled={busy}>
          {busy ? copy.addingButton : copy.addButton}
        </button>
        {formStatus ? <p className="form-status">{formStatus}</p> : null}
      </form>

      <div className="button-row">
        <button type="button" className="button button-secondary button-sm" onClick={() => void handleExport("json")} disabled={exporting !== null}>
          {exporting === "json" ? copy.exportingButton : copy.exportJsonButton}
        </button>
        <button type="button" className="button button-secondary button-sm" onClick={() => void handleExport("csv")} disabled={exporting !== null}>
          {exporting === "csv" ? copy.exportingButton : copy.exportCsvButton}
        </button>
      </div>

      {state.status === "ready" && clips.length === 0 ? <p className="helper-text">{copy.empty}</p> : null}

      {clips.length ? (
        <ul className="record-note-list">
          {clips.map((clip) => (
            <li key={clip.id}>
              <div>
                <div className="helper-row">
                  <strong>{clip.title}</strong>
                  <span className="badge" dir="ltr">
                    {formatSeconds(clip.inSeconds)}s – {formatSeconds(clip.outSeconds)}s @ {clip.fps}fps
                  </span>
                  {!clip.isCurrentVersion ? <span className="badge">{copy.staleBadge}</span> : null}
                </div>
                {clip.notes ? <p>{clip.notes}</p> : null}
              </div>
              <button type="button" className="button button-danger button-sm" onClick={() => void handleDelete(clip.id)} aria-label={copy.deleteAriaLabel}>
                {copy.deleteAriaLabel}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
