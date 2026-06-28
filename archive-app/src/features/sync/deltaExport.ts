// @ts-nocheck
/**
 * Delta-export filtering. Given a peer's record of "last sync floor"
 * (a Map of entityId → last-seen syncVersion at the moment we last
 * sent them a package), return the subset of video items whose
 * current syncVersion is newer.
 *
 * This is intentionally per-entity rather than a single global
 * Lamport timestamp — that way edits to two separate items can be
 * exported independently and the receiving device doesn't have to
 * accept-or-reject in lockstep.
 */

/**
 * Filter items down to "anything changed since the last sync with
 * this peer". `peerFloor` is `{ [itemId]: lastSeenSyncVersion }` —
 * pass an empty object for the first sync with a peer (everything
 * is new).
 */
export function filterDeltaVideoItems(items = [], peerFloor = {}) {
  if (!Array.isArray(items)) return [];
  const floor = peerFloor && typeof peerFloor === "object" ? peerFloor : {};
  return items.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const seen = Number(floor[item.id]) || 0;
    const current = Number(item.syncVersion) || 0;
    // An item the peer has never seen counts as "new". An item with
    // a higher syncVersion than what they last saw is a real change.
    return current > seen;
  });
}

/**
 * Build the floor entry a sender writes back into settings after
 * a successful delta send. Records the highest syncVersion the
 * sender confirmed in this package per entity, so the next delta
 * starts from there.
 */
export function buildSyncFloorFromItems(items = []) {
  if (!Array.isArray(items)) return {};
  const floor = {};
  for (const item of items) {
    if (!item?.id) continue;
    floor[item.id] = Number(item.syncVersion) || 0;
  }
  return floor;
}

/**
 * Merge two sync-floor objects, keeping the highest known version
 * per id. Used when reconciling a freshly-exported delta with what
 * we already knew about the peer.
 */
export function mergeSyncFloors(base = {}, overlay = {}) {
  const result = { ...(base || {}) };
  for (const [id, version] of Object.entries(overlay || {})) {
    const incoming = Number(version) || 0;
    const existing = Number(result[id]) || 0;
    if (incoming > existing) result[id] = incoming;
  }
  return result;
}

/**
 * Summary statistics for a planned delta export so the UI can show
 * the user what they're about to send.
 */
export function summarizeDeltaPlan(items = [], peerFloor = {}) {
  const delta = filterDeltaVideoItems(items, peerFloor);
  const newCount = delta.filter((item) => !(item.id in (peerFloor || {}))).length;
  const updatedCount = delta.length - newCount;
  return {
    total: delta.length,
    newCount,
    updatedCount,
    items: delta
  };
}

