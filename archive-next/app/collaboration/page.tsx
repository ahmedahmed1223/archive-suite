"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import OperationalSafetyPanel from "@/components/OperationalSafetyPanel";
import {
  createArchiveApiClient,
  type CollaborationDocument,
  type CollaborationLock,
  type CollaborationParticipant,
  type CollaborationStatus
} from "@/lib/archive-api";
import { getEchoClient } from "@/lib/echo";

function StatusPill({ status }: { status: CollaborationStatus }) {
  const { t } = useLocale();

  return (
    <span
      className="badge status-pill"
      data-status={status}
    >
      {t.pages.collaboration.statusLabels[status] ?? status}
    </span>
  );
}

function SectionHeader({
  title,
  description,
  count
}: {
  title: string;
  description: string;
  count?: number;
}) {
  return (
    <div
      className="panel-title-row panel-section-header"
    >
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {typeof count === "number" ? (
        <span className="badge">{count}</span>
      ) : null}
    </div>
  );
}

export default function CollaborationPage() {
  const { locale, t } = useLocale();
  const copy = t.pages.collaboration;
  const timeLocale = locale === "ar" ? "ar-EG" : "en-US";
  const api = useMemo(() => createArchiveApiClient(), []);
  const [roomKey, setRoomKey] = useState("review-1");
  const [resourceId, setResourceId] = useState("media-123");
  const [status, setStatus] = useState<CollaborationStatus>("reviewing");
  const [participants, setParticipants] = useState<CollaborationParticipant[]>([]);
  const [locks, setLocks] = useState<CollaborationLock[]>([]);
  const [activeWindowSeconds, setActiveWindowSeconds] = useState(45);
  const [message, setMessage] = useState(copy.initial.ready);
  const [error, setError] = useState<string | null>(null);
  const [lockMessage, setLockMessage] = useState(copy.initial.noLocksLoaded);
  const [documentContent, setDocumentContent] = useState("");
  const [documentVersion, setDocumentVersion] = useState(0);
  const [documentMeta, setDocumentMeta] = useState<Pick<CollaborationDocument, "updatedByDisplayName" | "updatedAt">>({});
  const [documentMessage, setDocumentMessage] = useState(copy.initial.noDocumentLoaded);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLocking, setIsLocking] = useState<"acquire" | "release" | null>(null);
  const [isDocumentLoading, setIsDocumentLoading] = useState(false);
  const [isDocumentSaving, setIsDocumentSaving] = useState(false);

  useEffect(() => {
    let active = true;
    let interval: ReturnType<typeof setInterval> | undefined;

    const beat = async () => {
      const currentRoomKey = roomKey.trim();
      if (!currentRoomKey) return;

      setIsSyncing(true);
      try {
        const response = await api.sendCollaborationHeartbeat(currentRoomKey, {
          status,
          resourceId: resourceId.trim() || undefined,
          cursor: { surface: "next-collaboration" }
        });

        if (!active) return;

        if (response.ok) {
          setParticipants(response.participants);
          setActiveWindowSeconds(response.activeWindowSeconds);
          setMessage(copy.messages.lastSync.replace("{time}", new Date().toLocaleTimeString(timeLocale)));
          setError(null);
        } else {
          setError(response.error);
        }

        const locksResponse = await api.collaborationLocks(currentRoomKey);
        if (!active) return;
        if (locksResponse.ok) {
          setLocks(locksResponse.locks);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : copy.errors.liveCollaboration);
        }
      } finally {
        if (active) {
          setIsSyncing(false);
        }
      }
    };

    beat();
    interval = setInterval(beat, 15000);

    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [api, copy.errors.liveCollaboration, copy.messages.lastSync, resourceId, roomKey, status, timeLocale]);

  useEffect(() => {
    let active = true;
    const currentRoomKey = roomKey.trim();
    const currentResourceId = resourceId.trim();
    if (!currentRoomKey || !currentResourceId) return;

    const loadDocument = async () => {
      setIsDocumentLoading(true);
      try {
        const response = await api.collaborationDocument(currentRoomKey, currentResourceId);
        if (!active) return;

        if (response.ok) {
          setDocumentContent(response.document.content);
          setDocumentVersion(response.document.version);
          setDocumentMeta({
            updatedAt: response.document.updatedAt,
            updatedByDisplayName: response.document.updatedByDisplayName
          });
          setDocumentMessage(response.document.version > 0 ? copy.messages.loadedLatestVersion : copy.messages.newDraft);
        } else {
          setDocumentMessage(response.error);
        }
      } catch (err) {
        if (active) {
          setDocumentMessage(err instanceof Error ? err.message : copy.errors.loadDocument);
        }
      } finally {
        if (active) {
          setIsDocumentLoading(false);
        }
      }
    };

    void loadDocument();

    return () => {
      active = false;
    };
  }, [api, copy.errors.loadDocument, copy.messages.loadedLatestVersion, copy.messages.newDraft, resourceId, roomKey]);

  // Reverb push is additive to the heartbeat polling above: it merges live
  // deltas immediately, while polling stays as the fallback/reconciliation
  // path if the socket drops.
  useEffect(() => {
    const currentRoomKey = roomKey.trim();
    if (!currentRoomKey) return;

    const echo = getEchoClient();
    if (!echo) return;

    const channel = echo.private(`collaboration.room.${currentRoomKey}`);
    channel.listen(".presence.updated", (event: { participant: CollaborationParticipant }) => {
      setParticipants((current) => {
        const next = current.filter((participant) => participant.id !== event.participant.id);
        next.push(event.participant);
        return next.sort((a, b) => a.displayName.localeCompare(b.displayName));
      });
    });
    channel.listen(".document.updated", (event: { document: CollaborationDocument }) => {
      if (event.document.resourceId !== resourceId.trim()) return;

      setDocumentContent(event.document.content);
      setDocumentVersion(event.document.version);
      setDocumentMeta({
        updatedAt: event.document.updatedAt,
        updatedByDisplayName: event.document.updatedByDisplayName
      });
      setDocumentMessage(copy.messages.liveUpdate.replace("{name}", event.document.updatedByDisplayName ?? copy.messages.anotherParticipant));
    });

    return () => {
      echo.leave(`collaboration.room.${currentRoomKey}`);
    };
  }, [copy.messages.anotherParticipant, copy.messages.liveUpdate, resourceId, roomKey]);

  const refreshPresence = async () => {
    const currentRoomKey = roomKey.trim();
    if (!currentRoomKey) return;

    setIsRefreshing(true);
    try {
      const response = await api.collaborationPresence(currentRoomKey);
      if (response.ok) {
        setParticipants(response.participants);
        setActiveWindowSeconds(response.activeWindowSeconds);
        setMessage(copy.messages.manualUpdate.replace("{time}", new Date().toLocaleTimeString(timeLocale)));
        setError(null);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errors.refreshPresence);
    } finally {
      setIsRefreshing(false);
    }
  };

  const acquireLock = async () => {
    if (!resourceId.trim()) {
      setLockMessage(copy.validation.selectResourceToAcquire);
      return;
    }

    setIsLocking("acquire");
    try {
      const response = await api.acquireCollaborationLock(roomKey.trim(), {
        resourceId: resourceId.trim(),
        ttlSeconds: 120
      });

      if (response.ok) {
        setLocks(response.locks);
        setLockMessage(copy.messages.lockReserved.replace("{resource}", response.lock.resourceId).replace("{expires}", response.lock.expiresAt ?? copy.messages.unspecifiedTime));
        return;
      }

      setLockMessage(response.error);
      if (response.code === "lock_conflict") {
        const conflict = response as typeof response & { lock?: CollaborationLock };
        if (conflict.lock) {
          setLocks([conflict.lock]);
        }
      }
    } catch (err) {
      setLockMessage(err instanceof Error ? err.message : copy.errors.acquireLock);
    } finally {
      setIsLocking(null);
    }
  };

  const releaseLock = async () => {
    if (!resourceId.trim()) {
      setLockMessage(copy.validation.selectResourceToRelease);
      return;
    }

    setIsLocking("release");
    try {
      const response = await api.releaseCollaborationLock(roomKey.trim(), {
        resourceId: resourceId.trim()
      });

      if (response.ok) {
        setLocks(response.locks);
        setLockMessage(response.released ? copy.messages.lockReleased : copy.messages.noOwnedLock);
      } else {
        setLockMessage(response.error);
      }
    } catch (err) {
      setLockMessage(err instanceof Error ? err.message : copy.errors.releaseLock);
    } finally {
      setIsLocking(null);
    }
  };

  const saveDocument = async () => {
    const currentRoomKey = roomKey.trim();
    const currentResourceId = resourceId.trim();
    if (!currentRoomKey || !currentResourceId) {
      setDocumentMessage(copy.validation.selectRoomAndResource);
      return;
    }

    setIsDocumentSaving(true);
    try {
      const response = await api.updateCollaborationDocument(currentRoomKey, currentResourceId, {
        content: documentContent,
        version: documentVersion
      });

      if (response.ok) {
        setDocumentContent(response.document.content);
        setDocumentVersion(response.document.version);
        setDocumentMeta({
          updatedAt: response.document.updatedAt,
          updatedByDisplayName: response.document.updatedByDisplayName
        });
        setDocumentMessage(copy.messages.savedVersion.replace("{version}", String(response.document.version)));
        return;
      }

      const conflict = response as typeof response & { document?: CollaborationDocument; code?: string };
      if (conflict.document) {
        setDocumentContent(conflict.document.content);
        setDocumentVersion(conflict.document.version);
        setDocumentMeta({
          updatedAt: conflict.document.updatedAt,
          updatedByDisplayName: conflict.document.updatedByDisplayName
        });
      }
      setDocumentMessage(response.error);
    } catch (err) {
      setDocumentMessage(err instanceof Error ? err.message : copy.errors.saveDocument);
    } finally {
      setIsDocumentSaving(false);
    }
  };

  return (
    <AppShell subtitle={t.pageTitles.liveCollaboration} navLabel={t.pageTitles.liveCollaboration} contentClassName="collaboration-content" tipsPage="collaboration">
      <PageToolbar
        eyebrow={<span className="badge">{isSyncing ? copy.toolbar.syncing : copy.toolbar.activeSync}</span>}
        title={copy.toolbar.title}
        description={copy.toolbar.description}
        meta={
          <>
            <span className="badge">{copy.toolbar.activeWindow.replace("{seconds}", String(activeWindowSeconds))}</span>
            <span className="badge">{copy.toolbar.activeParticipants.replace("{count}", String(participants.length))}</span>
            <span className="badge">{copy.toolbar.editingLocks.replace("{count}", String(locks.length))}</span>
            <StatusPill status={status} />
          </>
        }
      />

      <OperationalSafetyPanel action={copy.toolbar.safetyAction} dryRun confidence={90} auditHref="/activity" />

      <div className="split-layout" aria-label={copy.toolbar.title}>
          <article className="panel auth-form">
            <div className="panel-title-row panel-section-header">
              <div>
                <h2>{copy.room.title}</h2>
                <p>{copy.room.description}</p>
              </div>
            </div>

            <div className="stack">
              <div className="field-row">
                <label>
                  <span>{copy.room.roomKey}</span>
                  <input value={roomKey} onChange={(event) => setRoomKey(event.target.value)} />
                </label>
                <label>
                  <span>{copy.room.resource}</span>
                  <input value={resourceId} onChange={(event) => setResourceId(event.target.value)} />
                </label>
              </div>
              <label>
                <span>{copy.room.status}</span>
                <select value={status} onChange={(event) => setStatus(event.target.value as CollaborationStatus)}>
                  {Object.entries(copy.statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <div className="toolbar-row toolbar-start">
                <button className="button button-primary" type="button" onClick={refreshPresence} disabled={isRefreshing || isSyncing}>
                  {isRefreshing ? copy.room.refreshing : copy.room.refreshPresence}
                </button>
                <button className="button button-secondary" type="button" onClick={acquireLock} disabled={isLocking !== null}>
                  {isLocking === "acquire" ? copy.room.acquiring : copy.room.acquireResource}
                </button>
                <button className="button button-secondary" type="button" onClick={releaseLock} disabled={isLocking !== null}>
                  {isLocking === "release" ? copy.room.releasing : copy.room.releaseLock}
                </button>
              </div>
              <div className="state-banner">
                <strong>{copy.room.lockStatus}</strong>
                <p className="helper-text">{lockMessage}</p>
              </div>
            </div>
          </article>

          <article className="panel">
            <SectionHeader
              title={copy.participants.title}
              description={copy.participants.description}
              count={participants.length}
            />

            <div className="stack">
              {error && (
                <div className="state-banner state-banner-error" role="alert">
                  <strong>{copy.participants.refreshError}</strong>
                  <p className="helper-text">{error}</p>
                </div>
              )}
              {!error && (
                <div className="state-banner state-banner-success">
                  <strong>{copy.participants.connectionActive}</strong>
                  <p className="helper-text">{message}</p>
                </div>
              )}

              {participants.length === 0 ? (
                <EmptyState
                  title={copy.participants.emptyTitle}
                  description={copy.participants.emptyDescription}
                />
              ) : (
                participants.map((participant) => (
                  <div className="state-banner" key={participant.id}>
                    <div className="helper-row">
                      <strong>{participant.displayName}</strong>
                      <StatusPill status={participant.status} />
                    </div>
                    <p className="helper-text">
                      {participant.resourceId || copy.participants.unspecifiedResource} · {participant.lastSeenAt || copy.participants.noTime}
                    </p>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="panel full-span">
            <SectionHeader
              title={copy.document.title}
              description={copy.document.description}
            />

            <div className="stack">
              <textarea
                aria-label={copy.document.contentLabel}
                value={documentContent}
                onChange={(event) => setDocumentContent(event.target.value)}
                rows={8}
                className="search-input"
                disabled={isDocumentLoading}
              />
              <div className="toolbar-row toolbar-start">
                <button
                  className="button button-primary"
                  type="button"
                  onClick={saveDocument}
                  disabled={isDocumentSaving || isDocumentLoading}
                >
                  {isDocumentSaving ? copy.document.saving : copy.document.save}
                </button>
                <span className="badge">v{documentVersion}</span>
                {documentMeta.updatedByDisplayName ? (
                  <span className="badge">{documentMeta.updatedByDisplayName}</span>
                ) : null}
              </div>
              <p className="helper-text">{documentMessage}</p>
            </div>
          </article>

          <article className="panel full-span">
            <SectionHeader
              title={copy.locks.title}
              description={copy.locks.description}
              count={locks.length}
            />

            <div className="stack">
              {locks.length === 0 ? (
                <EmptyState
                  title={copy.locks.emptyTitle}
                  description={copy.locks.emptyDescription}
                />
              ) : (
                locks.map((lock) => (
                  <div className="state-banner" key={lock.id}>
                    <div className="helper-row">
                      <strong>{lock.resourceId}</strong>
                      <span className="badge">{lock.displayName}</span>
                    </div>
                    <p className="helper-text">{copy.locks.expiresAt.replace("{expires}", lock.expiresAt || copy.locks.unspecified)}</p>
                  </div>
                ))
              )}
            </div>
          </article>
      </div>
    </AppShell>
  );
}
