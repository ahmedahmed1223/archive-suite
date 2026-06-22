// Broadcast container and codec definitions for MXF/XDCAM/ProRes/DNxHR.
// Pure arg-builders — no ffmpeg binary is invoked here. All exec is in the
// caller (runMedia / broadcast export) which accepts an injectable runner so
// tests never need a real binary.

import { spawn } from "node:child_process";

// ── ProRes ──────────────────────────────────────────────────────────────────
// Apple ProRes via the prores_ks encoder. Four standard quality profiles:
//   0  proxy       ~45 Mb/s @ 1080p29.97
//   1  LT          ~102 Mb/s
//   2  standard    ~147 Mb/s
//   3  HQ          ~220 Mb/s

export const PRORES_PROFILES = Object.freeze({
  proxy:    0,
  lt:       1,
  standard: 2,
  hq:       3,
});

/**
 * Build the ffmpeg argv for a ProRes transcode.
 *
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {0|1|2|3} profile  0=proxy 1=lt 2=standard 3=hq (default 3)
 * @returns {string[]}
 */
export function buildProResArgs(inputPath, outputPath, profile = PRORES_PROFILES.hq) {
  if (!inputPath) throw new Error("inputPath مطلوب.");
  if (!outputPath) throw new Error("outputPath مطلوب.");
  const p = Number(profile);
  if (!Number.isInteger(p) || p < 0 || p > 3) {
    throw new Error(`ProRes profile غير صحيح: ${profile}. القيم المقبولة 0..3.`);
  }
  return [
    "-i", inputPath,
    "-c:v", "prores_ks",
    "-profile:v", String(p),
    "-vendor", "apl0",
    "-pix_fmt", "yuv422p10le",
    "-c:a", "pcm_s16le",
    "-y", outputPath,
  ];
}

// ── DNxHR ────────────────────────────────────────────────────────────────────
// Avid DNxHR via the dnxhd encoder. Five quality tiers:
//   lb   low-bandwidth   ~135 Mb/s @ 1080p29.97
//   sq   standard        ~220 Mb/s
//   hq   high quality    ~365 Mb/s
//   hqx  high quality 12-bit ~440 Mb/s
//   444  full 4:4:4      ~730 Mb/s

export const DNXHR_PROFILES = Object.freeze({
  lb:    "dnxhr_lb",
  sq:    "dnxhr_sq",
  hq:    "dnxhr_hq",
  hqx:   "dnxhr_hqx",
  "444": "dnxhr_444",
});

const VALID_DNXHR_PROFILES = new Set(Object.values(DNXHR_PROFILES));

/**
 * Build the ffmpeg argv for a DNxHR transcode.
 *
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {"dnxhr_lb"|"dnxhr_sq"|"dnxhr_hq"|"dnxhr_hqx"|"dnxhr_444"} profile
 * @returns {string[]}
 */
export function buildDnxhrArgs(inputPath, outputPath, profile = DNXHR_PROFILES.hq) {
  if (!inputPath) throw new Error("inputPath مطلوب.");
  if (!outputPath) throw new Error("outputPath مطلوب.");
  if (!VALID_DNXHR_PROFILES.has(profile)) {
    throw new Error(`DNxHR profile غير صحيح: ${profile}. القيم المقبولة: ${[...VALID_DNXHR_PROFILES].join(", ")}.`);
  }
  // HQX and 444 require higher bit-depth pixel format
  const pix = (profile === DNXHR_PROFILES.hqx || profile === DNXHR_PROFILES["444"])
    ? "yuv422p10le"
    : "yuv422p";
  return [
    "-i", inputPath,
    "-c:v", "dnxhd",
    "-profile:v", profile,
    "-pix_fmt", pix,
    "-c:a", "pcm_s16le",
    "-y", outputPath,
  ];
}

// ── MXF / XDCAM demux flags ──────────────────────────────────────────────────
// MXF is a container; XDCAM is MXF-wrapped MPEG-2 (422P@HL).
// Insert -f mxf before -i so ffmpeg treats the container correctly.

/**
 * Return the demux input flags for a given source path.
 * Inserts `-f mxf` for .mxf files.
 *
 * @param {string} inputPath
 * @returns {string[]}  flags to prepend before `-i inputPath`
 */
