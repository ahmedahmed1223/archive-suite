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

export function buildProResArgs(inputPath: string, outputPath: string, profile: 0 | 1 | 2 | 3 = PRORES_PROFILES.hq): string[] {
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

export function buildDnxhrArgs(inputPath: string, outputPath: string, profile: "dnxhr_lb" | "dnxhr_sq" | "dnxhr_hq" | "dnxhr_hqx" | "dnxhr_444" = DNXHR_PROFILES.hq): string[] {
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

export function mxfInputFlags(inputPath: string): string[] {
  if (String(inputPath || "").toLowerCase().endsWith(".mxf")) {
    return ["-f", "mxf"];
  }
  return [];
}

export function buildBroadcastInputArgs(inputPath: string): string[] {
  if (!inputPath) throw new Error("inputPath مطلوب.");
  return [...mxfInputFlags(inputPath), "-i", inputPath];
}

// ── probeBroadcastMetadata ───────────────────────────────────────────────────

export async function probeBroadcastMetadata(filePath: string, {
  ffprobePath = "ffprobe",
  runFfprobe = defaultRunFfprobe,
  timeoutMs = 15_000,
}: {
  ffprobePath?: string;
  runFfprobe?: (cmd: string, args: string[], opts: { timeoutMs?: number }) => Promise<{ stdout: string; stderr: string }>;
  timeoutMs?: number;
} = {}): Promise<BroadcastMetadata | null> {
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

export function parseBroadcastProbe(json: string | Record<string, unknown>): BroadcastMetadata {
  const data = typeof json === "string" ? safeParseJson(json) : (json || {}) as Record<string, unknown>;
  const streams = Array.isArray(data.streams) ? data.streams : [];
  const fmt = (data.format as Record<string, unknown>) || {};
  const fmtTags = { ...((fmt.tags as Record<string, unknown>) || {}) };

  const video = (streams.find((s: unknown) => (s as Record<string, unknown>)?.codec_type === "video") || {}) as Record<string, unknown>;
  const videoTags = { ...((video.tags as Record<string, unknown>) || {}) };

  // MXF timecode lives in either format-level or video-stream tags
  const timecode = (fmtTags["timecode"] || fmtTags["TIMECODE"]
    || videoTags["timecode"] || null) as string | null;
  const reelName = (fmtTags["reel_name"] || fmtTags["REEL_NAME"]
    || fmtTags["material_package_name"] || null) as string | null;

  const durationSec = asNumber(fmt.duration) ?? asNumber(video.duration) ?? null;
  const frameRateRaw = (video.r_frame_rate || video.avg_frame_rate || null) as string | null;
  const frameRate = frameRateRaw ? evalFraction(frameRateRaw) : null;

  return {
    timecode,
    reelName,
    durationSec,
    width: Number(video.width) || null,
    height: Number(video.height) || null,
    codec: (video.codec_name || null) as string | null,
    frameRate,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeParseJson(text: string): Record<string, unknown> {
  try { return JSON.parse(text || "{}"); } catch { return {}; }
}

function asNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function evalFraction(str: string): number | null {
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

function defaultRunFfprobe(cmd: string, args: string[], { timeoutMs = 15_000 } = {}): Promise<{ stdout: string; stderr: string }> {
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
    proc.stdout!.on("data", (d) => { stdout += d.toString(); });
    proc.stderr!.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", (err) => { clearTimeout(timer); reject(err); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(Object.assign(new Error(stderr || `ffprobe exited ${code}`), { code: "PROCESS_FAILED" }));
    });
  });
}

export interface BroadcastMetadata {
  timecode: string | null;
  reelName: string | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  codec: string | null;
  frameRate: number | null;
}
