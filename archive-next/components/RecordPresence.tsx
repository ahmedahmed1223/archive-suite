"use client";

import { useEffect, useMemo, useState } from "react";
import { createArchiveApiClient, type CollaborationParticipant } from "@/lib/archive-api";
import { presenceInitials, recordPresenceRoom } from "@/lib/record-presence";

export default function RecordPresence({ recordId }: Readonly<{ recordId: string }>) {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [participants, setParticipants] = useState<CollaborationParticipant[]>([]);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const roomKey = recordPresenceRoom(recordId);
    let active = true;
    const heartbeat = async () => {
      const response = await api.sendCollaborationHeartbeat(roomKey, { status: "viewing", resourceId: recordId });
      if (!active) return;
      if (response.ok) {
        setParticipants(response.participants);
        setUnavailable(false);
      } else {
        setUnavailable(true);
      }
    };
    void heartbeat();
    const interval = window.setInterval(() => void heartbeat(), 30_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [api, recordId]);

  return (
    <aside className="record-presence" aria-label="الموجودون في السجل الآن" aria-live="polite">
      <strong>{participants.length ? `${participants.length} يشاهدون الآن` : "أنت تشاهد هذا السجل"}</strong>
      <div className="button-row">
        {participants.map((participant) => <span className="badge" title={participant.displayName} key={participant.id}>{presenceInitials(participant.displayName)} · {participant.displayName}</span>)}
      </div>
      {unavailable ? <small className="helper-text">تعذر تحديث الحضور مؤقتًا.</small> : null}
    </aside>
  );
}
