import assert from "node:assert/strict";

import {
  DNXHR_PROFILES,
  PRORES_PROFILES,
  buildBroadcastInputArgs,
  buildDnxhrArgs,
  buildProResArgs,
  mxfInputFlags,
  parseBroadcastProbe,
  probeBroadcastMetadata,
} from "../src/media/broadcastPlan.js";
import { renderDnxhrHq, renderProRes422 } from "../src/export/broadcast.js";

let failures = 0;
function run(name, fn) {
  Promise.resolve().then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((err) => { failures += 1; console.error(`not ok - ${name}\n  ${err.stack || err.message}`); });
}

// ── ProRes profile flags ─────────────────────────────────────────────────────

run("ProRes proxy (profile 0) — args contain prores_ks + -profile:v 0", () => {
  const args = buildProResArgs("/src/clip.mov", "/out/proxy.mov", PRORES_PROFILES.proxy);
  const s = args.join(" ");
  assert.match(s, /-c:v prores_ks/);
  assert.match(s, /-profile:v 0/);
  assert.match(s, /-pix_fmt yuv422p10le/);
  assert.equal(args.at(-1), "/out/proxy.mov");
});

run("ProRes LT (profile 1) — -profile:v 1", () => {
  const args = buildProResArgs("/src/clip.mov", "/out/lt.mov", PRORES_PROFILES.lt);
  assert.match(args.join(" "), /-profile:v 1/);
});

run("ProRes standard (profile 2) — -profile:v 2", () => {
  const args = buildProResArgs("/src/clip.mov", "/out/std.mov", PRORES_PROFILES.standard);
  assert.match(args.join(" "), /-profile:v 2/);
});

run("ProRes HQ (profile 3, default) — -profile:v 3", () => {
  const args = buildProResArgs("/src/clip.mov", "/out/hq.mov", PRORES_PROFILES.hq);
  assert.match(args.join(" "), /-profile:v 3/);
});

run("ProRes — invalid profile throws", () => {
  assert.throws(() => buildProResArgs("/in.mov", "/out.mov", 9), /profile/);
});

// ── DNxHR profile flags ──────────────────────────────────────────────────────

run("DNxHR LB — -profile:v dnxhr_lb + yuv422p", () => {
  const args = buildDnxhrArgs("/src/clip.mxf", "/out/lb.mxf", DNXHR_PROFILES.lb);
  const s = args.join(" ");
  assert.match(s, /-c:v dnxhd/);
  assert.match(s, /-profile:v dnxhr_lb/);
  assert.match(s, /-pix_fmt yuv422p\b/);
});

run("DNxHR SQ — -profile:v dnxhr_sq", () => {
  const args = buildDnxhrArgs("/src/clip.mxf", "/out/sq.mxf", DNXHR_PROFILES.sq);
  assert.match(args.join(" "), /-profile:v dnxhr_sq/);
});

run("DNxHR HQ (default) — -profile:v dnxhr_hq", () => {
  const args = buildDnxhrArgs("/src/clip.mxf", "/out/hq.mxf");
  assert.match(args.join(" "), /-profile:v dnxhr_hq/);
});

run("DNxHR HQX — -profile:v dnxhr_hqx + yuv422p10le", () => {
  const args = buildDnxhrArgs("/src/clip.mxf", "/out/hqx.mxf", DNXHR_PROFILES.hqx);
  const s = args.join(" ");
  assert.match(s, /-profile:v dnxhr_hqx/);
  assert.match(s, /-pix_fmt yuv422p10le/);
});

run("DNxHR 444 — -profile:v dnxhr_444 + yuv422p10le", () => {
  const args = buildDnxhrArgs("/src/clip.mxf", "/out/444.mxf", DNXHR_PROFILES["444"]);
  const s = args.join(" ");
  assert.match(s, /-profile:v dnxhr_444/);
  assert.match(s, /-pix_fmt yuv422p10le/);
});

run("DNxHR — invalid profile throws", () => {
  assert.throws(() => buildDnxhrArgs("/in.mxf", "/out.mxf", "dnxhr_ultra"), /profile/);
});

// ── MXF demux flags ──────────────────────────────────────────────────────────

run("mxfInputFlags — inserts -f mxf for .mxf inputs", () => {
  assert.deepEqual(mxfInputFlags("/media/reel01.mxf"), ["-f", "mxf"]);
  assert.deepEqual(mxfInputFlags("/media/REEL01.MXF"), ["-f", "mxf"]);
});

run("mxfInputFlags — returns empty for non-MXF inputs", () => {
  assert.deepEqual(mxfInputFlags("/media/clip.mov"), []);
  assert.deepEqual(mxfInputFlags("/media/clip.mp4"), []);
});

run("buildBroadcastInputArgs — .mxf input includes demux flag", () => {
  const args = buildBroadcastInputArgs("/media/xdcam_reel.mxf");
  assert.deepEqual(args, ["-f", "mxf", "-i", "/media/xdcam_reel.mxf"]);
});

run("buildBroadcastInputArgs — non-mxf input omits -f flag", () => {
  const args = buildBroadcastInputArgs("/media/clip.mov");
  assert.deepEqual(args, ["-i", "/media/clip.mov"]);
});

