import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildAudioArgs,
  buildFfprobeArgs,
  buildGifPreviewArgs,
  buildThumbnailArgs,
  buildTranscodeArgs,
  parseFfprobe,
  smartThumbnailSecond
} from "../src/media/mediaPlan.js";
import {
  createInMemoryMediaJobStore,
  createMediaJobWorker,
  parseFfmpegProgress
} from "../src/media/mediaJobs.js";
import {
  MediaError,
  runMediaDerivative,
  runMediaProbe,
  sanitizeMediaOutputKey
} from "../src/media/runMedia.js";
import { createApiServer } from "../src/api/server.js";
import { signJwt } from "../src/auth/jwt.js";

let failures = 0;
function run(name, fn) {
  Promise.resolve().then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((err) => {
      failures += 1;
      console.error(`not ok - ${name}\n  ${err.stack || err.message}`);
    });
}

function createMemoryFileStore(initial = {}) {
  const blobs = new Map(Object.entries(initial).map(([key, value]) => [key, Buffer.from(value)]));
  return {
    async putBlob(key, blob, options = {}) {
      blobs.set(key, Buffer.isBuffer(blob) ? blob : Buffer.from(blob));
      return { key, contentType: options.contentType || "" };
    },
    async getBlob(key) {
      return blobs.has(key) ? Buffer.from(blobs.get(key)) : null;
    },
    async getUrl(key) {
      return blobs.has(key) ? `/api/files/${encodeURIComponent(key)}` : null;
    },
    async remove(key) {
      blobs.delete(key);
    },
    async list(prefix = "") {
      return [...blobs.keys()].filter((key) => key.startsWith(prefix));
    },
    _blobs: blobs
  };
}

const probeJson = {
  format: { duration: "123.456", bit_rate: "800000" },
  streams: [
    { codec_type: "video", width: 1920, height: 1080, codec_name: "h264", duration: "120.0" },
    { codec_type: "audio", codec_name: "aac" }
  ]
};

run("mediaPlan — builds safe argv for probe and derivatives", () => {
  assert.deepEqual(buildFfprobeArgs("/in.mp4"), [
    "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", "/in.mp4"
  ]);

  assert.deepEqual(buildThumbnailArgs("/in.mp4", { atSec: 12, width: 480, out: "/out.jpg" }), [
    "-ss", "12", "-i", "/in.mp4", "-frames:v", "1",
    "-vf", "thumbnail,scale=480:-2", "-q:v", "3", "-y", "/out.jpg"
  ]);

  assert.deepEqual(buildGifPreviewArgs("/in.mp4", { startSec: 2, durationSec: 4, width: 320, fps: 12, out: "/out.gif" }), [
    "-ss", "2", "-t", "4", "-i", "/in.mp4",
    "-vf", "fps=12,scale=320:-1:flags=lanczos", "-loop", "0", "-y", "/out.gif"
  ]);

  assert.deepEqual(buildAudioArgs("/in.mp4", { format: "mp3", bitrate: "160k", out: "/out.mp3" }), [
    "-i", "/in.mp4", "-vn", "-c:a", "libmp3lame", "-b:a", "160k", "-y", "/out.mp3"
  ]);

  const transcode = buildTranscodeArgs("/in.mp4", { height: 720, codec: "libx264", crf: 23, out: "/out.mp4" });
  assert.match(transcode.join(" "), /-vf scale=-2:720/);
  assert.match(transcode.join(" "), /-movflags \+faststart/);
  assert.equal(transcode.at(-1), "/out.mp4");
});

run("mediaPlan — parses ffprobe and picks a smart thumbnail time", () => {
  assert.deepEqual(parseFfprobe(JSON.stringify(probeJson)), {
    durationSec: 123.456,
    width: 1920,
    height: 1080,
    codec: "h264",
    bitrate: 800000,
    hasAudio: true
  });
  assert.equal(smartThumbnailSecond({ durationSec: 123.456 }), 12.346);
  assert.equal(smartThumbnailSecond({ durationSec: 4 }), 1);
});

run("runMedia — probes a FileStore source through an injected ffprobe", async () => {
  const files = createMemoryFileStore({ "uploads/a.mp4": "video" });
  const calls = [];
  const result = await runMediaProbe({
    key: "uploads/a.mp4",
    fileStore: files,
    runFfprobe: async (cmd, args) => {
      calls.push({ cmd, args });
      assert.equal(cmd, "ffprobe");
      assert.ok(fs.existsSync(args.at(-1)));
      return { stdout: JSON.stringify(probeJson), stderr: "" };
    }
  });
  assert.equal(calls.length, 1);
  assert.equal(result.width, 1920);
});

