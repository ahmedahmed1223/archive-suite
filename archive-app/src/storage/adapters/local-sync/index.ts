import { stampSyncMetadata } from "../../../features/sync/syncMetadata.js";
import { planIncomingDelta, mergeIntoLocal } from "../../../features/sync/planIncomingDelta.js";
import { detectConflicts, summarizeConflictPlan } from "../../../features/sync/conflictDetection.js";
import { buildFieldDiff } from "../../../features/sync/fieldDiff.js";
import { filterDeltaVideoItems, buildSyncFloorFromItems } from "../../../features/sync/deltaExport.js";

/**
 * The offline SPA sync adapter: the existing pure delta/conflict engine exposed
 * through the SyncProvider port shape. The deterministic merge logic is shared
 * with the cloud target unchanged; only the transport methods differ.
 *
 * Transport is intentionally inert offline — the SPA has no live backend, so
 * subscribe/pushChange/pullSince are honest no-ops. The cloud adapter (later)
 * overrides only these three over PocketBase realtime + a pull-since query.
 */
export const localSyncProvider = {
  stampMetadata: stampSyncMetadata,
  planIncoming: planIncomingDelta,
  mergeIntoLocal,
  detectConflicts,
  buildFieldDiff,
  summarizeConflictPlan,
  filterDelta: filterDeltaVideoItems,
  buildSyncFloor: buildSyncFloorFromItems,
  // Offline transport: no live backend.
  subscribe() {
    return () => {};
  },
  async pushChange() {
    return { pushed: false, reason: "offline" };
  },
  async pullSince() {
    return { items: [], cursor: null };
  }
};
