import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { read as XLSXRead, utils as XLSXUtils } from "xlsx";

import { buildFfmpegArgs, ExportError } from "../src/export/ffmpegPlan.js";
import { exportTimelineToMp4 } from "../src/export/mp4.js";
import { exportRecords } from "../src/export/exportService.js";
import { recordToBibtex, recordToRis, makeCiteKey } from "../src/export/citationExport.js";
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

// ── Citation export (§20.4) ──────────────────────────────────────────────────

const citationRecord = {
  id: "rec_42",
  data: {
    title: "تاريخ الأرشيف الرقمي",
    type: "document",
    author: "أحمد",
    tags: ["أرشفة", "بحث"],
    project: "مشروع التوثيق",
    summary: "ملخص قصير.",
    fileUrl: "https://archive.example/rec_42",
    createdAt: "2026-03-15T10:00:00.000Z",
  },
};

run("recordToBibtex — entry type, cite key, escaped fields, year from createdAt", () => {
  const bib = recordToBibtex(citationRecord);
  assert.match(bib, /^@misc\{/);
  assert.match(bib, /title = \{تاريخ الأرشيف الرقمي\}/);
  assert.match(bib, /author = \{أحمد\}/);
  assert.match(bib, /year = \{2026\}/);
  assert.match(bib, /keywords = \{أرشفة, بحث\}/);
  assert.match(bib, /url = \{https:\/\/archive\.example\/rec_42\}/);
  assert.match(bib, /note = \{Archive ID: rec_42\}/);
});

run("recordToBibtex — escapes BibTeX special characters", () => {
  const bib = recordToBibtex({ id: "x", data: { title: "A & B {100%}", createdAt: "2025" } });
  assert.match(bib, /A \\& B \\\{100\\%\\\}/);
});

run("makeCiteKey — ASCII-safe, stable from title+year+id", () => {
  const key = makeCiteKey({ title: "تاريخ", year: "2026", id: "rec_42" });
  assert.match(key, /2026/);
  assert.match(key, /rec42$/);
  assert.doesNotMatch(key, /\s/);
});

run("recordToRis — TY/TI/AU/PY/KW/UR/ER lines", () => {
  const ris = recordToRis(citationRecord);
  assert.match(ris, /^TY {2}- GEN/m);
  assert.match(ris, /TI {2}- تاريخ الأرشيف الرقمي/);
  assert.match(ris, /AU {2}- أحمد/);
  assert.match(ris, /PY {2}- 2026/);
  assert.match(ris, /KW {2}- أرشفة/);
  assert.match(ris, /KW {2}- بحث/);
  assert.match(ris, /UR {2}- https:\/\/archive\.example\/rec_42/);
  assert.match(ris, /ER {2}- $/m);
});

run("exportRecords — bibtex/ris formats produce the right content type + filename", async () => {
  const provider = { async getAll() { return [citationRecord]; } };
  const bib = await exportRecords(provider, { format: "bibtex", store: "video_items" });
  assert.match(bib.contentType, /x-bibtex/);
  assert.match(bib.filename, /\.bib$/);
  assert.match(bib.buffer.toString("utf-8"), /@misc\{/);

  const ris = await exportRecords(provider, { format: "ris", store: "video_items" });
  assert.match(ris.contentType, /x-research-info-systems/);
  assert.match(ris.filename, /\.ris$/);
  assert.match(ris.buffer.toString("utf-8"), /TY {2}- GEN/);
});

run("exportRecords — bibtex skips soft-deleted records", async () => {
  const provider = {
    async getAll() {
      return [citationRecord, { id: "del", data: { title: "محذوف", isDeleted: true, createdAt: "2025" } }];
    },
  };
  const bib = await exportRecords(provider, { format: "bibtex", store: "video_items" });
  const text = bib.buffer.toString("utf-8");
  assert.match(text, /تاريخ الأرشيف الرقمي/);
  assert.doesNotMatch(text, /محذوف/);
});

run("exportRecords — pdf produces a readable branded report", async () => {
  const provider = { async getAll() { return [citationRecord]; } };
  const pdf = await exportRecords(provider, { format: "pdf", store: "video_items" });
  assert.equal(pdf.contentType, "application/pdf");
  assert.match(pdf.filename, /\.pdf$/);
  assert.equal(pdf.buffer.subarray(0, 5).toString("utf8"), "%PDF-");
  const doc = await PDFDocument.load(pdf.buffer);
  assert.ok(doc.getPageCount() >= 1);
});

run("exportRecords — xlsx-template includes data, instructions, and template settings", async () => {
  const provider = { async getAll() { return [citationRecord]; } };
  const xlsx = await exportRecords(provider, { format: "xlsx-template", store: "video_items" });
  assert.match(xlsx.contentType, /spreadsheetml/);
  assert.match(xlsx.filename, /template.*\.xlsx$/);
  const workbook = XLSXRead(xlsx.buffer, { type: "buffer" });
  assert.deepEqual(workbook.SheetNames, ["بيانات الأرشيف", "تعليمات", "إعدادات القالب"]);
  const dataRows = XLSXUtils.sheet_to_json(workbook.Sheets["بيانات الأرشيف"], { header: 1 });
  assert.equal(dataRows[0][1], "العنوان");
});

run("HTTP: /api/export streams pdf and xlsx-template behind auth", async () => {
  const SECRET = "export-api";
  const storage = { async getAll() { return [citationRecord]; } };
  const server = createApiServer({ backend: "test", authSecret: SECRET, resolveStorage: () => storage, rateLimit: null });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = signJwt({ sub: "u1", role: "editor" }, SECRET);
  try {
    const noAuth = await fetch(`${base}/api/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "pdf" }),
    });
    assert.equal(noAuth.status, 401);

    const pdf = await fetch(`${base}/api/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ format: "pdf" }),
    });
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get("content-type"), "application/pdf");
    assert.match(pdf.headers.get("content-disposition") || "", /archive-report-.*\.pdf/);

    const template = await fetch(`${base}/api/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ format: "xlsx-template" }),
    });
    assert.equal(template.status, 200);
    assert.match(template.headers.get("content-type") || "", /spreadsheetml/);
    assert.match(template.headers.get("content-disposition") || "", /archive-template-.*\.xlsx/);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

process.on("beforeExit", () => {
  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  else console.log("\nAll export tests passed.");
});
