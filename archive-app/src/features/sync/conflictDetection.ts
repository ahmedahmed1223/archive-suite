// @ts-nocheck
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

/* ------------------------------------------------------------------ *
 * §1172 — pairwise conflict detection + resolution.
 *
 * The functions above operate on a whole incoming delta package with
 * a baseSyncFloor. The functions below are a simpler, self-contained
 * pairwise model used by the visible sync queue / status panel: given
 * a single local record and a single remote record (each carrying the
 * standard sync metadata) decide whether they conflict, and how a
 * chosen strategy resolves them.
 *
 * Decision rules for detectConflict(local, remote):
 *   1. If either side is missing → not a pairwise conflict; the caller
 *      handles add/remove via classifyConflicts (localOnly/remoteOnly).
 *   2. Equal syncVersion AND equal updatedAt → in sync, no conflict.
 *   3. One side strictly ahead in syncVersion while the other is at the
 *      base it last saw (same lastModifiedBy chain, lower version) →
 *      fast-forward, NOT a conflict.
 *   4. Both sides advanced past the common version (their syncVersions
 *      differ AND they were last modified by *different* devices) →
 *      conflict ("both-modified"). Delete-vs-edit is flagged via type.
 *   5. Same syncVersion but different content/device → conflict
 *      ("version-clash"); treated as both-modified.
 * ------------------------------------------------------------------ */

export const CONFLICT_RESOLUTION_STRATEGIES = ["keepLocal", "keepRemote", "newest"];

function metaVersion(record) {
  const value = record?.syncVersion;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  return 0;
}

function metaDevice(record) {
  const id = record?.lastModifiedBy?.deviceId;
  return typeof id === "string" && id ? id : null;
}

function metaTime(record) {
  const at = record?.updatedAt || record?.lastModifiedBy?.at;
  const ms = at ? Date.parse(at) : NaN;
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Detect a conflict between a single local and remote record. Pure.
 * @returns {null | { type: string, localVersion: number, remoteVersion: number, fields: string[] }}
 */
export function detectConflict(local, remote) {
  if (!local || !remote) return null;
  const localVersion = metaVersion(local);
  const remoteVersion = metaVersion(remote);
  const localDevice = metaDevice(local);
  const remoteDevice = metaDevice(remote);

  const sameVersion = localVersion === remoteVersion;
  const sameTime = (local.updatedAt || null) === (remote.updatedAt || null);
  if (sameVersion && sameTime) return null; // in sync

  const fields = changedFields(local, remote);

  if (sameVersion) {
    // Same version number but content/device differ → branched at the
    // same point. Always a conflict that needs review.
    return { type: "version-clash", localVersion, remoteVersion, fields };
  }

  // Different versions. A clean fast-forward is when both sides agree on
  // who made the last change (same device chain) — the lower-version
  // side simply hasn't caught up yet.
  const sameDeviceChain = localDevice && remoteDevice && localDevice === remoteDevice;
  if (sameDeviceChain) return null; // fast-forward, not a conflict

  // Divergent devices AND divergent versions → both replicas moved
  // independently from a common base. Real conflict.
  const type = remote.isDeleted && !local.isDeleted
    ? "delete-vs-edit"
    : !remote.isDeleted && local.isDeleted
      ? "edit-vs-delete"
      : "both-modified";
  return { type, localVersion, remoteVersion, fields };
}

function changedFields(local, remote) {
  const skip = new Set(["syncVersion", "lastModifiedBy", "updatedAt"]);
  const keys = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);
  const changed = [];
  for (const key of keys) {
    if (skip.has(key)) continue;
    const a = local ? local[key] : undefined;
    const b = remote ? remote[key] : undefined;
    if (!shallowEqualValue(a, b)) changed.push(key);
  }
  return changed.sort();
}

function shallowEqualValue(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Classify two id-keyed record lists into conflicts / localOnly /
 * remoteOnly / inSync buckets. Pure.
 */
export function classifyConflicts(localItems = [], remoteItems = []) {
  const localById = indexById(localItems);
  const remoteById = indexById(remoteItems);

  const conflicts = [];
  const inSync = [];
  const localOnly = [];
  const remoteOnly = [];

  for (const [id, local] of localById) {
    const remote = remoteById.get(id);
    if (!remote) {
      localOnly.push(local);
      continue;
    }
    const conflict = detectConflict(local, remote);
    if (conflict) conflicts.push({ id, local, remote, ...conflict });
    else inSync.push({ id, local, remote });
  }

  for (const [id, remote] of remoteById) {
    if (!localById.has(id)) remoteOnly.push(remote);
  }

  return { conflicts, localOnly, remoteOnly, inSync };
}

function indexById(items) {
  const map = new Map();
  if (!Array.isArray(items)) return map;
  for (const item of items) {
    if (item?.id != null) map.set(item.id, item);
  }
  return map;
}

/**
 * Resolve a single conflict using a strategy. Pure + immutable:
 * returns the chosen record, never mutates the inputs.
 * @param {{ local: object, remote: object }} conflict
 * @param {"keepLocal"|"keepRemote"|"newest"} strategy
 */
export function resolveConflict(conflict, strategy) {
  if (!conflict || typeof conflict !== "object") {
    throw new Error("resolveConflict: التعارض غير صالح");
  }
  const { local, remote } = conflict;
  if (!CONFLICT_RESOLUTION_STRATEGIES.includes(strategy)) {
    throw new Error(`resolveConflict: استراتيجية غير مدعومة "${strategy}"`);
  }
  if (strategy === "keepLocal") return local ? { ...local } : null;
  if (strategy === "keepRemote") return remote ? { ...remote } : null;
  // newest: higher updatedAt wins; fall back to higher syncVersion; then local.
  const localTime = metaTime(local);
  const remoteTime = metaTime(remote);
  if (localTime != null && remoteTime != null && localTime !== remoteTime) {
    return localTime > remoteTime ? { ...local } : { ...remote };
  }
  const localVersion = metaVersion(local);
  const remoteVersion = metaVersion(remote);
  if (localVersion !== remoteVersion) {
    return localVersion > remoteVersion ? { ...local } : { ...remote };
  }
  return local ? { ...local } : remote ? { ...remote } : null;
}

