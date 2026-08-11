"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import MediaPlayer from "@/components/MediaPlayer";
import PageToolbar from "@/components/PageToolbar";
import OperationalSafetyPanel from "@/components/OperationalSafetyPanel";
import {
  createArchiveApiClient,
  type CollaborationLock,
  type CollaborationParticipant,
  type ReviewComment
} from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

function formatClock(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function formatTimecode(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  return [hours, minutes, secs].map((value) => value.toString().padStart(2, "0")).join(":");
}

function sortComments(comments: ReviewComment[]) {
  return [...comments].sort((left, right) => left.timecodeSeconds - right.timecodeSeconds || left.id.localeCompare(right.id));
}

export default function BroadcastSimulationPage() {
  const { locale, t } = useLocale();
  const copy = t.pages.broadcast;
  const api = useMemo(() => createArchiveApiClient(), []);
  const [mediaPath, setMediaPath] = useState("media-123");
  const [roomKey, setRoomKey] = useState("broadcast-main");
  const [status, setStatus] = useState<"viewing" | "reviewing" | "editing">("reviewing");
  const [participants, setParticipants] = useState<CollaborationParticipant[]>([]);
  const [locks, setLocks] = useState<CollaborationLock[]>([]);
  const [clock, setClock] = useState(new Date());
  const [timecode, setTimecode] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rundown, setRundown] = useState("");
  const [rundownVersion, setRundownVersion] = useState(0);
  const [rundownMessage, setRundownMessage] = useState(copy.messages.rundownUnloaded);
  const [noteBody, setNoteBody] = useState("");
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [message, setMessage] = useState(copy.messages.ready);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocking, setIsLocking] = useState(false);

  const currentRoomKey = roomKey.trim();
  const currentMediaPath = mediaPath.trim();
  const activeLock = locks.find((lock) => lock.resourceId === currentMediaPath);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const refreshRoom = useCallback(async () => {
    if (!currentRoomKey) return;

    try {
      const presence = await api.sendCollaborationHeartbeat(currentRoomKey, {
        status,
        resourceId: currentMediaPath || undefined,
        cursor: {
          surface: "broadcast-simulation",
          timecodeSeconds: timecode,
          playing: isPlaying
        }
      });

      if (presence.ok) {
        setParticipants(presence.participants);
        setMessage(copy.messages.lastHeartbeat.replace("{time}", formatClock(new Date(), locale)));
      } else {
        setError(presence.error);
      }

      const lockResponse = await api.collaborationLocks(currentRoomKey);
      if (lockResponse.ok) {
        setLocks(lockResponse.locks);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errors.refresh);
    }
  }, [api, copy.errors.refresh, copy.messages.lastHeartbeat, currentMediaPath, currentRoomKey, isPlaying, locale, status, timecode]);

  useEffect(() => {
    void refreshRoom();
    const interval = setInterval(() => void refreshRoom(), 10000);
    return () => clearInterval(interval);
  }, [refreshRoom]);

  useEffect(() => {
    if (!currentRoomKey || !currentMediaPath) return;

    let active = true;

    void (async () => {
      const [documentResponse, commentsResponse] = await Promise.all([
        api.collaborationDocument(currentRoomKey, currentMediaPath),
        api.reviewComments(currentMediaPath)
      ]);

      if (!active) return;

      if (documentResponse.ok) {
        setRundown(documentResponse.document.content);
        setRundownVersion(documentResponse.document.version);
        setRundownMessage(documentResponse.document.version > 0 ? copy.messages.latestRundown : copy.messages.newRundown);
      } else {
        setRundownMessage(documentResponse.error);
      }

      if (commentsResponse.ok) {
        setComments(sortComments(commentsResponse.comments));
      }
    })();

    return () => {
      active = false;
    };
  }, [api, copy.messages.latestRundown, copy.messages.newRundown, currentMediaPath, currentRoomKey]);

  const handleMediaState = (element: HTMLMediaElement) => {
    setTimecode(Math.round(element.currentTime * 100) / 100);
    setIsPlaying(!element.paused);
  };

  const toggleLock = async () => {
    if (!currentRoomKey || !currentMediaPath) return;

    setIsLocking(true);
    setError(null);
    try {
      const response = activeLock
        ? await api.releaseCollaborationLock(currentRoomKey, { resourceId: currentMediaPath })
        : await api.acquireCollaborationLock(currentRoomKey, { resourceId: currentMediaPath, ttlSeconds: 180 });

      if (response.ok) {
        setLocks(response.locks);
        setMessage(activeLock ? copy.messages.lockReleased : copy.messages.lockReserved);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errors.lock);
    } finally {
      setIsLocking(false);
    }
  };

  const saveRundown = async () => {
    if (!currentRoomKey || !currentMediaPath) return;

    setIsSaving(true);
    setError(null);
    try {
      const response = await api.updateCollaborationDocument(currentRoomKey, currentMediaPath, {
        content: rundown,
        version: rundownVersion
      });

      if (response.ok) {
        setRundown(response.document.content);
        setRundownVersion(response.document.version);
        setRundownMessage(copy.messages.saved.replace("{time}", formatClock(new Date(), locale)));
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errors.save);
    } finally {
      setIsSaving(false);
    }
  };

  const addNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!noteBody.trim() || !currentMediaPath) return;

    setError(null);
    const response = await api.createReviewComment(currentMediaPath, {
      body: noteBody.trim(),
      timecodeSeconds: timecode
    });

    if (response.ok) {
      setComments((current) => sortComments([...current, response.comment]));
      setNoteBody("");
      return;
    }

    setError(response.error);
  };

  return (
    <AppShell subtitle={t.pageTitles.broadcastSimulation} navLabel={t.pageTitles.broadcast} contentClassName="broadcast-content" tipsPage="broadcast">
      <PageToolbar
        eyebrow={<span className="badge">{copy.toolbar.eyebrow}</span>}
        title={copy.toolbar.title}
        description={copy.toolbar.description}
        meta={
          <>
            <span className="badge">{formatClock(clock, locale)}</span>
            <span className="badge">{formatTimecode(timecode)}</span>
            <span className="badge">{copy.toolbar.participants.replace("{count}", String(participants.length))}</span>
          </>
        }
      />

      <OperationalSafetyPanel action={copy.toolbar.safetyAction} dryRun confidence={85} auditHref="/activity" />

      {error ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.errors.operation}</strong>
          <p className="helper-text">{error}</p>
        </div>
      ) : null}

      <section className="panel form-grid" aria-label={copy.settings.aria}>
        <label>
          {copy.settings.room}
          <input value={roomKey} onChange={(event) => setRoomKey(event.target.value)} dir="ltr" />
        </label>
        <label>
          {copy.settings.mediaPath}
          <input value={mediaPath} onChange={(event) => setMediaPath(event.target.value)} dir="ltr" />
        </label>
        <label>
          {copy.settings.status}
          <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
            <option value="viewing">{copy.settings.viewing}</option>
            <option value="reviewing">{copy.settings.reviewing}</option>
            <option value="editing">{copy.settings.editing}</option>
          </select>
        </label>
      </section>

      <div className="broadcast-grid">
        <section className="panel stack" aria-label={copy.player.aria}>
          <div className="panel-title-row">
            <div>
              <h2>{copy.player.title}</h2>
              <p>{message}</p>
            </div>
            <button className="button button-secondary" type="button" onClick={() => void refreshRoom()}>
              {copy.player.refresh}
            </button>
          </div>
          {currentMediaPath ? (
            <MediaPlayer
              path={currentMediaPath}
              title={copy.player.mediaTitle}
              showTimeline
              onTimeUpdate={handleMediaState}
              onPlayPause={handleMediaState}
            />
          ) : (
            <EmptyState title={copy.player.emptyTitle} description={copy.player.emptyDescription} />
          )}
          <div className="kv-grid">
            <div className="kv-item">
              <strong>{copy.player.playback}</strong>
              <span>{isPlaying ? copy.player.playing : copy.player.stopped}</span>
            </div>
            <div className="kv-item">
              <strong>{copy.player.controlLock}</strong>
              <span>{activeLock ? activeLock.displayName : copy.player.available}</span>
            </div>
          </div>
          <button className="button button-primary" type="button" onClick={() => void toggleLock()} disabled={!currentMediaPath || isLocking}>
            {activeLock ? copy.player.releaseLock : copy.player.reserveLock}
          </button>
        </section>

        <aside className="stack" aria-label={copy.presence.aria}>
          <section className="panel">
            <div className="panel-title-row">
              <div>
                <h2>{copy.presence.title}</h2>
                <p>{copy.presence.description}</p>
              </div>
              <span className="badge">{participants.length}</span>
            </div>
            {participants.length === 0 ? (
              <p className="helper-text">{copy.presence.empty}</p>
            ) : (
              <div className="mobile-card-list" role="list">
                {participants.map((participant) => (
                  <article className="local-list-card" key={participant.id} role="listitem">
                    <strong>{participant.displayName}</strong>
                    <span className="badge">{participant.status}</span>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel stack">
            <div className="panel-title-row">
              <div>
                <h2>{copy.rundown.title}</h2>
                <p>{rundownMessage}</p>
              </div>
              <span className="badge">v{rundownVersion}</span>
            </div>
            <textarea
              value={rundown}
              onChange={(event) => setRundown(event.target.value)}
              rows={8}
              placeholder={copy.rundown.placeholder}
            />
            <button className="button button-primary" type="button" onClick={() => void saveRundown()} disabled={isSaving || !currentMediaPath}>
              {isSaving ? copy.rundown.saving : copy.rundown.save}
            </button>
          </section>
        </aside>
      </div>

      <section className="panel stack" aria-label={copy.notes.aria}>
        <div className="panel-title-row">
          <div>
            <h2>{copy.notes.title}</h2>
            <p>{copy.notes.description}</p>
          </div>
          <span className="badge">{comments.length}</span>
        </div>
        <form className="form-grid" onSubmit={addNote}>
          <label>
            {copy.notes.label}
            <input value={noteBody} onChange={(event) => setNoteBody(event.target.value)} />
          </label>
          <div className="kv-item">
            <strong>{copy.notes.time}</strong>
            <span>{formatTimecode(timecode)}</span>
          </div>
          <div className="button-row form-actions">
            <button className="button button-primary" type="submit" disabled={!noteBody.trim() || !currentMediaPath}>
              {copy.notes.add}
            </button>
          </div>
        </form>
        {comments.length === 0 ? (
          <p className="helper-text">{copy.notes.empty}</p>
        ) : (
          <div className="mobile-card-list" role="list">
            {comments.map((comment) => (
              <article className="local-list-card" key={comment.id} role="listitem">
                <div className="panel-title-row">
                  <strong>{formatTimecode(comment.timecodeSeconds)}</strong>
                  <span className="badge">{comment.author}</span>
                </div>
                <p>{comment.body}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
