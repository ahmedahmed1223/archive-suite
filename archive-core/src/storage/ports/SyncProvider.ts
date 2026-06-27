/**
 * SyncProvider port — abstracts the device-to-backend sync engine.
 */
export const SYNC_PROVIDER_METHODS = [
  "stampMetadata",
  "planIncoming",
  "mergeIntoLocal",
  "detectConflicts",
  "buildFieldDiff",
  "summarizeConflictPlan",
  "filterDelta",
  "buildSyncFloor",
  "subscribe",
  "pushChange",
  "pullSince"
] as const;

export type SyncProviderMethod = typeof SYNC_PROVIDER_METHODS[number];
export type SyncProviderPort = Record<SyncProviderMethod, (...args: unknown[]) => unknown>;

export function isSyncProvider(candidate: unknown): candidate is SyncProviderPort {
  if (!candidate || typeof candidate !== "object") return false;
  const record = candidate as Record<string, unknown>;
  return SYNC_PROVIDER_METHODS.every((method) => typeof record[method] === "function");
}
