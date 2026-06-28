// G8 - shared logic for the Uploader and Transcriber pages.
//
// Pure, storage/AI-agnostic helpers so the pages stay thin and the behavior is
// unit-tested. The pages inject the registered FileStore / AiProvider (and, for
// local transcription, the in-browser Whisper factory).

export interface TranscriptSegmentLike {
  start?: number | string | null;
  end?: number | string | null;
  text?: string | null;
  seconds?: number | string | null;
  index?: number | null;
  timecode?: string | null;
}

export interface TranscriptResultLike {
  transcription?: string | null;
  segments?: TranscriptSegmentLike[] | null;
}

export interface TranscribeProviderLike {
  isAvailable?: () => boolean;
  transcribe?: (...args: unknown[]) => unknown;
}

export interface ResolveTranscribeProviderArgs {
  mode?: "cloud" | "local" | string | null;
  cloudProvider?: TranscribeProviderLike | null;
  localFactory?: () => unknown;
}

export interface FileBrowserRow {
  key: string;
  name: string;
  folder: string;
  type: string;
}

export interface BookmarkLike {
  id?: string | number | null;
  timestamp?: number | string | null;
  time?: number | string | null;
  label?: string | null;
  title?: string | null;
}

export interface TranscriptBookmarkDraft {
  title: string;
  note: string;
  transcriptSegmentIndex: number | null | undefined;
}

export interface DerivedFileLike {
  id?: string | number | null;
  key?: string | null;
  outputKey?: string | null;
  label?: string | null;
  type?: string | null;
  contentType?: string | null;
  jobId?: string | number | null;
  sourceKey?: string | null;
  createdAt?: string | null;
  updatedAt?: number | string | null;
}

export interface DerivedFileRecord {
  id: string;
  key: string;
  label: string;
  type: string;
  jobId: string;
  sourceKey: string;
  createdAt: string;
}

export interface MediaProbeLike {
  durationSec?: number | string | null;
  width?: number | string | null;
  height?: number | string | null;
  codec?: string | null;
  bitrate?: number | string | null;
  hasAudio?: boolean | null;
  [key: string]: unknown;
}

export interface MediaMetadataPatch {
  metadata: {
    media: Record<string, unknown> & {
      derivedFiles?: DerivedFileRecord[];
      derivedKey?: string;
      thumbnailKey?: string;
      audioKey?: string;
      previewKey?: string;
    };
  };
  duration?: number;
  thumbnail?: string;
}

export interface MediaDisplayRow {
  id: string;
  label: string;
  value: string;
  dir?: "ltr" | "rtl";
}

export interface MediaJobLike {
  progress?: number | string | null;
  updatedAt?: number | string | null;
  createdAt?: number | string | null;
  status?: string | null;
  type?: string | null;
  outputKey?: string | null;
  sourceKey?: string | null;
  id?: string | number | null;
  [key: string]: unknown;
}

export interface MediaJobStatusInfo {
  label: string;
  tone: string;
  progress: number;
}

export interface TimeBookmarkMarker {
  id: string;
  time: number;
  label: string;
  percent: number;
}

export interface MediaFileTypeLike {
  type?: string | null;
  name?: string | null;
}

