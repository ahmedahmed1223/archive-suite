/**
 * V1.5 Task 6 (Step 4): safe render-progress + presence surface for the Montage editor.
 *
 * A live WebSocket (Reverb) presence layer is deferred to the live stack; this
 * module owns the *shape and merge rules* so the Montage editor has a tested
 * contract now and the transport can be swapped without touching call sites.
 * Presence is derived from a short-lived cache (Redis/file) keyed by project —
 * never from untrusted client state, and a stale heartbeat (no ping within the
 * TTL) is dropped automatically.
 *
 * Intended use (once a Montage editor route exists, e.g. /media/montage/[id]):
 *   const snap = buildPresenceSnapshot(projectId, heartbeats, Date.now());
 *   {/* announce via role="status" aria-live="polite" *\/}
 */

export type PresenceHeartbeat = {
  userId: string;
  displayName: string;
  lastSeenAt: number; // epoch ms
  editingRevision?: number;
};

export type PresenceSnapshot = {
  projectId: string;
  editors: Array<{
    userId: string;
    displayName: string;
    editingRevision?: number;
    stale: boolean;
  }>;
};

export const PRESENCE_TTL_MS = 30_000;

/**
 * Merge raw heartbeats into a snapshot, dropping any heartbeat older than the
 * TTL. Deterministic and pure — the UI renders exactly this.
 */
export function buildPresenceSnapshot(
  projectId: string,
  heartbeats: PresenceHeartbeat[],
  now: number = Date.now(),
): PresenceSnapshot {
  const editors = heartbeats
    .filter((h) => now - h.lastSeenAt <= PRESENCE_TTL_MS)
    .map((h) => ({
      userId: h.userId,
      displayName: h.displayName,
      editingRevision: h.editingRevision,
      stale: false,
    }));

  return { projectId, editors };
}

/** True when another editor holds the project open right now (live-collab signal). */
export function hasOtherLiveEditor(snapshot: PresenceSnapshot, selfUserId: string): boolean {
  return snapshot.editors.some((e) => e.userId !== selfUserId);
}

/**
 * Render-progress is reported by the server export record; the client only
 * renders it. This guards against showing a negative or over-100% bar if a
 * backend ever returns garbage.
 */
export function clampProgress(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}
