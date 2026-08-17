"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import MediaPlayer from "@/components/MediaPlayer";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { createArchiveApiClient, type TranscriptCue, type TranscriptVersion } from "@/lib/archive-api";
import { formatCueTime, serializeSrt, serializeVtt, validateCueOrder, type Cue, type CueOrderError } from "@/lib/media/subtitles";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import styles from "./transcriber.module.css";

function toEditorCues(cues: TranscriptCue[]): Cue[] {
  return cues.map((cue, index) => ({ index: index + 1, start: cue.startSeconds, end: cue.endSeconds, text: cue.text }));
}

function toApiCues(cues: Cue[]): TranscriptCue[] {
  return cues.map((cue) => ({ startSeconds: cue.start, endSeconds: cue.end, text: cue.text }));
}

function errorMessage(
  error: CueOrderError,
  t: { errorInverted: string; errorOutOfOrder: string; errorOverlap: string }
): string {
  if (error.kind === "inverted") return t.errorInverted.replace("{index}", String(error.cueIndex));
  if (error.kind === "out-of-order") {
    return t.errorOutOfOrder.replace("{index}", String(error.cueIndex)).replace("{other}", String(error.otherCueIndex));
  }
  return t.errorOverlap.replace("{index}", String(error.cueIndex)).replace("{other}", String(error.otherCueIndex));
}