/** Seconds -> a friendly clock (m:ss or h:mm:ss). */
export function secondsToClock(sec: number | string | null | undefined): string {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p2 = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p2(m)}:${p2(ss)}` : `${m}:${p2(ss)}`;
}

/** Flatten a transcription result to plain text, optionally with [timecode] prefixes. */
export function transcriptToText(
  result: TranscriptResultLike = {},
  { withTimecodes = false }: { withTimecodes?: boolean } = {}
): string {
  const segments = Array.isArray(result?.segments) ? result.segments : [];
  if (withTimecodes && segments.length) {
    return segments.map((seg) => `[${secondsToClock(seg.start)}] ${String(seg.text || "").trim()}`).join("\n");
  }
  const base = String(result?.transcription || "").trim();
  if (base) return base;
  return segments.map((seg) => String(seg.text || "").trim()).filter(Boolean).join(" ");
}

/** Choose which transcription provider to use. */
export function resolveTranscribeProvider({
  mode,
  cloudProvider,
  localFactory
}: ResolveTranscribeProviderArgs = {}): { provider: unknown; mode: "cloud" | "local" } {
  if (mode === "local") {
    if (typeof localFactory !== "function") throw new Error("التفريغ المحلي غير متاح في هذه البيئة.");
    return { provider: localFactory(), mode: "local" };
  }
  const available = cloudProvider && (typeof cloudProvider.isAvailable !== "function" || cloudProvider.isAvailable());
  if (!cloudProvider || !available || typeof cloudProvider.transcribe !== "function") {
    throw new Error("التفريغ السحابي غير متاح — سجّل الدخول إلى خادم سحابي أو استخدم التفريغ المحلي.");
  }
  return { provider: cloudProvider, mode: "cloud" };
}

/** Which transcription modes are offered, given the current providers. */
export function availableTranscribeModes({
  cloudProvider,
  hasLocal
}: {
  cloudProvider?: TranscribeProviderLike | null;
  hasLocal?: boolean;
} = {}): Array<"cloud" | "local"> {
  const modes: Array<"cloud" | "local"> = [];
  if (cloudProvider && (typeof cloudProvider.isAvailable !== "function" || cloudProvider.isAvailable())) modes.push("cloud");
  if (hasLocal) modes.push("local");
  return modes;
}

/** Traversal-safe, readable storage key from a filename (+ optional folder). */
export function sanitizeUploadKey(
  name: string | number | null | undefined,
  { folder = "" }: { folder?: string } = {}
): string {
  const clean = String(name || "").trim().replace(/[^\w.\-؀-ۿ]+/g, "_").replace(/^[_.]+|_+$/g, "");
  const safe = clean || `file-${Date.now()}`;
  const dir = String(folder || "").replace(/^[/\\]+|[/\\]+$/g, "");
  return dir ? `${dir}/${safe}` : safe;
}

/** Whether a File looks like audio/video we can transcribe. */
export function isAudioVideo(file: MediaFileTypeLike | null | undefined): boolean {
  const type = String(file?.type || "");
  if (/^(audio|video)\//.test(type)) return true;
  return /\.(mp3|wav|m4a|ogg|flac|aac|mp4|webm|mov|mkv|m4v)$/i.test(String(file?.name || ""));
}

/** Group a flat key list into a count + a short, sorted preview. */
export function describeFileList(keys: Array<string | null | undefined> = []): { count: number; preview: string[] } {
  const list = Array.isArray(keys) ? keys.filter(Boolean) as string[] : [];
  return { count: list.length, preview: [...list].sort().slice(0, 200) };
}

const FILE_TYPE_RULES: Array<[string, RegExp]> = [
  ["image", /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i],
  ["video", /\.(m4v|mkv|mov|mp4|webm)$/i],
  ["audio", /\.(aac|flac|m4a|mp3|ogg|wav)$/i],
  ["document", /\.(csv|docx?|md|pdf|pptx?|rtf|txt|xlsx?)$/i]
];

export function fileTypeFromKey(key = ""): string {
  const text = String(key || "");
  return FILE_TYPE_RULES.find(([, pattern]) => pattern.test(text))?.[0] || "file";
}

export function buildFileBrowserRows(keys: Array<string | null | undefined> = []): FileBrowserRow[] {
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

export function filterFileBrowserRows(rows: FileBrowserRow[] = [], query = ""): FileBrowserRow[] {
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

export function canUseServerMediaTools({
  backend,
  token,
  role
}: {
  backend?: string | null;
  token?: string | null;
  role?: string | null;
} = {}): boolean {
  if (!backend || backend === "local") return false;
  if (!token) return false;
  return ["admin", "owner", "editor"].includes(String(role || ""));
}

export function deriveMediaSourceKey(item: { metadata?: Record<string, any>; path?: string | null } = {}): string {
  const metadata = item?.metadata || {};
  if (metadata.fileKey) return String(metadata.fileKey);
  if (metadata.storageKey) return String(metadata.storageKey);
  if (metadata.media?.sourceKey) return String(metadata.media.sourceKey);
  if (item.path && !/^[a-z]:[\\/]/i.test(String(item.path)) && !/^[a-z][a-z0-9+.-]*:/i.test(String(item.path))) {
    return String(item.path);
  }
  return "";
}

export function selectSmartThumbnailSecond(
  probe: { durationSec?: number | string | null; duration?: number | string | null } = {}
): number {
  const duration = Number(probe.durationSec ?? probe.duration);
  if (!Number.isFinite(duration) || duration <= 0) return 1;
  return Number(Math.max(1, Math.min(duration - 0.25, duration * 0.1)).toFixed(3));
}

export function buildTimeBookmarkMarkers(bookmarks: BookmarkLike[] = [], durationSec = 0): TimeBookmarkMarker[] {
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
    .filter(Boolean) as TimeBookmarkMarker[];
}

function truncateBookmarkTitle(text = "", max = 52): string {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 3)).trim()}...`;
}