export function mxfInputFlags(inputPath) {
  if (String(inputPath || "").toLowerCase().endsWith(".mxf")) {
    return ["-f", "mxf"];
  }
  return [];
}

/**
 * Build a complete ffmpeg input section (demux flags + -i path) for any source.
 * Callers concat these args with their codec/output args.
 *
 * @param {string} inputPath
 * @returns {string[]}
 */
export function buildBroadcastInputArgs(inputPath) {
  if (!inputPath) throw new Error("inputPath مطلوب.");
  return [...mxfInputFlags(inputPath), "-i", inputPath];
}

// ── probeBroadcastMetadata ───────────────────────────────────────────────────

/**
 * Run ffprobe on a broadcast file and extract MXF-specific metadata.
 * Returns null (without throwing) when ffprobe is absent or fails.
 *
 * Extracted fields (all optional/null when not present):
 *   timecode, reelName, durationSec, width, height, codec, frameRate
 *
 * @param {string} filePath
 * @param {{ ffprobePath?: string, runFfprobe?: Function, timeoutMs?: number }} opts
 * @returns {Promise<BroadcastMetadata|null>}
 */
export async function probeBroadcastMetadata(filePath, {
  ffprobePath = "ffprobe",
  runFfprobe = defaultRunFfprobe,
  timeoutMs = 15_000,
} = {}) {
  if (!filePath) return null;
  try {
    const result = await runFfprobe(
      ffprobePath,
      ["-v", "quiet", "-show_streams", "-show_format", "-of", "json", filePath],
      { timeoutMs },
    );
    return parseBroadcastProbe(result?.stdout || "{}");
  } catch {
    // ffprobe absent or file unreadable — return null, never throw
    return null;
  }
}

/**
 * Parse ffprobe JSON output and extract broadcast/MXF metadata.
 *
 * @param {string|object} json
 * @returns {BroadcastMetadata}
 */
export function parseBroadcastProbe(json) {
  const data = typeof json === "string" ? safeParseJson(json) : (json || {});
  const streams = Array.isArray(data.streams) ? data.streams : [];
  const fmt = data.format || {};
  const fmtTags = { ...(fmt.tags || {}) };

  const video = streams.find((s) => s?.codec_type === "video") || {};
  const videoTags = { ...(video.tags || {}) };

  // MXF timecode lives in either format-level or video-stream tags
  const timecode = fmtTags["timecode"] || fmtTags["TIMECODE"]
    || videoTags["timecode"] || null;
  const reelName = fmtTags["reel_name"] || fmtTags["REEL_NAME"]
    || fmtTags["material_package_name"] || null;

  const durationSec = asNumber(fmt.duration) ?? asNumber(video.duration) ?? null;
  const frameRateRaw = video.r_frame_rate || video.avg_frame_rate || null;
  const frameRate = frameRateRaw ? evalFraction(frameRateRaw) : null;

  return {
    timecode,
    reelName,
    durationSec,
    width: Number(video.width) || null,
    height: Number(video.height) || null,
    codec: video.codec_name || null,
    frameRate,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeParseJson(text) {
  try { return JSON.parse(text || "{}"); } catch { return {}; }
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Evaluate a fraction string like "30000/1001" → 29.97 */
function evalFraction(str) {
  const parts = String(str).split("/");
  if (parts.length === 2) {
    const num = Number(parts[0]);
    const den = Number(parts[1]);
    if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
      return Number((num / den).toFixed(4));
    }
  }
  return asNumber(str);
}

function defaultRunFfprobe(cmd, args, { timeoutMs = 15_000 } = {}) {
  return new Promise((resolve, reject) => {
    let proc;
    try {
      proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      reject(err);
      return;
    }
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(Object.assign(new Error("ffprobe timed out"), { code: "TIMEOUT" }));
    }, timeoutMs);
    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", (err) => { clearTimeout(timer); reject(err); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(Object.assign(new Error(stderr || `ffprobe exited ${code}`), { code: "PROCESS_FAILED" }));
    });
  });
}

/**
 * @typedef {object} BroadcastMetadata
 * @property {string|null} timecode
 * @property {string|null} reelName
 * @property {number|null} durationSec
 * @property {number|null} width
 * @property {number|null} height
 * @property {string|null} codec
 * @property {number|null} frameRate
 */