// ── renderProRes422 / renderDnxhrHq (injected runner) ───────────────────────

run("renderProRes422 — calls runner with correct ProRes args (MXF source)", async () => {
  let captured = null;
  const { args } = await renderProRes422({
    inputPath: "/src/reel.mxf",
    outputPath: "/out/proxy.mov",
    profile: PRORES_PROFILES.proxy,
    runFfmpeg: async (_cmd, a) => { captured = a; },
  });
  assert.ok(captured, "runner was called");
  const s = captured.join(" ");
  assert.match(s, /-f mxf/);
  assert.match(s, /-c:v prores_ks/);
  assert.match(s, /-profile:v 0/);
  assert.equal(captured.at(-1), "/out/proxy.mov");
  assert.deepEqual(args, captured);
});

run("renderProRes422 — .mov input omits -f mxf", async () => {
  let captured = null;
  await renderProRes422({
    inputPath: "/src/clip.mov",
    outputPath: "/out/hq.mov",
    profile: PRORES_PROFILES.hq,
    runFfmpeg: async (_cmd, a) => { captured = a; },
  });
  assert.doesNotMatch(captured.join(" "), /-f mxf/);
  assert.match(captured.join(" "), /-profile:v 3/);
});

run("renderDnxhrHq — calls runner with correct DNxHR args", async () => {
  let captured = null;
  await renderDnxhrHq({
    inputPath: "/src/reel.mxf",
    outputPath: "/out/hq.mxf",
    profile: DNXHR_PROFILES.hq,
    runFfmpeg: async (_cmd, a) => { captured = a; },
  });
  assert.ok(captured, "runner was called");
  const s = captured.join(" ");
  assert.match(s, /-f mxf/);
  assert.match(s, /-c:v dnxhd/);
  assert.match(s, /-profile:v dnxhr_hq/);
  assert.equal(captured.at(-1), "/out/hq.mxf");
});

// ── probeBroadcastMetadata ───────────────────────────────────────────────────

run("probeBroadcastMetadata — returns null without throwing when ffprobe absent", async () => {
  const result = await probeBroadcastMetadata("/nonexistent/reel.mxf", {
    ffprobePath: "ffprobe-does-not-exist-archive-test",
    runFfprobe: async () => { throw Object.assign(new Error("ENOENT"), { code: "ENOENT" }); },
  });
  assert.strictEqual(result, null);
});

run("probeBroadcastMetadata — returns null for null/empty filePath", async () => {
  assert.strictEqual(await probeBroadcastMetadata(null), null);
  assert.strictEqual(await probeBroadcastMetadata(""), null);
});

run("parseBroadcastProbe — extracts timecode, reelName, duration, frameRate", () => {
  const probeJson = {
    format: {
      duration: "1800.0",
      tags: {
        timecode: "01:00:00:00",
        reel_name: "REEL_001",
      },
    },
    streams: [
      {
        codec_type: "video",
        width: 1920,
        height: 1080,
        codec_name: "mpeg2video",
        r_frame_rate: "25/1",
      },
    ],
  };
  const meta = parseBroadcastProbe(JSON.stringify(probeJson));
  assert.equal(meta.timecode, "01:00:00:00");
  assert.equal(meta.reelName, "REEL_001");
  assert.equal(meta.durationSec, 1800);
  assert.equal(meta.width, 1920);
  assert.equal(meta.height, 1080);
  assert.equal(meta.codec, "mpeg2video");
  assert.equal(meta.frameRate, 25);
});

run("parseBroadcastMetadata — NTSC 29.97 fraction evaluates correctly", () => {
  const probeJson = {
    format: { duration: "600.0" },
    streams: [{ codec_type: "video", r_frame_rate: "30000/1001" }],
  };
  const meta = parseBroadcastProbe(JSON.stringify(probeJson));
  assert.ok(meta.frameRate > 29.96 && meta.frameRate < 29.98, `unexpected frameRate ${meta.frameRate}`);
});

run("parseBroadcastProbe — returns null fields for minimal/empty probe", () => {
  const meta = parseBroadcastProbe("{}");
  assert.strictEqual(meta.timecode, null);
  assert.strictEqual(meta.reelName, null);
  assert.strictEqual(meta.durationSec, null);
  assert.strictEqual(meta.codec, null);
});

run("probeBroadcastMetadata — parses injected ffprobe output correctly", async () => {
  const probeOutput = {
    format: { duration: "300.5", tags: { timecode: "00:30:00:00", reel_name: "B_ROLL" } },
    streams: [{ codec_type: "video", width: 1280, height: 720, codec_name: "xdcam", r_frame_rate: "25/1" }],
  };
  const result = await probeBroadcastMetadata("/media/b_roll.mxf", {
    runFfprobe: async () => ({ stdout: JSON.stringify(probeOutput), stderr: "" }),
  });
  assert.equal(result.timecode, "00:30:00:00");
  assert.equal(result.reelName, "B_ROLL");
  assert.equal(result.durationSec, 300.5);
  assert.equal(result.width, 1280);
  assert.equal(result.codec, "xdcam");
});

process.on("beforeExit", () => {
  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  } else {
    console.log("\nAll broadcast codec tests passed.");
  }
});
