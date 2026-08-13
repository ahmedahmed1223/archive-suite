"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import MediaPlayer from "@/components/MediaPlayer";
import MediaSourcePicker from "@/components/MediaSourcePicker";
import OperationalSafetyPanel from "@/components/OperationalSafetyPanel";
import PageToolbar from "@/components/PageToolbar";
import { parseSubtitles } from "@/lib/media/subtitles";
import { createArchiveApiClient, type RecordNote } from "@/lib/archive-api";
import { bookmarkNotes, formatBookmarkTime } from "@/lib/timestamp-bookmarks";
import styles from "./play.module.css";
import "../media.css";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function MediaPlayPage() {
  const { t } = useLocale();
  const copy = t.pages.mediaPlay;
  const [pathInput, setPathInput] = useState("");
  const [diskInput, setDiskInput] = useState("");
  const [path, setPath] = useState("");
  const [disk, setDisk] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [transcriptFileName, setTranscriptFileName] = useState("");
  const [transcriptStatus, setTranscriptStatus] = useState("");
  const [recordId, setRecordId] = useState("");
  const [recordStore, setRecordStore] = useState("");
  const [initialTime, setInitialTime] = useState<number | undefined>();
  const transcriptCueCount = parseSubtitles(transcriptText).length;
  const api = useMemo(() => createArchiveApiClient(), []);
  const playerRef = useRef<HTMLMediaElement | null>(null);
  const [bookmarks, setBookmarks] = useState<RecordNote[]>([]);
  const [bookmarkStatus, setBookmarkStatus] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pathParam = params.get("path")?.trim() ?? "";
    const diskParam = params.get("disk")?.trim() ?? "";
    const recordIdParam = params.get("recordId")?.trim() ?? "";
    const timeParam = Number(params.get("at"));

    if (pathParam) {
      setPathInput(pathParam);
      setPath(pathParam);
    }

    if (diskParam) {
      setDiskInput(diskParam);
      setDisk(diskParam);
    }

    if (Number.isFinite(timeParam) && timeParam >= 0) setInitialTime(timeParam);

    if (!recordIdParam) return;

    setRecordId(recordIdParam);
    setTranscriptStatus(copy.loadingSavedTranscript);
    void api.record(recordIdParam)
      .then((response) => {
        if (!response.ok) {
          setTranscriptStatus(copy.savedTranscriptLoadError.replace("{error}", response.error));
          return;
        }

        setTranscriptText(response.record.transcript ?? "");
        const loadedStore = response.record.store || "archive-items";
        setRecordStore(loadedStore);
        void api.recordNotes(recordIdParam, loadedStore).then((notesResponse) => {
          if (notesResponse.ok) setBookmarks(bookmarkNotes(notesResponse.notes));
        });
        setTranscriptStatus(response.record.transcript?.trim() ? copy.savedTranscriptLoaded : copy.noSavedTranscript);
      })
      .catch(() => setTranscriptStatus(copy.savedTranscriptLoadFailure));
  }, [api, copy]);

  async function addBookmark() {
    if (!recordId || !playerRef.current) return;
    const body = window.prompt(copy.bookmarkPromptTitle, copy.bookmarkPromptDefault)?.trim();
    if (!body) return;
    const response = await api.createRecordNote(recordId, { body, timestampSeconds: playerRef.current.currentTime }, recordStore || "archive-items");
    if (!response.ok) {
      setBookmarkStatus(response.error || copy.bookmarkSaveError);
      return;
    }
    setBookmarks((current) => bookmarkNotes([...current, response.note]));
    setBookmarkStatus(copy.bookmarkSaved);
  }

  async function handleTranscriptFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["srt", "vtt"].includes(extension)) {
      setTranscriptStatus(copy.invalidTranscriptFile);
      return;
    }

    try {
      const text = await file.text();
      const cues = parseSubtitles(text);
      if (cues.length === 0) {
        setTranscriptStatus(copy.noValidCues);
        return;
      }

      setTranscriptText(text);
      setTranscriptFileName(file.name);
      if (!recordId) {
        setTranscriptStatus(copy.importedPreview.replace("{count}", String(cues.length)));
        return;
      }

      setTranscriptStatus(copy.savingTranscript);
      const response = await api.updateRecordTranscript(recordId, {
        transcript: text,
        ...(recordStore ? { store: recordStore } : {})
      });
      setTranscriptStatus(
        response.ok
          ? copy.importedAndSaved.replace("{count}", String(cues.length))
          : copy.importedSaveError.replace("{error}", response.error)
      );
    } catch (error) {
      setTranscriptStatus(error instanceof Error ? error.message : copy.readTranscriptError);
    } finally {
      event.target.value = "";
    }
  }

  function clearTranscript() {
    setTranscriptText("");
    setTranscriptFileName("");
    setTranscriptStatus("");
  }

  return (
    <AppShell subtitle={t.pageTitles.mediaPlayer} contentClassName={styles.playContent} tipsPage="media-play">
      <PageToolbar
        eyebrow={<span className="badge">{copy.eyebrow}</span>}
        title={copy.title}
        description={copy.description}
        meta={<span className="badge">{path ? copy.playing : copy.waitingForPath}</span>}
      >
        <form
          className={`auth-form ${styles.pathInputForm}`}
          onSubmit={(event) => {
            event.preventDefault();
            setPath(pathInput.trim());
            setDisk(diskInput.trim());
          }}
        >
          <label>
            {copy.recordPathLabel}
            <input
              value={pathInput}
              onChange={(event) => setPathInput(event.target.value)}
              placeholder={copy.recordPathPlaceholder}
              aria-label={copy.recordPathAriaLabel}
            />
            <p className="helper-text">{copy.recordPathHelp}</p>
          </label>
          <label>
            {copy.diskLabel}
            <input
              value={diskInput}
              onChange={(event) => setDiskInput(event.target.value)}
              placeholder={copy.diskPlaceholder}
              aria-label={copy.diskAriaLabel}
            />
            <p className="helper-text">{copy.diskHelp}</p>
          </label>
          <button type="submit" className="button button-primary">{copy.play}</button>
          <MediaSourcePicker
            label={copy.browseSources}
            onSelect={(selectedPath) => {
              setPathInput(selectedPath);
              setPath(selectedPath);
            }}
          />
        </form>
      </PageToolbar>

      <OperationalSafetyPanel action={copy.safetyAction} dryRun confidence={96} auditHref="/activity" />

      {path ? (
        <div className={styles.theaterLayout}>
          <article className={`panel media-frame ${styles.playerPanel}`}>
            <MediaPlayer
              path={path}
              disk={disk || undefined}
              title={disk ? `${disk}:${path}` : path}
              initialTime={initialTime}
              showTimeline
              transcriptText={transcriptText}
              onReady={(element) => { playerRef.current = element; }}
            />
            {recordId ? <div className="button-row"><button type="button" className="button button-secondary button-sm" onClick={() => void addBookmark()}>{copy.addBookmark}</button>{bookmarkStatus ? <span className="form-status">{bookmarkStatus}</span> : null}</div> : null}
            {bookmarks.length ? <div className="button-row" aria-label={copy.bookmarksAriaLabel}>{bookmarks.map((bookmark) => <button type="button" className="badge" key={bookmark.id} onClick={() => { if (playerRef.current && bookmark.timestampSeconds !== null) playerRef.current.currentTime = bookmark.timestampSeconds; }}>{formatBookmarkTime(bookmark.timestampSeconds ?? 0)} · {bookmark.body}</button>)}</div> : null}
          </article>

          <section className={`panel stack ${styles.transcriptPanel}`} aria-label={copy.transcriptAriaLabel}>
            <div className="panel-title-row">
              <div>
                <h2>{copy.transcriptTitle}</h2>
                <p>{recordId ? copy.transcriptStored : copy.transcriptPreview}</p>
              </div>
              <span className="badge">{transcriptCueCount > 0 ? copy.cueCount.replace("{count}", String(transcriptCueCount)) : copy.optional}</span>
            </div>
            <div className={styles.transcriptActions}>
              <label className="button button-secondary button-sm">
                {copy.importTranscript}
                <input
                  type="file"
                  accept=".srt,.vtt,text/vtt"
                  onChange={handleTranscriptFile}
                  className={styles.transcriptFileInput}
                />
              </label>
              <button type="button" className="button button-secondary button-sm" onClick={clearTranscript} disabled={!transcriptText.trim()}>
                {copy.clearTranscript}
              </button>
              {transcriptFileName ? <span className="badge">{transcriptFileName}</span> : null}
            </div>
            {transcriptStatus ? <p className="form-status">{transcriptStatus}</p> : null}
            <textarea
              value={transcriptText}
              onChange={(event) => setTranscriptText(event.target.value)}
              rows={7}
              dir="ltr"
              placeholder={copy.transcriptPlaceholder}
              className={styles.transcriptInput}
            />
          </section>
        </div>
      ) : (
        <EmptyState
          title={copy.emptyTitle}
          description={copy.emptyDescription}
        />
      )}
    </AppShell>
  );
}
