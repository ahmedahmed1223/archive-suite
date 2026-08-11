"use client";

import { useEffect, useMemo, useState } from "react";
import { createArchiveApiClient, type CollaborationParticipant } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { presenceInitials, recordPresenceRoom } from "@/lib/record-presence";

export default function RecordPresence({ recordId }: Readonly<{ recordId: string }>) {
  const { t } = useLocale();
  const copy = t.pages.archiveDetail.recordPresence;
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
    <aside className="record-presence" aria-label={copy.ariaLabel} aria-live="polite">
      <strong>{participants.length ? copy.watchingNow.replace("{count}", String(participants.length)) : copy.watchingAlone}</strong>
      <div className="button-row">
        {participants.map((participant) => <span className="badge" title={participant.displayName} key={participant.id}>{presenceInitials(participant.displayName)} · {participant.displayName}</span>)}
      </div>
      {unavailable ? <small className="helper-text">{copy.unavailable}</small> : null}
    </aside>
  );
}
