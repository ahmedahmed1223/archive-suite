"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createArchiveApiClient,
  type CollaborationLock,
  type CollaborationParticipant,
  type CollaborationStatus
} from "@/lib/archive-api";

const statusLabels: Record<CollaborationStatus, string> = {
  active: "نشط",
  viewing: "يشاهد",
  reviewing: "يراجع",
  editing: "يحرر",
  idle: "خامل"
};

export default function CollaborationPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [roomKey, setRoomKey] = useState("review-1");
  const [resourceId, setResourceId] = useState("media-123");
  const [status, setStatus] = useState<CollaborationStatus>("reviewing");
  const [participants, setParticipants] = useState<CollaborationParticipant[]>([]);
  const [locks, setLocks] = useState<CollaborationLock[]>([]);
  const [activeWindowSeconds, setActiveWindowSeconds] = useState(45);
  const [message, setMessage] = useState<string>("جاهز");
  const [error, setError] = useState<string | null>(null);
  const [lockMessage, setLockMessage] = useState<string>("لا توجد أقفال محملة بعد");

  useEffect(() => {
    let active = true;
    let interval: ReturnType<typeof setInterval> | undefined;

    const beat = async () => {
      if (!roomKey.trim()) return;
      const response = await api.sendCollaborationHeartbeat(roomKey.trim(), {
        status,
        resourceId: resourceId.trim() || undefined,
        cursor: { surface: "next-collaboration" }
      });

      if (!active) return;

      if (response.ok) {
        setParticipants(response.participants);
        setActiveWindowSeconds(response.activeWindowSeconds);
        setMessage(`آخر نبضة: ${new Date().toLocaleTimeString()}`);
        setError(null);
      } else {
        setError(response.error);
      }

      const locksResponse = await api.collaborationLocks(roomKey.trim());
      if (!active) return;
      if (locksResponse.ok) {
        setLocks(locksResponse.locks);
      }
    };

    beat();
    interval = setInterval(beat, 15000);

    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [api, resourceId, roomKey, status]);

  const refreshPresence = async () => {
    const response = await api.collaborationPresence(roomKey.trim());
    if (response.ok) {
      setParticipants(response.participants);
      setActiveWindowSeconds(response.activeWindowSeconds);
      setMessage(`تحديث يدوي: ${new Date().toLocaleTimeString()}`);
      setError(null);
    } else {
      setError(response.error);
    }
  };

  const acquireLock = async () => {
    if (!resourceId.trim()) {
      setLockMessage("اختر مورداً قبل طلب القفل.");
      return;
    }

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
  };

  const releaseLock = async () => {
    if (!resourceId.trim()) {
      setLockMessage("اختر مورداً قبل تحرير القفل.");
      return;
    }

    const response = await api.releaseCollaborationLock(roomKey.trim(), {
      resourceId: resourceId.trim()
    });

    if (response.ok) {
      setLocks(response.locks);
      setLockMessage(response.released ? "تم تحرير القفل." : "لا يوجد قفل لك على هذا المورد.");
    } else {
      setLockMessage(response.error);
    }
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>Archive Suite</strong>
          <span>Live collaboration</span>
        </div>
        <nav className="route-links" aria-label="مسارات سريعة">
          <a className="badge" href="/media/review">مراجعة مرئية</a>
          <a className="badge" href="/">الرئيسية</a>
        </nav>
      </header>

      <section className="content" aria-label="التعاون الحي">
        <div className="hero">
          <span className="badge">Presence heartbeat</span>
          <h1>غرفة تعاون حي للنظام القانوني.</h1>
          <p>
            تعرض هذه الصفحة المشاركين النشطين في غرفة واحدة عبر Laravel API،
            وتبقي الحضور محدثاً بنبضة دورية قصيرة.
          </p>
          <div className="hero-actions">
            <span className="badge">Next.js</span>
            <span className="badge">Laravel auth</span>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "minmax(280px, 0.8fr) minmax(320px, 1.2fr)" }}>
          <article className="panel auth-form">
            <div className="panel-title-row">
              <div>
                <h2>إعداد الغرفة</h2>
                <p>اضبط الغرفة والمورد الحاليين، ثم اترك الصفحة ترسل heartbeat تلقائياً.</p>
              </div>
            </div>

            <div className="stack">
              <label>
                <span>Room key</span>
                <input value={roomKey} onChange={(event) => setRoomKey(event.target.value)} />
              </label>
              <label>
                <span>Resource</span>
                <input value={resourceId} onChange={(event) => setResourceId(event.target.value)} />
              </label>
              <label>
                <span>Status</span>
                <select value={status} onChange={(event) => setStatus(event.target.value as CollaborationStatus)}>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={refreshPresence}>تحديث الحضور</button>
              <div className="helper-row">
                <button type="button" onClick={acquireLock}>حجز المورد</button>
                <button type="button" onClick={releaseLock}>تحرير القفل</button>
              </div>
              <p className="form-status">{lockMessage}</p>
            </div>
          </article>

          <article className="panel">
            <div className="panel-title-row">
              <div>
                <h2>المشاركون الآن</h2>
                <p>نافذة النشاط الحالية {activeWindowSeconds} ثانية.</p>
              </div>
              <span className="badge">{participants.length}</span>
            </div>

            {error ? (
              <p className="form-status" role="alert">{error}</p>
            ) : (
              <p className="form-status">{message}</p>
            )}

            <div className="stack">
              {participants.length === 0 ? (
                <p className="helper-text">لا يوجد مشاركون نشطون في هذه الغرفة.</p>
              ) : (
                participants.map((participant) => (
                  <div className="state-banner" key={participant.id}>
                    <div className="helper-row">
                      <strong>{participant.displayName}</strong>
                      <span className="badge">{statusLabels[participant.status] ?? participant.status}</span>
                    </div>
                    <p className="helper-text">
                      {participant.resourceId || "لا يوجد مورد محدد"} · {participant.lastSeenAt || "بدون وقت"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="panel" style={{ gridColumn: "1 / -1" }}>
            <div className="panel-title-row">
              <div>
                <h2>أقفال التحرير</h2>
                <p>تمنع هذه الطبقة الكتابة المتزامنة على المورد نفسه إلى أن تنتهي مدة القفل أو يحرره مالكه.</p>
              </div>
              <span className="badge">{locks.length}</span>
            </div>

            <div className="stack">
              {locks.length === 0 ? (
                <p className="helper-text">لا توجد أقفال نشطة في هذه الغرفة.</p>
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
