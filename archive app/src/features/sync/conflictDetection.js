/**
 * Conflict detection for incoming delta packages.
 *
 * A "conflict" here means: BOTH the local copy and the incoming copy
 * of the same entity have advanced past the version the sender last
 * saw. In Lamport/vector-clock terms, neither replica's syncVersion
 * dominates the other — they branched.
 *
 * Inputs (pure, easy to test):
 *   - localItems: current state on this device, each carries
 *     { id, syncVersion, lastModifiedBy: { deviceId, at }, ... }
 *   - incomingItems: payload.videoItems from the package
 *   - baseSyncFloor: the package's baseSyncFloor map, i.e. what the
 *     sender remembered about us when they exported. If empty (or
 *     this is a "full" package), we use the local syncVersion as
 *     the comparison base.
 *
 * Output: { newItems, updates, conflicts, deletes }
 *   - newItems: incoming records we've never seen → safe to apply
 *   - updates: clean fast-forwards (local is at or below the
 *     incoming base; incoming wins) → safe to apply
 *   - conflicts: both sides diverged → need user resolution
 *   - deletes: incoming.isDeleted vs local edited → flagged as
 *     a special conflict kind so the UI can ask "حذف يفوز أم
 *     تعديل؟"
 */

import { stableStringifyForChecksum } from "../../services/data-portability/packageFormat.js";

/** Returns true when two entity snapshots have the same content (ignoring sync metadata). */
function entitiesAreEqual(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const strip = (item) => {
    const copy = { ...item };
    delete copy.syncVersion;
    delete copy.lastModifiedBy;
    delete copy.updatedAt;
    return copy;
  };
  try {
    return stableStringifyForChecksum(strip(a)) === stableStringifyForChecksum(strip(b));
  } catch {
    return false;
  }
}

function readVersion(entity) {
  const value = entity?.syncVersion;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  return 0;
}

/**
 * Classify each incoming item against the local store. Pure function.
 */
export function detectConflicts({ localItems = [], incomingItems = [], baseSyncFloor = {} } = {}) {
  const localById = new Map();
  for (const item of localItems) {
    if (item?.id) localById.set(item.id, item);
  }
  const floor = baseSyncFloor && typeof baseSyncFloor === "object" ? baseSyncFloor : {};

  const newItems = [];
  const updates = [];
  const conflicts = [];
  const deletes = [];

  for (const incoming of incomingItems) {
    if (!incoming?.id) continue;
    const local = localById.get(incoming.id) || null;
    const incomingVersion = readVersion(incoming);

    if (!local) {
      // We've never seen this entity. Treat as a new arrival even if
      // it carries isDeleted (a "tombstone") — the slice will store
      // the tombstone so a future re-create from another device
      // doesn't resurrect deleted content unexpectedly.
      newItems.push({ id: incoming.id, incoming });
      continue;
    }

    const localVersion = readVersion(local);
    // The sender claims it last saw our copy at this version. If
    // baseSyncFloor is missing for this entity we fall back to
    // assuming the sender saw our current state (conservative — it
    // turns ambiguous cases into clean updates rather than false
    // conflicts).
    const senderSawLocalAt = floor[incoming.id];
    const senderBaseline = typeof senderSawLocalAt === "number" ? senderSawLocalAt : localVersion;

    if (entitiesAreEqual(local, incoming)) {
      // Same content, no action needed even if version numbers
      // disagree (can happen after manual conflict resolution).
      continue;
    }

    const localHasMoved = localVersion > senderBaseline;
    const incomingHasMoved = incomingVersion > senderBaseline;

    if (localHasMoved && incomingHasMoved) {
      // Both replicas diverged from the common point → real conflict.
      const kind = incoming.isDeleted && !local.isDeleted
        ? "delete-vs-edit"
        : !incoming.isDeleted && local.isDeleted
          ? "edit-vs-delete"
          : "edit-vs-edit";
      const entry = { id: incoming.id, kind, local, incoming, baseVersion: senderBaseline };
      if (kind === "delete-vs-edit" || kind === "edit-vs-delete") deletes.push(entry);
      else conflicts.push(entry);
      continue;
    }

    if (incomingHasMoved && !localHasMoved) {
      // Clean fast-forward: sender's change supersedes our copy.
      updates.push({ id: incoming.id, incoming, previous: local });
      continue;
    }

    // localHasMoved && !incomingHasMoved → we have a newer copy than
    // the sender knows about. Drop the incoming payload silently;
    // our next delta to them will catch them up.
  }

  return { newItems, updates, conflicts, deletes };
}

/**
 * Roll up the classification into a single summary object for the
 * conflict resolution dialog header.
 */
export function summarizeConflictPlan(plan) {
  return {
    newCount: plan.newItems.length,
    updateCount: plan.updates.length,
    conflictCount: plan.conflicts.length,
    deleteCount: plan.deletes.length,
    totalChanges: plan.newItems.length + plan.updates.length + plan.conflicts.length + plan.deletes.length,
    needsReview: plan.conflicts.length + plan.deletes.length > 0
  };
}
