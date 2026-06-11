// G8 — shared logic for the Uploader and Transcriber pages.
//
// Pure, storage/AI-agnostic helpers so the pages stay thin and the behavior is
// unit-tested. The pages inject the registered FileStore / AiProvider (and, for
// local transcription, the in-browser Whisper factory).

/** Seconds → a friendly clock (m:ss or h:mm:ss). */
export function secondsToClock(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p2 = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p2(m)}:${p2(ss)}` : `${m}:${p2(ss)}`;
}

/** Flatten a transcription result to plain text, optionally with [timecode] prefixes. */
export function transcriptToText(result = {}, { withTimecodes = false } = {}) {
  const segments = Array.isArray(result?.segments) ? result.segments : [];
  if (withTimecodes && segments.length) {
    return segments.map((seg) => `[${secondsToClock(seg.start)}] ${String(seg.text || "").trim()}`).join("\n");
  }
  const base = String(result?.transcription || "").trim();
  if (base) return base;
  return segments.map((seg) => String(seg.text || "").trim()).filter(Boolean).join(" ");
}

/**
 * Choose which transcription provider to use.
 * @param {object} args
 * @param {"cloud"|"local"} args.mode
 * @param {object} [args.cloudProvider] - the registered AiProvider
 * @param {() => object} [args.localFactory] - builds the in-browser Whisper provider
 * @returns {{ provider: object, mode: string }}
 */
export function resolveTranscribeProvider({ mode, cloudProvider, localFactory } = {}) {
  if (mode === "local") {
    if (typeof localFactory !== "function") throw new Error("التفريغ المحلي غير متاح في هذه البيئة.");
    return { provider: localFactory(), mode: "local" };
  }
  const available = cloudProvider && (typeof cloudProvider.isAvailable !== "function" || cloudProvider.isAvailable());
  if (!available || typeof cloudProvider.transcribe !== "function") {
    throw new Error("التفريغ السحابي غير متاح — سجّل الدخول إلى خادم سحابي أو استخدم التفريغ المحلي.");
  }
  return { provider: cloudProvider, mode: "cloud" };
}

/** Which transcription modes are offered, given the current providers. */
export function availableTranscribeModes({ cloudProvider, hasLocal } = {}) {
  const modes = [];
  if (cloudProvider && (typeof cloudProvider.isAvailable !== "function" || cloudProvider.isAvailable())) modes.push("cloud");
  if (hasLocal) modes.push("local");
  return modes;
}

/** Traversal-safe, readable storage key from a filename (+ optional folder). */
export function sanitizeUploadKey(name, { folder = "" } = {}) {
  const clean = String(name || "").trim().replace(/[^\w.\-؀-ۿ]+/g, "_").replace(/^[_.]+|_+$/g, "");
  const safe = clean || `file-${Date.now()}`;
  const dir = String(folder || "").replace(/^[/\\]+|[/\\]+$/g, "");
  return dir ? `${dir}/${safe}` : safe;
}

/** Whether a File looks like audio/video we can transcribe. */
export function isAudioVideo(file) {
  const type = String(file?.type || "");
  if (/^(audio|video)\//.test(type)) return true;
  return /\.(mp3|wav|m4a|ogg|flac|aac|mp4|webm|mov|mkv|m4v)$/i.test(String(file?.name || ""));
}

/** Group a flat key list into a count + a short, sorted preview. */
export function describeFileList(keys = []) {
  const list = Array.isArray(keys) ? keys.filter(Boolean) : [];
  return { count: list.length, preview: [...list].sort().slice(0, 200) };
}

const FILE_TYPE_RULES = [
  ["image", /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i],
  ["video", /\.(m4v|mkv|mov|mp4|webm)$/i],
  ["audio", /\.(aac|flac|m4a|mp3|ogg|wav)$/i],
  ["document", /\.(csv|docx?|md|pdf|pptx?|rtf|txt|xlsx?)$/i]
];

export function fileTypeFromKey(key = "") {
  const text = String(key || "");
  return FILE_TYPE_RULES.find(([, pattern]) => pattern.test(text))?.[0] || "file";
}

export function buildFileBrowserRows(keys = []) {
  return (Array.isArray(keys) ? keys : [])
    .filter(Boolean)
    .map((key) => {
      const clean = String(key);
      const parts = clean.split("/").filter(Boolean);
      const name = parts.at(-1) || clean;
      const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
      return {
        key: clean,
        name,
        folder,
        type: fileTypeFromKey(clean)
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key, "ar"));
}

export function filterFileBrowserRows(rows = [], query = "") {
  const needle = String(query || "").trim().toLowerCase();
  const list = Array.isArray(rows) ? rows : [];
  if (!needle) return list;
  return list.filter((row) => (
    String(row.key || "").toLowerCase().includes(needle) ||
    String(row.name || "").toLowerCase().includes(needle) ||
    String(row.folder || "").toLowerCase().includes(needle) ||
    String(row.type || "").toLowerCase().includes(needle)
  ));
}

export function canUseServerMediaTools({ backend, token, role } = {}) {
  if (!backend || backend === "local") return false;
  if (!token) return false;
  return ["admin", "owner", "editor"].includes(role);
}

export function deriveMediaSourceKey(item = {}) {
  const metadata = item?.metadata || {};
  if (metadata.fileKey) return String(metadata.fileKey);
  if (metadata.storageKey) return String(metadata.storageKey);
  if (metadata.media?.sourceKey) return String(metadata.media.sourceKey);
  if (item.path && !/^[a-z]:[\\/]/i.test(String(item.path)) && !/^[a-z][a-z0-9+.-]*:/i.test(String(item.path))) {
    return String(item.path);
  }
  return "";
}

export function selectSmartThumbnailSecond(probe = {}) {
  const duration = Number(probe.durationSec ?? probe.duration);
  if (!Number.isFinite(duration) || duration <= 0) return 1;
  return Number(Math.max(1, Math.min(duration - 0.25, duration * 0.1)).toFixed(3));
}

export function buildTimeBookmarkMarkers(bookmarks = [], durationSec = 0) {
  const duration = Number(durationSec);
  if (!Number.isFinite(duration) || duration <= 0) return [];

  return (Array.isArray(bookmarks) ? bookmarks : [])
    .map((bookmark) => {
      const time = Number(bookmark?.timestamp ?? bookmark?.time);
      if (!Number.isFinite(time) || time < 0 || time > duration) return null;
      return {
        id: String(bookmark.id || `${time}`),
        time,
        label: String(bookmark.label || bookmark.title || secondsToClock(time)),
        percent: Number(((time / duration) * 100).toFixed(3))
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);
}

function truncateBookmarkTitle(text = "", max = 52) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 3)).trim()}...`;
}

