import { deriveRecordSourcePath, type ArchiveRecord } from "./archive-api";

export function buildSearchPlaybackHref(record: ArchiveRecord, timestampSeconds: number): string | null {
  const source = deriveRecordSourcePath(record);

  if (!source || !Number.isFinite(timestampSeconds) || timestampSeconds < 0) return null;

  const params = new URLSearchParams({
    path: source.sourcePath,
    recordId: record.id,
    at: String(timestampSeconds)
  });

  if (source.disk) params.set("disk", source.disk);

  return `/media/play?${params.toString()}`;
}
