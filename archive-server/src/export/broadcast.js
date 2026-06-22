// Broadcast proxy export helpers: ProRes 422 and DNxHR HQ.
// Each function builds the ffmpeg argv and delegates to an injectable runner,
// so no real ffmpeg binary is needed in CI or unit tests.

import {
  DNXHR_PROFILES,
  PRORES_PROFILES,
  buildBroadcastInputArgs,
  buildDnxhrArgs,
  buildProResArgs,
} from "../media/broadcastPlan.js";

export { DNXHR_PROFILES, PRORES_PROFILES };

/**
 * Render a ProRes 422 proxy from any source.
 *
 * @param {object} opts
 * @param {string} opts.inputPath
 * @param {string} opts.outputPath
 * @param {0|1|2|3} [opts.profile=3]  0=proxy 1=lt 2=standard 3=hq
 * @param {string} [opts.ffmpegPath="ffmpeg"]
 * @param {Function} [opts.runFfmpeg]  injectable runner (cmd, args) => Promise<void>
 * @returns {Promise<{ args: string[] }>}
 */
export async function renderProRes422({
  inputPath,
  outputPath,
  profile = PRORES_PROFILES.hq,
  ffmpegPath = "ffmpeg",
  runFfmpeg = defaultRunFfmpeg,
} = {}) {
  // Build: demux flags (MXF if needed) + codec args
  const inputSection = buildBroadcastInputArgs(inputPath);
  const codecArgs = buildProResArgs(inputPath, outputPath, profile);

  // Merge: replace the plain "-i inputPath" from buildProResArgs with the
  // full input section that may include "-f mxf". We keep the codec/output
  // tail from buildProResArgs and prepend the correct input section.
  const iIdx = codecArgs.indexOf("-i");
  const args = [
    ...inputSection,
    ...codecArgs.slice(iIdx + 2), // everything after "-i <path>"
  ];

  await runFfmpeg(ffmpegPath, args);
  return { args };
}

/**
 * Render a DNxHR HQ proxy from any source.
 *
 * @param {object} opts
 * @param {string} opts.inputPath
 * @param {string} opts.outputPath
 * @param {"dnxhr_lb"|"dnxhr_sq"|"dnxhr_hq"|"dnxhr_hqx"|"dnxhr_444"} [opts.profile]
 * @param {string} [opts.ffmpegPath="ffmpeg"]
 * @param {Function} [opts.runFfmpeg]
 * @returns {Promise<{ args: string[] }>}
 */
export async function renderDnxhrHq({
  inputPath,
  outputPath,
  profile = DNXHR_PROFILES.hq,
  ffmpegPath = "ffmpeg",
  runFfmpeg = defaultRunFfmpeg,
} = {}) {
  const inputSection = buildBroadcastInputArgs(inputPath);
  const codecArgs = buildDnxhrArgs(inputPath, outputPath, profile);

  const iIdx = codecArgs.indexOf("-i");
  const args = [
    ...inputSection,
    ...codecArgs.slice(iIdx + 2),
  ];

  await runFfmpeg(ffmpegPath, args);
  return { args };
}

// ── Default runner (real ffmpeg, used only at runtime) ───────────────────────

import { spawn } from "node:child_process";

function defaultRunFfmpeg(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); if (stderr.length > 4096) stderr = stderr.slice(-4096); });
    proc.on("error", (err) => reject(Object.assign(new Error(`تعذّر تشغيل ${cmd}: ${err.message}`), { code: "SPAWN" })));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(Object.assign(new Error(`فشل ${cmd} (رمز ${code}): ${stderr.slice(-300)}`), { code: "FFMPEG_FAILED" }));
    });
  });
}