export function createTranscriptBookmarkDraft({ time = 0, segments = [] } = {}) {
  const seconds = Number(time);
  const candidates = (Array.isArray(segments) ? segments : [])
    .map((segment, fallbackIndex) => ({
      ...segment,
      index: segment.index ?? fallbackIndex,
      seconds: Number(segment.seconds)
    }))
    .filter((segment) => Number.isFinite(segment.seconds) && String(segment.text || "").trim())
    .sort((a, b) => a.seconds - b.seconds);
  if (!candidates.length) return null;

  const target = candidates.reduce((active, segment) => {
    if (segment.seconds <= seconds) return segment;
    return active;
  }, candidates[0].seconds > seconds ? candidates[0] : null);
  if (!target) return null;

  const text = String(target.text || "").replace(/\s+/g, " ").trim();
  const timecode = target.timecode || secondsToClock(target.seconds);
  return {
    title: truncateBookmarkTitle(text),
    note: `[${timecode}] ${text}`,
    transcriptSegmentIndex: target.index
  };
}

export function createMediaMetadataPatch({
  probe,
  thumbnailKey,
  audioKey,
  previewKey,
  derivedKey
} = {}) {
  const media = {
    ...(probe || {})
  };
  if (thumbnailKey) media.thumbnailKey = thumbnailKey;
  if (audioKey) media.audioKey = audioKey;
  if (previewKey) media.previewKey = previewKey;
  if (derivedKey) media.derivedKey = derivedKey;
  const patch = { metadata: { media } };
  if (Number.isFinite(Number(probe?.durationSec))) patch.duration = Number(probe.durationSec);
  if (thumbnailKey) patch.thumbnail = thumbnailKey;
  return patch;
}

export function mediaProbeToDisplayRows(media = {}) {
  const width = Number(media.width);
  const height = Number(media.height);
  const bitrate = Number(media.bitrate);
  return [
    { id: "duration", label: "المدة", value: Number.isFinite(Number(media.durationSec)) ? secondsToClock(media.durationSec) : "—", dir: "ltr" },
    { id: "resolution", label: "الدقة", value: width && height ? `${width}×${height}` : "—", dir: "ltr" },
    { id: "codec", label: "الكوديك", value: media.codec || "—", dir: "ltr" },
    { id: "bitrate", label: "Bitrate", value: bitrate ? `${Math.round(bitrate / 1000)} kb/s` : "—", dir: "ltr" },
    { id: "audio", label: "صوت", value: media.hasAudio ? "نعم" : "لا" }
  ];
}

export function mergeMediaJobs(jobs = []) {
  return (Array.isArray(jobs) ? jobs : [])
    .map((job) => ({
      ...job,
      progress: Math.max(0, Math.min(100, Number(job.progress) || 0))
    }))
    .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
}

export function formatMediaJobStatus(job = {}) {
  const status = job.status || "queued";
  if (status === "done") return { label: "مكتملة", tone: "va-accent-text-on-soft", progress: 100 };
  if (status === "error") return { label: "فشلت", tone: "text-red-200", progress: Number(job.progress) || 0 };
  if (status === "running") return { label: "قيد التنفيذ", tone: "text-sky-200", progress: Number(job.progress) || 1 };
  return { label: "في الانتظار", tone: "text-amber-200", progress: Number(job.progress) || 0 };
}
