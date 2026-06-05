import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildFfmpegArgs, ExportError } from "../src/export/ffmpegPlan.js";
import { exportTimelineToMp4 } from "../src/export/mp4.js";
import { createApiServer } from "../src/api/server.js";
import { signJwt } from "../src/auth/jwt.js";

// MP4 export tests — pure ffmpeg arg builder + the runner (with an injected
// fake ffmpeg, no real binary) + the HTTP endpoint. ffmpeg itself is exercised
// only inside the Docker image at runtime.

let failures = 0;
function run(name, fn) {
  Promise.resolve().then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((err) => { failures += 1; console.error(`not ok - ${name}\n  ${err.message}`); });
}

const timeline = {
  project: { id: "p1", name: "مشروع" },
  clips: [
    { id: "c1", itemId: "v1", source: "a.mp4", sourceIn: 0, sourceOut: 10, timelineStart: 0, duration: 10 },
    { id: "c2", itemId: "v2", source: "b.mp4", sourceIn: 5, sourceOut: 20, timelineStart: 10, duration: 15 }
  ]
};

run("buildFfmpegArgs — trims each input + concat filter + encode", () => {
  const args = buildFfmpegArgs(timeline, { resolveSource: (c) => `/media/${c.source}`, output: "/out.mp4" });
  const s = args.join(" ");
  assert.match(s, /-ss 0 -to 10 -i \/media\/a\.mp4/);
  assert.match(s, /-ss 5 -to 20 -i \/media\/b\.mp4/);
  assert.match(s, /\[0:v:0\]\[0:a:0\]\[1:v:0\]\[1:a:0\]concat=n=2:v=1:a=1\[v\]\[a\]/);
  assert.match(s, /-map \[v\] -map \[a\]/);
  assert.match(s, /libx264/);
  assert.equal(args[args.length - 1], "/out.mp4");
});

run("buildFfmpegArgs — withAudio:false drops audio mapping", () => {
  const args = buildFfmpegArgs(timeline, { resolveSource: () => "/x.mp4", output: "/o.mp4", withAudio: false });
  const s = args.join(" ");
  assert.match(s, /concat=n=2:v=1:a=0\[v\]/);
  assert.doesNotMatch(s, /\[a\]/);
});

run("buildFfmpegArgs — guards empty timeline + missing source", () => {
  assert.throws(() => buildFfmpegArgs({ clips: [] }, { resolveSource: () => "x", output: "o" }), /قابلة للتصدير/);
  assert.throws(() => buildFfmpegArgs(timeline, { resolveSource: () => null, output: "o" }), /المصدر/);
});

run("exportTimelineToMp4 — resolves under root + runs (injected) ffmpeg", async () => {
  // Set up a temp media root with the two source files present.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "media-"));
  fs.writeFileSync(path.join(root, "a.mp4"), "x");
  fs.writeFileSync(path.join(root, "b.mp4"), "x");
  let ranArgs = null;
  const result = await exportTimelineToMp4(timeline, {
    rootDir: root,
    outFile: path.join(root, "out.mp4"),
    runFfmpeg: async (cmd, args) => { ranArgs = args; fs.writeFileSync(path.join(root, "out.mp4"), "MP4"); }
  });
  assert.ok(ranArgs.join(" ").includes(path.join(root, "a.mp4")));
  assert.equal(result.output, path.join(root, "out.mp4"));
  fs.rmSync(root, { recursive: true, force: true });
});

run("exportTimelineToMp4 — missing source under root throws SOURCE_MISSING", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "media-"));
  await assert.rejects(
    () => exportTimelineToMp4(timeline, { rootDir: root, runFfmpeg: async () => {} }),
    (e) => { assert.ok(e instanceof ExportError); return true; }
  );
  fs.rmSync(root, { recursive: true, force: true });
});

run("HTTP: /api/projects/export streams MP4 (auth + injected exporter)", async () => {
  const SECRET = "exp";
  const server = createApiServer({
    backend: "test", authSecret: SECRET, rateLimit: null,
    runExport: async (_tl, { }) => {
      const out = path.join(os.tmpdir(), `t-${Date.now()}.mp4`);
      fs.writeFileSync(out, "FAKEMP4DATA");
      return { output: out };
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const noAuth = await fetch(`${base}/api/projects/export`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timeline }) });
    assert.equal(noAuth.status, 401);

    const token = signJwt({ sub: "u1", role: "editor" }, SECRET);
    const res = await fetch(`${base}/api/projects/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ timeline })
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") || "", /video\/mp4/);
    const buf = Buffer.from(await res.arrayBuffer());
    assert.equal(buf.toString(), "FAKEMP4DATA");

    // empty timeline → 400
    const bad = await fetch(`${base}/api/projects/export`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ timeline: { clips: [] } })
    });
    assert.equal(bad.status, 400);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

process.on("beforeExit", () => {
  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  else console.log("\nAll export tests passed.");
});
