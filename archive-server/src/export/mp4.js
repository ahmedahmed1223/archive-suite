import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

import { buildFfmpegArgs, ExportError } from "./ffmpegPlan.js";

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
  const output = outFile || path.join(os.tmpdir(), `archive-export-${Date.now()}.mp4`);

  const args = buildFfmpegArgs(timeline, {
    output,
    resolveSource: (clip) => resolveUnderRoot(rootDir, clip.source || clip.itemId)
  });

  const exec = runFfmpeg || defaultRunFfmpeg;
  await exec(ffmpegPath, args, { timeoutMs });
  return { output };
}

function defaultRunFfmpeg(cmd, args, { timeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => { proc.kill("SIGKILL"); reject(new ExportError("انتهت مهلة التصدير.", { code: "TIMEOUT" })); }, timeoutMs);
    proc.stderr.on("data", (d) => { stderr += d.toString(); if (stderr.length > 8192) stderr = stderr.slice(-8192); });
    proc.on("error", (err) => { clearTimeout(timer); reject(new ExportError(`تعذّر تشغيل ffmpeg: ${err.message}`, { code: "SPAWN" })); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new ExportError(`فشل ffmpeg (رمز ${code}): ${stderr.slice(-500)}`, { code: "FFMPEG" }));
    });
  });
}

export { ExportError };
