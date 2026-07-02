"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import {
  createArchiveApiClient,
  type CollaborationDocument,
  type CollaborationLock,
  type CollaborationParticipant,
  type CollaborationStatus
} from "@/lib/archive-api";
import { getEchoClient } from "@/lib/echo";

const statusLabels: Record<CollaborationStatus, string> = {
  active: "نشط",
  viewing: "يشاهد",
  reviewing: "يراجع",
  editing: "يحرر",
  idle: "خامل"
};

function StatusPill({ status }: { status: CollaborationStatus }) {
  return (
    <span
      className="badge status-pill"
      data-status={status}
    >
      {statusLabels[status] ?? status}
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
  const api = useMemo(() => createArchiveApiClient(), []);
  const [roomKey, setRoomKey] = useState("review-1");
  const [resourceId, setResourceId] = useState("media-123");
  const [status, setStatus] = useState<CollaborationStatus>("reviewing");
  const [participants, setParticipants] = useState<CollaborationParticipant[]>([]);
  const [locks, setLocks] = useState<CollaborationLock[]>([]);
  const [activeWindowSeconds, setActiveWindowSeconds] = useState(45);
  const [message, setMessage] = useState("جاهز");
  const [error, setError] = useState<string | null>(null);
  const [lockMessage, setLockMessage] = useState("لا توجد أقفال محملة بعد");
  const [documentContent, setDocumentContent] = useState("");
  const [documentVersion, setDocumentVersion] = useState(0);
  const [documentMeta, setDocumentMeta] = useState<Pick<CollaborationDocument, "updatedByDisplayName" | "updatedAt">>({});
  const [documentMessage, setDocumentMessage] = useState("لم يتم تحميل مسودة بعد");
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
          setMessage(`آخر مزامنة: ${new Date().toLocaleTimeString("ar-EG")}`);
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
          setError(err instanceof Error ? err.message : "تعذر تحديث التعاون الحي.");
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
  }, [api, resourceId, roomKey, status]);

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
          setDocumentMessage(response.document.version > 0 ? "تم تحميل آخر نسخة" : "مسودة جديدة");
        } else {
          setDocumentMessage(response.error);
        }
      } catch (err) {
        if (active) {
          setDocumentMessage(err instanceof Error ? err.message : "تعذر تحميل المسودة.");
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
  }, [api, resourceId, roomKey]);

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
      setDocumentMessage(`تحديث حي من ${event.document.updatedByDisplayName ?? "مشارك آخر"}`);
    });

    return () => {
      echo.leave(`collaboration.room.${currentRoomKey}`);
    };
  }, [resourceId, roomKey]);

  const refreshPresence = async () => {
    const currentRoomKey = roomKey.trim();
    if (!currentRoomKey) return;

    setIsRefreshing(true);
    try {
      const response = await api.collaborationPresence(currentRoomKey);
      if (response.ok) {
        setParticipants(response.participants);
        setActiveWindowSeconds(response.activeWindowSeconds);
        setMessage(`تحديث يدوي: ${new Date().toLocaleTimeString("ar-EG")}`);
        setError(null);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحديث الحضور.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const acquireLock = async () => {
    if (!resourceId.trim()) {
      setLockMessage("اختر مورداً قبل طلب القفل.");
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
        setLockMessage(`تم حجز ${response.lock.resourceId} حتى ${response.lock.expiresAt ?? "وقت غير محدد"}`);
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
      setLockMessage(err instanceof Error ? err.message : "تعذر حجز المورد.");
    } finally {
      setIsLocking(null);
    }
  };

  const releaseLock = async () => {
    if (!resourceId.trim()) {
      setLockMessage("اختر مورداً قبل تحرير القفل.");
      return;
    }

    setIsLocking("release");
    try {
      const response = await api.releaseCollaborationLock(roomKey.trim(), {
        resourceId: resourceId.trim()
      });

      if (response.ok) {
        setLocks(response.locks);
        setLockMessage(response.released ? "تم تحرير القفل." : "لا يوجد قفل لك على هذا المورد.");
      } else {
        setLockMessage(response.error);
      }
    } catch (err) {
      setLockMessage(err instanceof Error ? err.message : "تعذر تحرير القفل.");
    } finally {
      setIsLocking(null);
    }
  };

  const saveDocument = async () => {
    const currentRoomKey = roomKey.trim();
    const currentResourceId = resourceId.trim();
    if (!currentRoomKey || !currentResourceId) {
      setDocumentMessage("اختر غرفة ومورداً قبل حفظ المسودة.");
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
        setDocumentMessage(`تم حفظ النسخة ${response.document.version}`);
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
      setDocumentMessage(err instanceof Error ? err.message : "تعذر حفظ المسودة.");
    } finally {
      setIsDocumentSaving(false);
    }
  };

  return (
    <main className="shell">
      <AppHeader subtitle="التعاون الحي" />

      <section className="content" aria-label="التعاون الحي">
        <div className="hero">
          <span className="badge">{isSyncing ? "جارِ المزامنة" : "مزامنة نشطة"}</span>
          <h1>التعاون الحي.</h1>
          <p>
            غرفة واحدة لإظهار الحضور النشط وحجز موارد التحرير عبر Laravel API،
            بواجهة أخف للمتابعة السريعة.
          </p>
          <div className="hero-actions">
            <span className="badge">نافذة النشاط {activeWindowSeconds} ثانية</span>
            <span className="badge">أقفال التحرير</span>
          </div>
        </div>

        <div className="split-layout">
          <article className="panel auth-form">
            <div className="panel-title-row">
              <div>
                <h2>إعداد الغرفة</h2>
                <p>اضبط الغرفة والمورد والحالة، ثم اترك الصفحة ترسل heartbeat تلقائياً.</p>
              </div>
            </div>

            <div className="stack">
              <div className="field-row">
                <label>
                  <span>مفتاح الغرفة</span>
                  <input value={roomKey} onChange={(event) => setRoomKey(event.target.value)} />
                </label>
                <label>
                  <span>المورد</span>
                  <input value={resourceId} onChange={(event) => setResourceId(event.target.value)} />
                </label>
              </div>
              <label>
                <span>الحالة</span>
                <select value={status} onChange={(event) => setStatus(event.target.value as CollaborationStatus)}>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <div className="toolbar-row toolbar-start">
                <button className="button button-primary" type="button" onClick={refreshPresence} disabled={isRefreshing || isSyncing}>
                  {isRefreshing ? "جاري التحديث" : "تحديث الحضور"}
                </button>
                <button className="button button-secondary" type="button" onClick={acquireLock} disabled={isLocking !== null}>
                  {isLocking === "acquire" ? "جاري الحجز" : "حجز المورد"}
                </button>
                <button className="button button-secondary" type="button" onClick={releaseLock} disabled={isLocking !== null}>
                  {isLocking === "release" ? "جاري التحرير" : "تحرير القفل"}
                </button>
              </div>
              <div className="state-banner">
                <strong>حالة القفل</strong>
                <p className="helper-text">{lockMessage}</p>
              </div>
            </div>
          </article>

          <article className="panel">
            <SectionHeader
              title="المشاركون الآن"
              description="آخر حضور نشط داخل الغرفة الحالية."
              count={participants.length}
            />

            <div className="stack">
              {error ? (
                <div className="state-banner state-banner-error" role="alert">
                  <strong>تعذر تحديث الحضور</strong>
                  <p className="helper-text">{error}</p>
                </div>
              ) : (
                <div className="state-banner state-banner-success">
                  <strong>الاتصال نشط</strong>
                  <p className="helper-text">{message}</p>
                </div>
              )}

              {participants.length === 0 ? (
                <div className="empty-state">لا يوجد مشاركون نشطون حالياً.</div>
              ) : (
                participants.map((participant) => (
                  <div className="state-banner" key={participant.id}>
                    <div className="helper-row">
                      <strong>{participant.displayName}</strong>
                      <StatusPill status={participant.status} />
                    </div>
                    <p className="helper-text">
                      {participant.resourceId || "لا يوجد مورد محدد"} · {participant.lastSeenAt || "بدون وقت"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="panel full-span">
            <SectionHeader
              title="مسودة المورد"
              description="نص مشترك بإصدار متفائل مرتبط بالمورد الحالي."
            />

            <div className="stack">
              <textarea
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
                  {isDocumentSaving ? "جاري الحفظ" : "حفظ المسودة"}
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
              title="أقفال التحرير"
              description="تمنع الأقفال تعارض الكتابة على المورد نفسه حتى انتهاء المدة أو التحرير اليدوي."
              count={locks.length}
            />

            <div className="stack">
              {locks.length === 0 ? (
                <div className="empty-state">لا توجد أقفال نشطة في هذه الغرفة.</div>
              ) : (
                locks.map((lock) => (
                  <div className="state-banner" key={lock.id}>
                    <div className="helper-row">
                      <strong>{lock.resourceId}</strong>
                      <span className="badge">{lock.displayName}</span>
                    </div>
                    <p className="helper-text">ينتهي: {lock.expiresAt || "غير محدد"}</p>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