export default function CueEditor() {
  const { t } = useLocale();
  const copy = t.pages.transcriber.cueEditor;
  const api = useMemo(() => createArchiveApiClient(), []);
  const dialogs = useConfirmDialog();

  const [recordId, setRecordId] = useState("");
  const [store, setStore] = useState("");
  const [sourcePath, setSourcePath] = useState("");
  const [disk, setDisk] = useState("");

  const [cues, setCues] = useState<Cue[]>([]);
  const [format, setFormat] = useState<"srt" | "vtt">("srt");
  const [locked, setLocked] = useState(false);
  const [history, setHistory] = useState<TranscriptVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "status" | "error"; text: string } | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const mediaRef = useRef<HTMLMediaElement | null>(null);

  const errors = useMemo(() => validateCueOrder(cues), [cues]);

  const setInfo = useCallback((text: string) => setMessage({ tone: "status", text }), []);
  const setError = useCallback((text: string) => setMessage({ tone: "error", text }), []);

  const loadTranscript = useCallback(async () => {
    if (!recordId.trim()) return;
    setLoading(true);
    setMessage(null);
    const response = await api.transcriptVersions(recordId.trim(), { store: store.trim() || undefined });
    setLoading(false);
    if (!response.ok) {
      setError(copy.loadError.replace("{error}", response.error));
      return;
    }
    setCues(toEditorCues(response.current.cues));
    setFormat(response.current.format === "vtt" ? "vtt" : "srt");
    setLocked(response.current.locked);
    setHistory(response.versions);
  }, [api, copy.loadError, recordId, store, setError]);

  const updateCue = useCallback((index: number, patch: Partial<Pick<Cue, "start" | "end" | "text">>) => {
    setCues((current) => current.map((cue) => (cue.index === index ? { ...cue, ...patch } : cue)));
  }, []);

  const addCue = useCallback(() => {
    setCues((current) => {
      const last = current.at(-1);
      const start = last ? last.end : 0;
      return [...current, { index: current.length + 1, start, end: start + 2, text: "" }];
    });
  }, []);

  const removeCue = useCallback((index: number) => {
    setCues((current) => current.filter((cue) => cue.index !== index).map((cue, position) => ({ ...cue, index: position + 1 })));
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const element = mediaRef.current;
    if (!element) return;
    element.currentTime = Math.max(0, seconds);
    setCurrentTime(element.currentTime);
  }, []);

  const persistVersion = useCallback(
    async (unlock: boolean) => {
      const response = await api.saveTranscriptVersion(recordId.trim(), {
        store: store.trim() || undefined,
        format,
        unlock,
        cues: toApiCues(cues),
      });
      return response;
    },
    [api, cues, format, recordId, store]
  );

  const save = useCallback(async () => {
    if (!recordId.trim() || cues.length === 0) return;
    if (errors.length > 0) {
      setError(copy.validationBlocked);
      return;
    }

    setSaving(true);
    setMessage(null);
    let response = await persistVersion(false);

    if (!response.ok && response.code === "CONFLICT") {
      const confirmed = await dialogs.confirm({
        title: copy.unlockConfirmTitle,
        message: copy.unlockConfirmMessage,
      });
      if (!confirmed) {
        setSaving(false);
        return;
      }
      response = await persistVersion(true);
    }

    setSaving(false);
    if (!response.ok) {
      setError(copy.saveError.replace("{error}", response.error));
      return;
    }

    setLocked(response.version.locked);
    setInfo(copy.saveSuccess);
    await loadTranscript();
  }, [copy, cues.length, dialogs, errors.length, loadTranscript, persistVersion, recordId, setError, setInfo]);

  const lock = useCallback(async () => {
    if (!recordId.trim()) return;
    const confirmed = await dialogs.confirm({ title: copy.lockConfirmTitle, message: copy.lockConfirmMessage });
    if (!confirmed) return;

    const response = await api.lockTranscriptVersion(recordId.trim(), { store: store.trim() || undefined });
    if (!response.ok) {
      setError(copy.lockError.replace("{error}", response.error));
      return;
    }
    setLocked(true);
    setInfo(copy.lockSuccess);
    await loadTranscript();
  }, [api, copy, dialogs, loadTranscript, recordId, setError, setInfo, store]);

  const restore = useCallback(
    async (versionId: string) => {
      if (!recordId.trim()) return;
      const confirmed = await dialogs.confirm({ title: copy.restoreConfirmTitle, message: copy.restoreConfirmMessage });
      if (!confirmed) return;

      let response = await api.restoreTranscriptVersion(recordId.trim(), versionId, { store: store.trim() || undefined });
      if (!response.ok && response.code === "CONFLICT") {
        const unlockConfirmed = await dialogs.confirm({ title: copy.unlockConfirmTitle, message: copy.unlockConfirmMessage });
        if (!unlockConfirmed) return;
        response = await api.restoreTranscriptVersion(recordId.trim(), versionId, { store: store.trim() || undefined, unlock: true });
      }

      if (!response.ok) {
        setError(copy.restoreError.replace("{error}", response.error));
        return;
      }

      setInfo(copy.restoreSuccess);
      await loadTranscript();
    },
    [api, copy, dialogs, loadTranscript, recordId, setError, setInfo, store]
  );

  function downloadAs(kind: "srt" | "vtt") {
    if (cues.length === 0) return;
    const content = kind === "vtt" ? serializeVtt(cues) : serializeSrt(cues);
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `transcript.${kind}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel stack" aria-labelledby="cue-editor-title">
      <div className="panel-section-header">
        <div>
          <h2 id="cue-editor-title">{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <span className="badge">{locked ? copy.lockedBadge : copy.unlockedBadge}</span>
      </div>

      <div className="archive-toolbar-grid">
        <label>
          <span>{copy.recordIdLabel}</span>
          <input value={recordId} onChange={(event) => setRecordId(event.target.value)} placeholder={copy.recordIdPlaceholder} />
        </label>
        <label>
          <span>{copy.storeLabel}</span>
          <input value={store} onChange={(event) => setStore(event.target.value)} />
        </label>
        <label>
          <span>{copy.sourcePathLabel}</span>
          <input value={sourcePath} onChange={(event) => setSourcePath(event.target.value)} placeholder={copy.sourcePathPlaceholder} />
        </label>
        <label>
          <span>{copy.diskLabel}</span>
          <input value={disk} onChange={(event) => setDisk(event.target.value)} />
        </label>
      </div>

      <div className="button-row">
        <button type="button" className="button button-secondary" onClick={() => void loadTranscript()} disabled={!recordId.trim() || loading}>
          {loading ? copy.loading : copy.loadButton}
        </button>
      </div>

      {message ? (
        <p className={`form-status ${message.tone === "error" ? "status-error" : ""}`} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      ) : null}

      {sourcePath ? (
        <div aria-label={copy.playerAriaLabel}>
          <MediaPlayer
            path={sourcePath}
            disk={disk || undefined}
            onReady={(el) => {
              mediaRef.current = el;
            }}
            onTimeUpdate={(el) => setCurrentTime(el.currentTime)}
            showTranscriptList={false}
          />
        </div>
      ) : null}

      <fieldset className="stack">
        <legend>{copy.cuesLegend.replace("{count}", String(cues.length))}</legend>
        <div className={styles.cueEditorList}>
          {cues.map((cue) => (
            <div className={styles.cueEditorRow} key={cue.index}>
              <label>
                <span>{copy.startLabel}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cue.start}
                  onChange={(event) => updateCue(cue.index, { start: Number(event.target.value) || 0 })}
                />
              </label>
              <label>
                <span>{copy.endLabel}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cue.end}
                  onChange={(event) => updateCue(cue.index, { end: Number(event.target.value) || 0 })}
                />
              </label>
              <label className={styles.cueEditorText}>
                <span>{copy.textLabel}</span>
                <input dir="auto" value={cue.text} onChange={(event) => updateCue(cue.index, { text: event.target.value })} />
              </label>
              <div className="button-row">
                <button type="button" className="button button-secondary button-sm" onClick={() => seekTo(cue.start)} aria-label={copy.seekAriaLabel.replace("{index}", String(cue.index))}>
                  {copy.seekButton}
                </button>
                <button type="button" className="button button-secondary button-sm" onClick={() => removeCue(cue.index)} aria-label={copy.removeCueAriaLabel.replace("{index}", String(cue.index))}>
                  {copy.removeCueButton}
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="button-row">
          <button type="button" className="button button-secondary" onClick={addCue}>
            {copy.addCueButton}
          </button>
        </div>
      </fieldset>

      {errors.length > 0 ? (
        <ul className="form-status status-error" role="alert">
          {errors.map((error, position) => (
            <li key={`${error.cueIndex}-${error.kind}-${position}`}>{errorMessage(error, copy)}</li>
          ))}
        </ul>
      ) : null}

      <p className="helper-text mono-text" dir="ltr">
        {formatCueTime(currentTime)}
      </p>

      <div className="button-row">
        <button type="button" className="button button-primary" onClick={() => void save()} disabled={saving || cues.length === 0 || !recordId.trim()}>
          {saving ? copy.saving : copy.saveButton}
        </button>
        <button type="button" className="button button-secondary" onClick={() => void lock()} disabled={!recordId.trim() || locked}>
          {copy.lockButton}
        </button>
        <button type="button" className="button button-secondary" onClick={() => downloadAs("srt")} disabled={cues.length === 0} title={cues.length === 0 ? copy.downloadDisabled : undefined}>
          {copy.downloadSrtButton}
        </button>
        <button type="button" className="button button-secondary" onClick={() => downloadAs("vtt")} disabled={cues.length === 0} title={cues.length === 0 ? copy.downloadDisabled : undefined}>
          {copy.downloadVttButton}
        </button>
      </div>

      <div className="stack">
        <h3>{copy.historyTitle}</h3>
        {history.length === 0 ? (
          <p className="helper-text">{copy.historyEmpty}</p>
        ) : (
          <ul className={styles.cueEditorHistory}>
            {history.map((version) => (
              <li key={version.id} className="toolbar-row">
                <span>
                  {copy.historyVersionLabel.replace("{date}", version.createdAt ?? "")}
                  {version.locked ? ` · ${copy.historyLockedTag}` : ""}
                  {version.restoredFromVersionId ? ` · ${copy.historyRestoredTag}` : ""}
                </span>
                <button type="button" className="button button-secondary button-sm" onClick={() => void restore(version.id)}>
                  {copy.restoreButton}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
