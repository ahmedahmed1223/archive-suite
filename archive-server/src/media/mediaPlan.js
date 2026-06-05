export class MediaPlanError extends Error {
  constructor(message, { code } = {}) {
    super(message);
    this.name = "MediaPlanError";
    this.code = code;
  }
}

function required(value, label) {
  if (!value) throw new MediaPlanError(`${label} مطلوب.`, { code: "MISSING_ARG" });
  return String(value);
}

function positiveNumber(value, fallback, { min = 0.001, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function integer(value, fallback, { min = 1, max = 4096 } = {}) {
  return Math.round(positiveNumber(value, fallback, { min, max }));
}

function cleanBitrate(value, fallback = "192k") {
  const text = String(value || fallback).trim();
  return /^\d{2,4}k$/i.test(text) ? text.toLowerCase() : fallback;
}

export function buildFfprobeArgs(src) {
  return ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", required(src, "المصدر")];
}

export function buildThumbnailArgs(src, { atSec = 1, width = 480, out } = {}) {
  return [
    "-ss", String(Number(positiveNumber(atSec, 1).toFixed(3)).toString()),
    "-i", required(src, "المصدر"),
    "-frames:v", "1",
    "-vf", `thumbnail,scale=${integer(width, 480)}:-2`,
    "-q:v", "3",
    "-y", required(out, "الإخراج")
  ];
}

export function buildGifPreviewArgs(src, { startSec = 0, durationSec = 4, width = 320, fps = 12, out } = {}) {
  return [
    "-ss", String(Number(positiveNumber(startSec, 0.001, { min: 0 }).toFixed(3)).toString()),
    "-t", String(Number(positiveNumber(durationSec, 4, { min: 0.5, max: 12 }).toFixed(3)).toString()),
    "-i", required(src, "المصدر"),
    "-vf", `fps=${integer(fps, 12, { min: 4, max: 24 })},scale=${integer(width, 320)}:-1:flags=lanczos`,
    "-loop", "0",
    "-y", required(out, "الإخراج")
  ];
}

export function buildAudioArgs(src, { format = "mp3", bitrate = "192k", out } = {}) {
  const normalized = String(format || "mp3").toLowerCase() === "m4a" ? "m4a" : "mp3";
  return [
    "-i", required(src, "المصدر"),
    "-vn",
    "-c:a", normalized === "m4a" ? "aac" : "libmp3lame",
    "-b:a", cleanBitrate(bitrate),
    "-y", required(out, "الإخراج")
  ];
}

export function buildTranscodeArgs(src, { height = 720, codec = "libx264", crf = 23, out } = {}) {
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

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseFfprobe(json) {
  const data = typeof json === "string" ? JSON.parse(json || "{}") : (json || {});
  const streams = Array.isArray(data.streams) ? data.streams : [];
  const video = streams.find((stream) => stream?.codec_type === "video") || {};
  const audio = streams.find((stream) => stream?.codec_type === "audio") || null;
  const duration = asNumber(data.format?.duration) ?? asNumber(video.duration) ?? 0;
  return {
    durationSec: duration,
    width: Number(video.width) || null,
    height: Number(video.height) || null,
    codec: video.codec_name || null,
    bitrate: asNumber(data.format?.bit_rate) ?? asNumber(video.bit_rate),
    hasAudio: Boolean(audio)
  };
}

export function smartThumbnailSecond(metadata = {}) {
  const duration = Number(metadata.durationSec);
  if (!Number.isFinite(duration) || duration <= 0) return 1;
  return Number(Math.max(1, Math.min(duration - 0.25, duration * 0.1)).toFixed(3));
}