run("runMedia — creates thumbnail output in FileStore and sanitizes output keys", async () => {
  const files = createMemoryFileStore({ "uploads/folder/../clip one.mp4": "video" });
  assert.equal(sanitizeMediaOutputKey("thumbnails", "uploads/../clip one.mp4", "poster", "jpg"), "thumbnails/clip-one-poster.jpg");
  const result = await runMediaDerivative({
    type: "thumbnail",
    key: "uploads/folder/../clip one.mp4",
    fileStore: files,
    runFfprobe: async () => ({ stdout: JSON.stringify(probeJson), stderr: "" }),
    runFfmpeg: async (_cmd, args) => {
      const out = args.at(-1);
      fs.writeFileSync(out, "JPG");
      return { stdout: "", stderr: "" };
    }
  });
  assert.equal(result.outputKey, "thumbnails/clip-one-poster.jpg");
  assert.equal(files._blobs.get(result.outputKey).toString(), "JPG");
});

run("runMedia — missing source is a typed MediaError", async () => {
  const files = createMemoryFileStore();
  await assert.rejects(
    () => runMediaProbe({ key: "missing.mp4", fileStore: files, runFfprobe: async () => ({ stdout: "{}", stderr: "" }) }),
    (error) => {
      assert.ok(error instanceof MediaError);
      assert.equal(error.code, "SOURCE_MISSING");
      return true;
    }
  );
});

run("mediaJobs — transitions queued jobs through worker and progress parsing", async () => {
  assert.equal(parseFfmpegProgress("frame=1 time=00:00:05.00 bitrate=1", 10), 50);
  const store = createInMemoryMediaJobStore({ now: () => 1000, idFactory: () => "job-1" });
  const events = [];
  const worker = createMediaJobWorker({
    store,
    fileStore: createMemoryFileStore({ "uploads/a.mp4": "video" }),
    eventBus: { publish: (payload) => events.push(payload) },
    runDerivative: async ({ job, onProgress }) => {
      onProgress(55);
      return { outputKey: `derived/${job.id}.mp4`, url: "/file" };
    }
  });
  const job = store.create({ type: "transcode", sourceKey: "uploads/a.mp4", params: {}, requestedBy: "u1" });
  await worker.pump();
  const done = store.get(job.id);
  assert.equal(done.status, "done");
  assert.equal(done.progress, 100);
  assert.equal(done.outputKey, "derived/job-1.mp4");
  assert.equal(events.at(-1).type, "media.job.done");
});

run("HTTP: media endpoints and jobs are editor-gated", async () => {
  const SECRET = "media";
  const jobs = createInMemoryMediaJobStore({ idFactory: () => "job-http" });
  const server = createApiServer({
    backend: "test",
    authSecret: SECRET,
    rateLimit: null,
    resolveFileStore: () => createMemoryFileStore({ "uploads/a.mp4": "video" }),
    mediaJobStore: jobs,
    mediaWorker: { pump: async () => {} },
    runMediaProbeImpl: async () => ({ durationSec: 3, width: 100, height: 50, codec: "h264", bitrate: 1, hasAudio: true }),
    runMediaDerivativeImpl: async ({ type }) => ({ outputKey: `${type}/out`, url: "/file" })
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const viewer = signJwt({ sub: "u2", role: "viewer" }, SECRET);
    const editor = signJwt({ sub: "u1", role: "editor" }, SECRET);
    const denied = await fetch(`${base}/api/media/probe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${viewer}` },
      body: JSON.stringify({ key: "uploads/a.mp4" })
    });
    assert.equal(denied.status, 403);

    const probe = await fetch(`${base}/api/media/probe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${editor}` },
      body: JSON.stringify({ key: "uploads/a.mp4" })
    });
    assert.equal(probe.status, 200);
    assert.equal((await probe.json()).result.width, 100);

    const thumb = await fetch(`${base}/api/media/thumbnail`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${editor}` },
      body: JSON.stringify({ key: "uploads/a.mp4", width: 480 })
    });
    assert.equal((await thumb.json()).result.outputKey, "thumbnail/out");

    const created = await fetch(`${base}/api/media/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${editor}` },
      body: JSON.stringify({ type: "transcode", key: "uploads/a.mp4", height: 720 })
    });
    assert.equal(created.status, 200);
    assert.equal((await created.json()).result.jobId, "job-http");

    const listed = await fetch(`${base}/api/media/jobs`, {
      headers: { Authorization: `Bearer ${editor}` }
    });
    assert.equal((await listed.json()).result[0].id, "job-http");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

process.on("beforeExit", () => {
  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  } else {
    console.log("\nAll media tests passed.");
  }
});
