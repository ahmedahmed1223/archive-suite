export class MediaPlanError extends Error {
  code?: string;

  constructor(message: string, { code }: { code?: string } = {}) {
    super(message);
    this.name = "MediaPlanError";
    this.code = code;
  }
}

function required(value: unknown, label: string): string {
  if (!value) throw new MediaPlanError(`${label} مطلوب.`, { code: "MISSING_ARG" });
  return String(value);
}

function positiveNumber(value: unknown, fallback: number, { min = 0.001, max = Number.MAX_SAFE_INTEGER } = {}): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function integer(value: unknown, fallback: number, { min = 1, max = 4096 } = {}): number {
  return Math.round(positiveNumber(value, fallback, { min, max }));
}

function cleanBitrate(value: unknown, fallback: string = "192k"): string {
  const text = String(value || fallback).trim();
  return /^\d{2,4}k$/i.test(text) ? text.toLowerCase() : fallback;
}

export function buildFfprobeArgs(src: string): string[] {
  return ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", required(src, "المصدر")];
}

export function buildThumbnailArgs(src: string, { atSec = 1, width = 480, out }: { atSec?: number; width?: number; out: string }): string[] {
  return [
    "-ss", String(Number(positiveNumber(atSec, 1).toFixed(3)).toString()),
    "-i", required(src, "المصدر"),
    "-frames:v", "1",
    "-vf", `thumbnail,scale=${integer(width, 480)}:-2`,
    "-q:v", "3",
    "-y", required(out, "الإخراج")
  ];
}

export function buildGifPreviewArgs(src: string, { startSec = 0, durationSec = 4, width = 320, fps = 12, out }: { startSec?: number; durationSec?: number; width?: number; fps?: number; out: string }): string[] {
  return [
    "-ss", String(Number(positiveNumber(startSec, 0.001, { min: 0 }).toFixed(3)).toString()),
    "-t", String(Number(positiveNumber(durationSec, 4, { min: 0.5, max: 12 }).toFixed(3)).toString()),
    "-i", required(src, "المصدر"),
    "-vf", `fps=${integer(fps, 12, { min: 4, max: 24 })},scale=${integer(width, 320)}:-1:flags=lanczos`,
    "-loop", "0",
    "-y", required(out, "الإخراج")
  ];
}

export function buildAudioArgs(src: string, { format = "mp3", bitrate = "192k", out }: { format?: string; bitrate?: string; out: string }): string[] {
  const normalized = String(format || "mp3").toLowerCase() === "m4a" ? "m4a" : "mp3";
  return [
    "-i", required(src, "المصدر"),
    "-vn",
    "-c:a", normalized === "m4a" ? "aac" : "libmp3lame",
    "-b:a", cleanBitrate(bitrate),
    "-y", required(out, "الإخراج")
  ];
}

export function buildTranscodeArgs(src: string, { height = 720, codec = "libx264", crf = 23, out }: { height?: number; codec?: string; crf?: number; out: string }): string[] {
  const safeCodec = String(codec || "libx264").trim() || "libx264";
  return [
    "-i", required(src, "المصدر"),
    "-vf", `scale=-2:${integer(height, 720, { min: 144, max: 2160 })}`,
    "-c:v", safeCodec,
    "-preset", "veryfast",
    "-crf", String(integer(crf, 23, { min: 16, max: 35 })),
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    "-y", required(out, "الإخراج")
  ];
}

function asNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export interface FfprobeMetadata {
  durationSec: number;
  width: number | null;
  height: number | null;
  codec: string | null;
  bitrate: number | null;
  hasAudio: boolean;
}

export function parseFfprobe(json: string | Record<string, unknown>): FfprobeMetadata {
  const data = typeof json === "string" ? JSON.parse(json || "{}") : (json || {}) as Record<string, unknown>;
  const streams = Array.isArray(data.streams) ? data.streams : [];
  const video = (streams.find((stream: unknown) => (stream as Record<string, unknown>)?.codec_type === "video") || {}) as Record<string, unknown>;
  const audio = streams.find((stream: unknown) => (stream as Record<string, unknown>)?.codec_type === "audio") || null;
  const duration = asNumber((data.format as Record<string, unknown>)?.duration) ?? asNumber(video.duration) ?? 0;
  return {
    durationSec: duration,
    width: Number(video.width) || null,
    height: Number(video.height) || null,
    codec: (video.codec_name || null) as string | null,
    bitrate: asNumber((data.format as Record<string, unknown>)?.bit_rate) ?? asNumber(video.bit_rate),
    hasAudio: Boolean(audio)
  };
}

export function smartThumbnailSecond(metadata: Partial<FfprobeMetadata> = {}): number {
  const duration = Number(metadata.durationSec);
  if (!Number.isFinite(duration) || duration <= 0) return 1;
  return Number(Math.max(1, Math.min(duration - 0.25, duration * 0.1)).toFixed(3));
}
