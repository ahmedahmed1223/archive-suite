import { deriveRecordSourcePath, type ArchiveRecord } from "./archive-api";

// V15-SEARCH-001: a deterministic search-session key.
// The same inputs always produce the same key, so a saved search can be
// restored without ambiguity (the legacy code keyed off the live URL only,
// which could drift between mode/page permutations). Ordered, normalised,
// and free of transient fields (page, cursor) so two equivalent queries
// collapse to one session.
export type SearchSessionInput = {
  q?: string;
  store?: string;
  type?: string;
  tag?: string;
  mode?: "keyword" | "semantic" | "transcript";
  dateFrom?: string;
  dateTo?: string;
  descriptionState?: "" | "complete" | "incomplete";
};

export function resolveSearchSession(input: SearchSessionInput): string {
  const parts: Array<[string, string]> = [
    // "keyword" is the app default, so it carries no session-differentiating info.
    ["q", (input.q ?? "").trim().toLowerCase()],
    ["store", (input.store ?? "").trim().toLowerCase()],
    ["type", (input.type ?? "all").trim().toLowerCase()],
    ["tag", (input.tag ?? "").trim().toLowerCase()],
    ["from", (input.dateFrom ?? "").trim()],
    ["to", (input.dateTo ?? "").trim()],
    ["desc", (input.descriptionState ?? "").trim().toLowerCase()],
    ["mode", (input.mode ?? "keyword").toLowerCase()],
  ];
  const filtered = parts.filter(([, value]) => value !== "" && value !== "all");
  const modeEntry = filtered.find(([key]) => key === "mode");
  const others = filtered.filter(([key]) => key !== "mode");
  // mode only matters when it differs from the default; append last if present.
  const ordered = modeEntry && modeEntry[1] !== "keyword" ? [...others, modeEntry] : others;
  return ordered.map(([key, value]) => `${key}=${value}`).join("&");
}

export function buildSearchPlaybackHref(record: ArchiveRecord, timestampSeconds: number): string | null {
  const source = deriveRecordSourcePath(record);

  if (!source || !Number.isFinite(timestampSeconds) || timestampSeconds < 0) return null;

  const params = new URLSearchParams({
    path: source.sourcePath,
    recordId: record.id,
    at: String(timestampSeconds),
  });

  if (source.disk) params.set("disk", source.disk);

  return `/media/play?${params.toString()}`;
}
