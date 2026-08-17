/**
 * Shared client-side mirror of the Laravel validation rule (see
 * MediaClipCreateRequest/MediaClipUpdateRequest): a clip's out time must be
 * strictly after its in time. Used for inline form feedback before the
 * request round-trips to the server, which still re-validates and rejects.
 */
export function isValidClipRange(inSeconds: number, outSeconds: number): boolean {
  return Number.isFinite(inSeconds) && Number.isFinite(outSeconds) && inSeconds >= 0 && outSeconds > inSeconds;
}
