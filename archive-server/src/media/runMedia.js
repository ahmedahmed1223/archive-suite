import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  buildAudioArgs,
  buildFfprobeArgs,
  buildGifPreviewArgs,
  buildThumbnailArgs,
  buildTranscodeArgs,
  parseFfprobe,
  smartThumbnailSecond
} from "./mediaPlan.js";

export class MediaError extends Error {
  constructor(message, { code, statusCode = 400 } = {}) {
    super(message);
    this.name = "MediaError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

const TYPE_CONFIG = {
  thumbnail: { prefix: "thumbnails", suffix: "poster", ext: "jpg", contentType: "image/jpeg" },
  preview: { prefix: "previews", suffix: "preview", ext: "gif", contentType: "image/gif" },
  audio: { prefix: "audio", suffix: "audio", ext: "mp3", contentType: "audio/mpeg" },
  transcode: { prefix: "derived", suffix: "web", ext: "mp4", contentType: "video/mp4" }
};

function safeBaseName(key) {
  const normalized = path.posix.normalize(String(key || "media").replace(/\\/g, "/"));
  const base = path.posix.basename(normalized).replace(/\.[^.]+$/, "") || "media";
  return base
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "media";
}

export function sanitizeMediaOutputKey(prefix, sourceKey, suffix, ext) {
  return `${prefix}/${safeBaseName(sourceKey)}-${suffix}.${ext}`;
}

/** Project-controlled media staging directory (not os.tmpdir()). */
function mediaWorkDir() {
  if (process.env.STORAGE_DIR) {
    return path.join(process.env.STORAGE_DIR, "media-work");
  }
  const here = fileURLToPath(new URL(".", import.meta.url));
  return path.join(here, "..", "..", "var", "media-work");
}

/**
 * Stream blob from the FileStore directly to a temp file on disk.
 * Uses getStream() when available; falls back to getBlob() without
 * loading the entire payload into a single Buffer.
 */
async function writeBlobToFile(fileStore, key, destPath) {
  // Prefer streaming adapter
  if (typeof fileStore.getStream === "function") {
    const readable = await fileStore.getStream(key);
    if (readable) {
      await pipeline(readable, createWriteStream(destPath));
      return;
    }
  }

  // Fallback: getBlob returns Buffer / Uint8Array / Web Blob / string
  const blob = await fileStore.getBlob(key);
  if (!blob) return null; // signal "not found" to caller

  if (Buffer.isBuffer(blob) || blob instanceof Uint8Array) {
    // Write through a stream so we don't retain a second copy
    await pipeline(
      (async function* () { yield blob; })(),
      createWriteStream(destPath)
    );
  } else if (blob && typeof blob.stream === "function") {
    // Web Blob with streaming support
    const { Readable } = await import("node:stream");
    await pipeline(Readable.fromWeb(blob.stream()), createWriteStream(destPath));
  } else if (blob && typeof blob.arrayBuffer === "function") {
    const buf = Buffer.from(await blob.arrayBuffer());
    await pipeline(
      (async function* () { yield buf; })(),
      createWriteStream(destPath)
    );
  } else if (typeof blob === "string") {
    await pipeline(
      (async function* () { yield Buffer.from(blob); })(),
      createWriteStream(destPath)
    );
  }
  return true;
}

async function withTempFileFromStore(fileStore, key, fn) {
  if (!key) throw new MediaError("مفتاح الملف مطلوب.", { code: "NO_KEY" });
  if (typeof fileStore?.getBlob !== "function" && typeof fileStore?.getStream !== "function") {
    throw new MediaError("مخزن الملفات لا يدعم قراءة الملفات.", { code: "FILESTORE_UNSUPPORTED", statusCode: 501 });
  }

  const base = mediaWorkDir();
  // Use a unique subdirectory per job so concurrent jobs don't collide
  const { randomUUID } = await import("node:crypto");
  const dir = path.join(base, `archive-media-${randomUUID()}`);
  await mkdir(dir, { recursive: true });

  const ext = path.extname(path.posix.basename(String(key).replace(/\\/g, "/"))) || ".bin";
  const src = path.join(dir, `source${ext}`);

  try {
    const found = await writeBlobToFile(fileStore, key, src);
    if (found === null) {
      throw new MediaError("الملف غير موجود في مخزن الملفات. ارفع الملف أولاً.", { code: "SOURCE_MISSING", statusCode: 404 });
    }
    return await fn(src, dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function runMediaProbe({
  key,
  fileStore,
  ffprobePath = "ffprobe",
  runFfprobe = defaultRunProcess,
  timeoutMs = 30_000
} = {}) {
  return withTempFileFromStore(fileStore, key, async (src) => {
    const result = await runFfprobe(ffprobePath, buildFfprobeArgs(src), { timeoutMs });
    try {
      return parseFfprobe(result?.stdout || "{}");
    } catch (error) {
      throw new MediaError(`تعذّر تحليل ffprobe: ${error.message}`, { code: "FFPROBE_PARSE", statusCode: 500 });
    }
  });
}

function argsFor(type, src, params, out, metadata) {
  if (type === "thumbnail") {
    return buildThumbnailArgs(src, {
      ...params,
      atSec: params.atSec ?? smartThumbnailSecond(metadata),
      out
    });
  }
  if (type === "preview") return buildGifPreviewArgs(src, { ...params, out });
  if (type === "audio") return buildAudioArgs(src, { ...params, out });
  if (type === "transcode") return buildTranscodeArgs(src, { ...params, out });
  throw new MediaError("نوع عملية الوسائط غير مدعوم.", { code: "BAD_TYPE" });
}

export async function runMediaDerivative({
  type,
  key,
  params = {},
  fileStore,
  ffmpegPath = "ffmpeg",
  ffprobePath = "ffprobe",
  runFfmpeg = defaultRunProcess,
  runFfprobe = defaultRunProcess,
  timeoutMs,
  onProgress
} = {}) {
  const config = TYPE_CONFIG[type];
  if (!config) throw new MediaError("نوع عملية الوسائط غير مدعوم.", { code: "BAD_TYPE" });
  const ext = type === "audio" && String(params.format || "").toLowerCase() === "m4a" ? "m4a" : config.ext;
  const contentType = ext === "m4a" ? "audio/mp4" : config.contentType;
  const outputKey = params.outputKey || sanitizeMediaOutputKey(config.prefix, key, config.suffix, ext);

  return withTempFileFromStore(fileStore, key, async (src, dir) => {
    let metadata = null;
    if (type === "thumbnail" && params.atSec === undefined) {
      try {
        const probe = await runFfprobe(ffprobePath, buildFfprobeArgs(src), { timeoutMs: 30_000 });
        metadata = parseFfprobe(probe?.stdout || "{}");
      } catch {
        metadata = null;
      }
    }
    const out = path.join(dir, `out.${ext}`);
    const args = argsFor(type, src, params, out, metadata);
    await runFfmpeg(ffmpegPath, args, { timeoutMs: timeoutMs || defaultTimeoutFor(type), onProgress });

    if (typeof fileStore?.putBlob !== "function") {
      throw new MediaError("مخزن الملفات لا يدعم كتابة النواتج.", { code: "FILESTORE_UNSUPPORTED", statusCode: 501 });
    }

    let result;
    if (typeof fileStore.putStream === "function") {
      // Stream the ffmpeg output file directly to the store — no readFile buffer
      result = await fileStore.putStream(outputKey, createReadStream(out), { contentType });
    } else {
      // Fallback: read into memory (adapter doesn't support streaming)
      const bytes = await readFile(out);
      result = await fileStore.putBlob(outputKey, bytes, { contentType });
    }
    const url = typeof fileStore.getUrl === "function" ? await fileStore.getUrl(outputKey) : result?.url;
    return { outputKey, url: url || result?.url || null, contentType };
  });
}

function defaultTimeoutFor(type) {
  if (type === "transcode") return 30 * 60 * 1000;
  if (type === "audio") return 5 * 60 * 1000;
  return 90_000;
}

export function defaultRunProcess(cmd, args, { timeoutMs = 120_000, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new MediaError("انتهت مهلة عملية الوسائط.", { code: "TIMEOUT", statusCode: 504 }));
    }, timeoutMs);
    proc.stdout.on("data", (d) => {
      stdout += d.toString();
      if (stdout.length > 1024 * 1024) stdout = stdout.slice(-1024 * 1024);
    });
    proc.stderr.on("data", (d) => {
      const text = d.toString();
      stderr += text;
      if (stderr.length > 8192) stderr = stderr.slice(-8192);
      if (typeof onProgress === "function") onProgress(text);
    });
    proc.on("error", (error) => {
      clearTimeout(timer);
      reject(new MediaError(`تعذّر تشغيل ${cmd}: ${error.message}`, { code: "SPAWN", statusCode: 500 }));
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new MediaError(`فشل ${cmd} (رمز ${code}): ${stderr.slice(-500)}`, { code: "PROCESS_FAILED", statusCode: 500 }));
    });
  });
}
