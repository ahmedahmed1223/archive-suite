// @ts-nocheck
/**
 * Sync metadata helpers shared by every store mutation.
 *
 * Each entity that participates in multi-device sync (currently
 * video items) carries:
 *   - syncVersion: integer that increments on every mutation.
 *     Combined with deviceId it forms the per-device Lamport-style
 *     clock used for delta detection and conflict resolution.
 *   - lastModifiedBy: { deviceId, at } — who made the latest change
 *     and when. `at` is ISO-8601 (same source of truth as updatedAt).
 *
 * Keeping this stamping in one place makes it easy to add a new
 * synced entity later (collections, content types, vocabulary) by
 * calling stampSyncMetadata in its slice.
 */

export const SYNC_METADATA_FIELDS = ["syncVersion", "lastModifiedBy"];

function readSyncVersion(entity) {
  const raw = entity?.syncVersion;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return raw;
  // Fall back to the legacy `version` field if present so existing
  // records migrate cleanly on first mutation after upgrade.
  const legacy = entity?.version;
  if (typeof legacy === "number" && Number.isFinite(legacy) && legacy >= 0) return legacy;
  return 0;
}

/**
 * Returns a new entity with sync metadata bumped. Pure — does not
 * mutate the input. Pass `previous` when updating an existing
 * record so we can increment from its current syncVersion; omit it
 * for create paths (starts at 1).
 */
export function stampSyncMetadata(entity, { deviceId, previous = null, at = null } = {}) {
  if (!entity || typeof entity !== "object") return entity;
  const nextVersion = readSyncVersion(previous) + 1;
  const timestamp = at || new Date().toISOString();
  return {
    ...entity,
    syncVersion: nextVersion,
    lastModifiedBy: {
      deviceId: deviceId || entity.lastModifiedBy?.deviceId || null,
      at: timestamp
    }
  };
}

/**
 * Equivalent of stampSyncMetadata for batch updates. Returns the
 * given array of entities each stamped with a fresh syncVersion
 * based on its own previous state.
 */
export function stampSyncMetadataAll(entities, deviceId) {
  if (!Array.isArray(entities)) return entities;
  return entities.map((entity) => stampSyncMetadata(entity, { deviceId, previous: entity }));
}

