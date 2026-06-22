import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { buildFfmpegArgs, ExportError } from "./ffmpegPlan.js";

/** Project-controlled export staging directory (not os.tmpdir()). */
function exportWorkDir() {
  if (process.env.STORAGE_DIR) {
    return path.join(process.env.STORAGE_DIR, "export-work");
  }
  const here = fileURLToPath(new URL(".", import.meta.url));
  return path.join(here, "..", "..", "var", "export-work");
}

// Runs the ffmpeg export. ffmpeg is bundled in the server Docker image
// (Dockerfile.server: apk add ffmpeg), so this works inside the SAME stack —
// no external service. The spawn is injectable so tests never touch ffmpeg.

/** Safely resolve a clip's source key to a path under the media root (no traversal). */
function resolveUnderRoot(rootDir, key) {
  const clean = String(key || "").replace(/^[/\\]+/, "");
  const root = path.resolve(rootDir);
  const target = path.resolve(root, clean);
  if (target !== root && !target.startsWith(root + path.sep)) return null; // escape attempt
  return fs.existsSync(target) ? target : null;
}

/**
 * Export a timeline to an MP4 file.
 * @param {object} timeline
 * @param {object} options
 * @param {string} options.rootDir - media root (FileStore) holding uploaded sources
 * @param {string} [options.outFile] - defaults to a temp file
 * @param {string} [options.ffmpegPath="ffmpeg"]
 * @param {(cmd,args)=>Promise<void>} [options.runFfmpeg] - injectable for tests
 * @param {number} [options.timeoutMs=600000]
 * @returns {Promise<{ output: string }>}
 */
export async function exportTimelineToMp4(timeline, {
  rootDir,
  outFile,
  ffmpegPath = "ffmpeg",
  runFfmpeg,
  timeoutMs = 10 * 60 * 1000
} = {}) {
  if (!rootDir) throw new ExportError("جذر الملفات (rootDir) مطلوب للتصدير.", { code: "NO_ROOT" });
  const workDir = exportWorkDir();
  // Ensure the directory exists; callers can pass outFile to override entirely.
  fs.mkdirSync(workDir, { recursive: true });
  const output = outFile || path.join(workDir, `archive-export-${Date.now()}.mp4`);

  const args = buildFfmpegArgs(timeline, {
    output,
    resolveSource: (clip) => resolveUnderRoot(rootDir, clip.source || clip.itemId)
  });

  const exec = runFfmpeg || defaultRunFfmpeg;
  await exec(ffmpegPath, args, { timeoutMs });
  return { output };
}

export async function checkFfmpegAvailability({
  ffmpegPath = "ffmpeg",
  runProbe = defaultProbeFfmpeg,
  timeoutMs = 1500
} = {}) {
  try {
    const result = await runProbe(ffmpegPath, ["-version"], { timeoutMs });
    const output = String(result?.stdout || result || "");
    const versionMatch = /ffmpeg version\s+([^\s]+)/i.exec(output);
    return {
      available: true,
      path: ffmpegPath,
      version: versionMatch?.[1] || "unknown"
    };
  } catch (error) {
    const missing = error?.code === "ENOENT" || /ENOENT|not found/i.test(String(error?.message || ""));
    return {
      available: false,
      path: ffmpegPath,
      code: missing ? "FFMPEG_MISSING" : "FFMPEG_PROBE_FAILED",
      error: missing ? "ffmpeg غير مثبت أو غير موجود في PATH." : String(error?.message || "تعذّر فحص ffmpeg.")
    };
  }
}

function defaultRunFfmpeg(cmd, args, { timeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      finish(reject, new ExportError("انتهت مهلة التصدير.", { code: "TIMEOUT", statusCode: 504 }));
    }, timeoutMs);
    proc.stderr.on("data", (d) => { stderr += d.toString(); if (stderr.length > 8192) stderr = stderr.slice(-8192); });
    proc.on("error", (err) => {
      if (err?.code === "ENOENT") {
        finish(reject, new ExportError("ffmpeg غير مثبت أو غير موجود في PATH. ثبّت ffmpeg على الخادم أو فعّل fallback ffmpeg.wasm من العميل.", { code: "FFMPEG_MISSING", statusCode: 503 }));
        return;
      }
      finish(reject, new ExportError(`تعذّر تشغيل ffmpeg: ${err.message}`, { code: "SPAWN", statusCode: 503 }));
    });
    proc.on("close", (code) => {
      if (code === 0) finish(resolve);
      else finish(reject, new ExportError(`فشل ffmpeg (رمز ${code}): ${stderr.slice(-500)}`, { code: "FFMPEG", statusCode: 500 }));
    });
  });
}

function defaultProbeFfmpeg(cmd, args, { timeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      finish(reject, Object.assign(new Error("انتهت مهلة فحص ffmpeg."), { code: "FFMPEG_PROBE_TIMEOUT" }));
    }, timeoutMs);
    proc.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    proc.on("error", (error) => finish(reject, error));
    proc.on("close", (code) => {
      if (code === 0) finish(resolve, { stdout, stderr });
      else finish(reject, Object.assign(new Error(stderr || `ffmpeg probe failed (${code})`), { code: "FFMPEG_PROBE_FAILED" }));
    });
  });
}

export { ExportError };
