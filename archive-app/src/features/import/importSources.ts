export const IMPORT_KINDS = Object.freeze({
  YOUTUBE: "youtube",
  GOOGLE_DRIVE: "googledrive",
  LOCAL_FOLDER: "local_folder",
  WEB: "web",
  UNKNOWN: "unknown"
});

export type ImportKind = (typeof IMPORT_KINDS)[keyof typeof IMPORT_KINDS];

interface ImportSource {
  kind: ImportKind;
  url: string;
  id?: string;
  normalizedUrl: string;
}

interface ImportDraft {
  title: string;
  path: string;
  type: string;
  subtype: string;
  notes?: string;
  tags?: string[];
  metadata: {
    importSource: ImportKind;
    sourceUrl: string;
    sourceId?: string;
    localPath?: string;
    manifestRoot?: string;
    fileSize?: number;
    mimeType?: string;
  };
}

interface ManifestFileEntry {
  relativePath?: string;
  path?: string;
  name?: string;
  mimeType?: string;
  type?: string;
  title?: string;
  size?: number;
  notes?: string;
  tags?: unknown[];
}

const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const DRIVE_ID_PATTERN = /^[a-zA-Z0-9_-]{10,}$/;
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "mkv", "webm", "avi", "m4v"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "flac", "ogg"]);

function safeParseUrl(input: unknown): URL | null {
  const raw = String(input || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function extractYoutubeId(url: URL): string {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] || "";
    return YOUTUBE_ID_PATTERN.test(id) ? id : "";
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const watchId = url.searchParams.get("v");
    if (watchId && YOUTUBE_ID_PATTERN.test(watchId)) return watchId;
    const segments = url.pathname.split("/").filter(Boolean);
    if ((segments[0] === "shorts" || segments[0] === "embed" || segments[0] === "v") && segments[1]) {
      return YOUTUBE_ID_PATTERN.test(segments[1]) ? segments[1] : "";
    }
  }
  return "";
}

function extractDriveId(url: URL): string {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "drive.google.com" && host !== "docs.google.com") return "";
  const segments = url.pathname.split("/").filter(Boolean);
  const fileIndex = segments.findIndex((segment) => segment === "d");
  if (fileIndex >= 0 && segments[fileIndex + 1]) {
    const id = segments[fileIndex + 1];
    return DRIVE_ID_PATTERN.test(id) ? id : "";
  }
  const openId = url.searchParams.get("id");
  if (openId && DRIVE_ID_PATTERN.test(openId)) return openId;
  return "";
}

export function detectImportSource(input: unknown): ImportSource {
  const raw = String(input || "").trim();
  const url = safeParseUrl(raw);
  if (!url) {
    return { kind: IMPORT_KINDS.UNKNOWN, url: raw, normalizedUrl: "" };
  }
  const normalizedUrl = url.toString();

  const youtubeId = extractYoutubeId(url);
  if (youtubeId) {
    return { kind: IMPORT_KINDS.YOUTUBE, url: raw, id: youtubeId, normalizedUrl };
  }

  const driveId = extractDriveId(url);
  if (driveId) {
    return { kind: IMPORT_KINDS.GOOGLE_DRIVE, url: raw, id: driveId, normalizedUrl };
  }

  return { kind: IMPORT_KINDS.WEB, url: raw, normalizedUrl };
}

export function parseImportLines(text: unknown): ImportSource[] {
  const tokens = String(text || "")
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const sources: ImportSource[] = [];
  for (const token of tokens) {
    const source = detectImportSource(token);
    if (source.kind === IMPORT_KINDS.UNKNOWN) continue;
    const dedupeKey = source.normalizedUrl || source.url;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    sources.push(source);
  }
  return sources;
}

function guessWebTitle(url: string): string {
  const parsed = safeParseUrl(url);
  if (!parsed) return url;
  const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();
  if (lastSegment) {
    return decodeURIComponent(lastSegment).replace(/[-_]+/g, " ").trim() || parsed.hostname;
  }
  return parsed.hostname.replace(/^www\./, "");
}

export function buildImportDraft(source: ImportSource | null | undefined): ImportDraft | null {
  if (!source || source.kind === IMPORT_KINDS.UNKNOWN) return null;
  const sourceUrl = source.normalizedUrl || source.url;

  let title: string;
  let type: string;
  if (source.kind === IMPORT_KINDS.YOUTUBE) {
    title = `YouTube: ${source.id}`;
    type = "video";
  } else if (source.kind === IMPORT_KINDS.GOOGLE_DRIVE) {
    title = `Google Drive: ${source.id}`;
    type = "";
  } else {
    title = guessWebTitle(sourceUrl);
    type = "";
  }

  return {
    title,
    path: sourceUrl,
    type,
    subtype: "",
    metadata: {
      importSource: source.kind,
      ...(source.id ? { sourceId: source.id } : {}),
      sourceUrl
    }
  };
}

function normalizeManifestPath(value: unknown): string {
  const path = String(value || "").trim().replace(/\\/g, "/");
  if (!path || path.startsWith("/") || /^[a-zA-Z]:\//.test(path)) return "";
  const segments = path.split("/").filter(Boolean);
  if (!segments.length || segments.some((segment) => segment === "." || segment === "..")) return "";
  return segments.join("/");
}

function guessTitleFromPath(path: string): string {
  const fileName = path.split("/").filter(Boolean).pop() || path;
  const base = fileName.includes(".") ? fileName.split(".").slice(0, -1).join(".") : fileName;
  return decodeURIComponent(base).replace(/[-_]+/g, " ").trim() || fileName;
}

function inferItemType(path: string, mimeType = ""): string {
  const lowerMime = String(mimeType || "").toLowerCase();
  if (lowerMime.startsWith("video/")) return "video";
  if (lowerMime.startsWith("audio/")) return "audio";
  const extension = path.includes(".") ? path.split(".").pop()?.toLowerCase() || "" : "";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  if (AUDIO_EXTENSIONS.has(extension)) return "audio";
  return "";
}

function normalizeManifestFileEntry(entry: unknown, manifestRoot: string): ImportDraft | null {
  if (!entry || typeof entry !== "object") return null;
  const fileEntry = entry as ManifestFileEntry;
  const path = normalizeManifestPath(fileEntry.relativePath || fileEntry.path || fileEntry.name);
  if (!path) return null;
  const mimeType = String(fileEntry.mimeType || fileEntry.type || "").trim();
  const title = String(fileEntry.title || "").trim() || guessTitleFromPath(path);
  const size = Number(fileEntry.size);
  return {
    title,
    path,
    type: inferItemType(path, mimeType),
    subtype: "",
    notes: String(fileEntry.notes || "").trim(),
    tags: Array.isArray(fileEntry.tags) ? fileEntry.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
    metadata: {
      importSource: IMPORT_KINDS.LOCAL_FOLDER,
      sourceUrl: path,
      localPath: path,
      ...(manifestRoot ? { manifestRoot } : {}),
      ...(Number.isFinite(size) && size > 0 ? { fileSize: size } : {}),
      ...(mimeType ? { mimeType } : {})
    }
  };
}

export function parseLocalFolderManifest(text: unknown): ImportDraft[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(text || "").trim() || "{}");
  } catch {
    return [];
  }
  const manifestRoot = String((parsed as { rootLabel?: string; root?: string })?.rootLabel || (parsed as { root?: string })?.root || "").trim();
  const files = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { files?: unknown[] })?.files)
      ? (parsed as { files: unknown[] }).files
      : [];
  return files
    .map((entry) => normalizeManifestFileEntry(entry, manifestRoot))
    .filter((entry): entry is ImportDraft => Boolean(entry));
}
