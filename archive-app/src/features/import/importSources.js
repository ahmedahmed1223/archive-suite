// Pure, network-free source detection for the import-from-URL slice (§1655).
//
// This module classifies pasted links into known kinds (YouTube, Google Drive,
// generic web) and turns each into a draft suitable for `createVideoItemValue`.
// It performs NO network requests and touches NO DOM — all logic is pure so it
// can be unit-tested in isolation and reused from any UI surface.
//
// Deferred (NOT handled here): Google Drive OAuth for private files and actual
// media download.

export const IMPORT_KINDS = Object.freeze({
  YOUTUBE: "youtube",
  GOOGLE_DRIVE: "googledrive",
  LOCAL_FOLDER: "local_folder",
  WEB: "web",
  UNKNOWN: "unknown"
});

const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const DRIVE_ID_PATTERN = /^[a-zA-Z0-9_-]{10,}$/;
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "mkv", "webm", "avi", "m4v"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "flac", "ogg"]);

function safeParseUrl(input) {
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

function extractYoutubeId(url) {
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

function extractDriveId(url) {
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

/**
 * Classify a single input string into an import source descriptor.
 * @param {string} input
 * @returns {{ kind: string, url: string, id?: string, normalizedUrl: string }}
 */
export function detectImportSource(input) {
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

/**
 * Parse multi-line / comma / whitespace separated text into detected sources.
 * Blanks and invalid (unknown) entries are skipped; duplicates (by normalized
 * URL) are removed, preserving first-seen order.
 * @param {string} text
 * @returns {Array<{ kind: string, url: string, id?: string, normalizedUrl: string }>}
 */
export function parseImportLines(text) {
  const tokens = String(text || "")
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const seen = new Set();
  const sources = [];
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

function guessWebTitle(url) {
  const parsed = safeParseUrl(url);
  if (!parsed) return url;
  const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();
  if (lastSegment) {
    return decodeURIComponent(lastSegment).replace(/[-_]+/g, " ").trim() || parsed.hostname;
  }
  return parsed.hostname.replace(/^www\./, "");
}

/**
 * Build a draft suitable for `createVideoItemValue` from a detected source.
 * The draft REFERENCES the source URL with a best-effort readable title; no
 * server fetch is performed.
 * @param {{ kind: string, url: string, id?: string, normalizedUrl: string }} source
 * @returns {{ title: string, path: string, type: string, subtype: string, metadata: object } | null}
 */
export function buildImportDraft(source) {
  if (!source || source.kind === IMPORT_KINDS.UNKNOWN) return null;
  const sourceUrl = source.normalizedUrl || source.url;

  let title;
  let type;
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

function normalizeManifestPath(value) {
  const path = String(value || "").trim().replace(/\\/g, "/");
  if (!path || path.startsWith("/") || /^[a-zA-Z]:\//.test(path)) return "";
  const segments = path.split("/").filter(Boolean);
  if (!segments.length || segments.some((segment) => segment === "." || segment === "..")) return "";
  return segments.join("/");
}

function guessTitleFromPath(path) {
  const fileName = path.split("/").filter(Boolean).pop() || path;
  const base = fileName.includes(".") ? fileName.split(".").slice(0, -1).join(".") : fileName;
  return decodeURIComponent(base).replace(/[-_]+/g, " ").trim() || fileName;
}

function inferItemType(path, mimeType = "") {
  const lowerMime = String(mimeType || "").toLowerCase();
  if (lowerMime.startsWith("video/")) return "video";
  if (lowerMime.startsWith("audio/")) return "audio";
  const extension = path.includes(".") ? path.split(".").pop().toLowerCase() : "";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  if (AUDIO_EXTENSIONS.has(extension)) return "audio";
  return "";
}

function normalizeManifestFileEntry(entry, manifestRoot) {
  if (!entry || typeof entry !== "object") return null;
  const path = normalizeManifestPath(entry.relativePath || entry.path || entry.name);
  if (!path) return null;
  const mimeType = String(entry.mimeType || entry.type || "").trim();
  const title = String(entry.title || "").trim() || guessTitleFromPath(path);
  const size = Number(entry.size);
  return {
    title,
    path,
    type: inferItemType(path, mimeType),
    subtype: "",
    notes: String(entry.notes || "").trim(),
    tags: Array.isArray(entry.tags) ? entry.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
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

/**
 * Parse a local-folder manifest into item drafts. The browser cannot safely
 * read arbitrary folders by path, so this accepts an explicit manifest file:
 *   { "rootLabel": "Batch", "files": [{ "path": "folder/video.mp4" }] }
 */
export function parseLocalFolderManifest(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text || "").trim() || "{}");
  } catch {
    return [];
  }
  const manifestRoot = String(parsed?.rootLabel || parsed?.root || "").trim();
  const files = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.files) ? parsed.files : [];
  return files
    .map((entry) => normalizeManifestFileEntry(entry, manifestRoot))
    .filter(Boolean);
}