export function createTranscriptBookmarkDraft({
  time = 0,
  segments = []
}: {
  time?: number | string | null;
  segments?: TranscriptSegmentLike[];
} = {}): TranscriptBookmarkDraft | null {
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

  const target = candidates.reduce((active: (typeof candidates)[number] | null, segment) => {
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

function normalizeDerivedFile(file: DerivedFileLike = {}): DerivedFileRecord | null {
  const key = String(file.key || file.outputKey || "").trim();
  if (!key) return null;
  return {
    id: String(file.id || file.jobId || key),
    key,
    label: String(file.label || "نسخة ويب").trim() || "نسخة ويب",
    type: String(file.type || file.contentType || "video/mp4").trim() || "video/mp4",
    jobId: file.jobId ? String(file.jobId) : file.id ? String(file.id) : "",
    sourceKey: String(file.sourceKey || "").trim(),
    createdAt: file.createdAt || new Date(Number(file.updatedAt || Date.now())).toISOString()
  };
}

export function buildDerivedFileRecordsFromJobs(
  jobs: Array<{ type?: string | null; status?: string | null; outputKey?: string | null; sourceKey?: string | null; id?: string | number | null; updatedAt?: number | string | null }> = [],
  { sourceKey = "" }: { sourceKey?: string } = {}
): DerivedFileRecord[] {
  const wantedSource = String(sourceKey || "").trim();
  return (Array.isArray(jobs) ? jobs : [])
    .filter((job) => (
      job?.type === "transcode" &&
      job?.status === "done" &&
      String(job?.outputKey || "").trim() &&
      (!wantedSource || String(job?.sourceKey || "").trim() === wantedSource)
    ))
    .map((job) => normalizeDerivedFile({
      id: job.id,
      key: job.outputKey,
      label: "نسخة ويب",
      type: "video/mp4",
      jobId: job.id,
      sourceKey: job.sourceKey,
      updatedAt: job.updatedAt
    }))
    .filter(Boolean) as DerivedFileRecord[];
}

export function mergeDerivedFiles(existing: DerivedFileLike[] = [], incoming: DerivedFileLike[] = []): DerivedFileRecord[] {
  const seen = new Set<string>();
  const merged: DerivedFileRecord[] = [];
  for (const file of [...(Array.isArray(incoming) ? incoming : []), ...(Array.isArray(existing) ? existing : [])]) {
    const normalized = normalizeDerivedFile(file);
    if (!normalized || seen.has(normalized.key)) continue;
    seen.add(normalized.key);
    merged.push(normalized);
  }
  return merged;
}

export function removeDerivedFile(existing: DerivedFileLike[] = [], key = ""): DerivedFileRecord[] {
  const target = String(key || "").trim();
  if (!target) return mergeDerivedFiles([], existing);
  return mergeDerivedFiles([], existing).filter((file) => file.key !== target);
}

export function createMediaMetadataPatch({
  probe,
  thumbnailKey,
  audioKey,
  previewKey,
  derivedKey,
  derivedFiles
}: {
  probe?: MediaProbeLike;
  thumbnailKey?: string;
  audioKey?: string;
  previewKey?: string;
  derivedKey?: string;
  derivedFiles?: DerivedFileLike[];
} = {}): MediaMetadataPatch {
  const media: Record<string, unknown> & {
    derivedFiles?: DerivedFileRecord[];
    derivedKey?: string;
    thumbnailKey?: string;
    audioKey?: string;
    previewKey?: string;
  } = {
    ...(probe || {})
  };
  if (thumbnailKey) media.thumbnailKey = thumbnailKey;
  if (audioKey) media.audioKey = audioKey;
  if (previewKey) media.previewKey = previewKey;
  if (Array.isArray(derivedFiles)) {
    media.derivedFiles = mergeDerivedFiles([], derivedFiles);
    media.derivedKey = media.derivedFiles[0]?.key || "";
  }
  if (derivedKey) media.derivedKey = derivedKey;
  const patch: MediaMetadataPatch = { metadata: { media } };
  if (Number.isFinite(Number(probe?.durationSec))) patch.duration = Number(probe?.durationSec);
  if (thumbnailKey) patch.thumbnail = thumbnailKey;
  return patch;
}

export function mediaProbeToDisplayRows(media: MediaProbeLike = {}): MediaDisplayRow[] {
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

export function mergeMediaJobs(jobs: MediaJobLike[] = []): MediaJobLike[] {
  return (Array.isArray(jobs) ? jobs : [])
    .map((job) => ({
      ...job,
      progress: Math.max(0, Math.min(100, Number(job.progress) || 0))
    }))
    .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
}

export function formatMediaJobStatus(job: MediaJobLike = {}): MediaJobStatusInfo {
  const status = job.status || "queued";
  if (status === "done") return { label: "مكتملة", tone: "va-accent-text-on-soft", progress: 100 };
  if (status === "error") return { label: "فشلت", tone: "text-red-200", progress: Number(job.progress) || 0 };
  if (status === "running") return { label: "قيد التنفيذ", tone: "text-sky-200", progress: Number(job.progress) || 1 };
  return { label: "في الانتظار", tone: "text-amber-200", progress: Number(job.progress) || 0 };
}
