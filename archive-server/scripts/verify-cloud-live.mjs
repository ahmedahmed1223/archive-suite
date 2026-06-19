// Live cloud-stack smoke test.
// Requires the Docker compose stack to be running locally. It exercises the
// real HTTP API, frontend proxy, Postgres/pgvector, Redis, pgAdmin,
// file store volume, ffmpeg, Whisper, and OCR.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const BASE = process.env.BASE || "http://127.0.0.1:8787";
const FRONTEND_BASE = process.env.FRONTEND_BASE || "http://127.0.0.1:8080";
const PGADMIN_BASE = process.env.PGADMIN_BASE || "http://127.0.0.1:5050";
const TEST_ID = `cloud_live_${Date.now()}`;
const TMP = path.join(os.tmpdir(), TEST_ID);
mkdirSync(TMP, { recursive: true });

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    })
);

const checks = [];
function ok(name, detail = "") {
  checks.push({ name, ok: true, detail });
  console.log(`ok - ${name}${detail ? ` (${detail})` : ""}`);
}
function fail(name, error) {
  checks.push({ name, ok: false, detail: error?.message || String(error) });
  console.error(`not ok - ${name}\n  ${error?.stack || error}`);
}
async function run(name, fn) {
  try {
    const detail = await fn();
    ok(name, detail);
  } catch (error) {
    fail(name, error);
  }
}

async function json(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid JSON (${res.status}): ${text.slice(0, 200)}`);
  }
}

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD })
  });
  const body = await json(res);
  if (!res.ok || !body.token) throw new Error(body.error || `login failed (${res.status})`);
  return body.token;
}

let token = "";
let lastHealth = null;
const uploadedKeys = [];

function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

async function rpc(method, args) {
  const res = await fetch(`${BASE}/api/rpc`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ method, args })
  });
  const body = await json(res);
  if (!res.ok || !body.ok) throw new Error(body.error || `${method} failed (${res.status})`);
  return body.result;
}

async function putFile(key, bytes, contentType) {
  const res = await fetch(`${BASE}/api/files/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": contentType }),
    body: bytes
  });
  const body = await json(res);
  if (!res.ok || !body.ok) throw new Error(body.error || `upload failed (${res.status})`);
  uploadedKeys.push(key);
  return body.result;
}

async function getFile(key) {
  const res = await fetch(`${BASE}/api/files/${encodeURIComponent(key)}`, {
    headers: authHeaders()
  });
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function cleanup() {
  for (const key of uploadedKeys.reverse()) {
    try {
      await fetch(`${BASE}/api/files/${encodeURIComponent(key)}`, {
        method: "DELETE",
        headers: authHeaders()
      });
    } catch {
      // Best-effort cleanup.
    }
  }
  rmSync(TMP, { recursive: true, force: true });
}

await run("login and health", async () => {
  token = await login();
  const health = await fetch(`${BASE}/api/health`).then(json);
  lastHealth = health;
  if (!health.ok && health.status !== "ok") throw new Error("health response was not ok");
  const ffmpeg = health.export?.mp4?.serverFfmpeg;
  if (!ffmpeg?.available) throw new Error("ffmpeg capability is not available in health");
  return `ffmpeg ${ffmpeg.version || "available"}`;
});

await run("frontend cloud same-origin API proxy", async () => {
  const page = await fetch(FRONTEND_BASE);
  if (!page.ok) throw new Error(`frontend failed (${page.status})`);
  const html = await page.text();
  if (!/Archive|الأرشيف|root/i.test(html)) throw new Error("frontend did not return the app shell");
  const health = await fetch(`${FRONTEND_BASE}/api/health`).then(json);
  if (!health.ok || health.backend !== "postgres") {
    throw new Error(`frontend /api/health is not Postgres-backed: ${JSON.stringify(health).slice(0, 200)}`);
  }
  return `backend=${health.backend}`;
});

await run("Redis service responds with PONG", async () => {
  const redis = lastHealth?.redis;
  if (!redis?.configured) throw new Error("Redis is not configured in server health");
  if (!redis?.ok) throw new Error(`Redis health is not ok: ${JSON.stringify(redis)}`);
  return `${redis.cache}, mediaJobs=${redis.mediaJobs}`;
});

await run("pgvector extension is installed in Postgres", async () => {
  const pgvector = lastHealth?.pgvector;
  if (!pgvector?.ok) throw new Error(`pgvector health is not ok: ${JSON.stringify(pgvector)}`);
  return `vector ${pgvector.version}`;
});

await run("pgAdmin login page is reachable with default server seed", async () => {
  const res = await fetch(PGADMIN_BASE);
  const text = await res.text();
  if (!res.ok || !/pgAdmin/i.test(text)) throw new Error(`pgAdmin failed (${res.status})`);
  const seed = readFileSync(new URL("../deploy/pgadmin-servers.json", import.meta.url), "utf8");
  if (!seed.includes("Archive Postgres") || !seed.includes("\"Host\": \"postgres\"") || !seed.includes("\"Username\": \"archive\"")) {
    throw new Error("pgAdmin default server seed does not point at bundled Postgres");
  }
  return "Archive Postgres seeded";
});

await run("SQL persistence via cloud RPC", async () => {
  const id = TEST_ID;
  await rpc("add", ["video_items", { id, title: "Cloud live SQL test", type: "video", tags: ["cloud-live"] }]);
  const stored = await rpc("get", ["video_items", id]);
  if (stored?.id !== id || stored?.title !== "Cloud live SQL test") throw new Error("RPC read did not return the inserted SQL-backed row");
  await rpc("delete", ["video_items", id]);
  const gone = await rpc("get", ["video_items", id]);
  if (gone) throw new Error("RPC delete did not remove the SQL-backed row");
  return "add/get/delete round-trip";
});

await run("file upload, list, download, and delete path", async () => {
  const key = `live-tests/${TEST_ID}.txt`;
  const bytes = Buffer.from("archive cloud upload check\n", "utf8");
  await putFile(key, bytes, "text/plain");
  const listed = await fetch(`${BASE}/api/files?prefix=${encodeURIComponent("live-tests/")}`, {
    headers: authHeaders()
  }).then(json);
  if (!listed.result?.includes(key)) throw new Error("uploaded key was not visible in /api/files list");
  const downloaded = await getFile(key);
  if (!downloaded.equals(bytes)) throw new Error("downloaded bytes do not match upload");
  return `${bytes.length} bytes round-tripped`;
});

let videoKey = "";
await run("ffmpeg generates sample media in server container", async () => {
  videoKey = `live-tests/${TEST_ID}.mp4`;
  const hostPath = path.join(TMP, "sample.mp4");
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=25",
    "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=16000",
    "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", hostPath
  ], { stdio: "pipe", timeout: 180_000 });
  const bytes = readFileSync(hostPath);
  if (bytes.length < 10_000) throw new Error(`sample mp4 too small (${bytes.length})`);
  await putFile(videoKey, bytes, "video/mp4");
  return `${bytes.length} bytes`;
});

await run("ffmpeg media probe and thumbnail through API", async () => {
  const probeRes = await fetch(`${BASE}/api/media/probe`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ key: videoKey })
  });
  const probe = await json(probeRes);
  if (!probeRes.ok || !probe.ok) throw new Error(probe.error || "probe failed");
  if (!probe.result?.durationSec || !probe.result?.width) throw new Error("probe did not return media metadata");

  const thumbRes = await fetch(`${BASE}/api/media/thumbnail`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ key: videoKey, width: 320 })
  });
  const thumb = await json(thumbRes);
  if (!thumbRes.ok || !thumb.ok || !thumb.result?.outputKey) throw new Error(thumb.error || "thumbnail failed");
  uploadedKeys.push(thumb.result.outputKey);
  const thumbBytes = await getFile(thumb.result.outputKey);
  if (thumbBytes.length < 1000) throw new Error("thumbnail bytes look empty");
  return `${probe.result.width}x${probe.result.height}, thumbnail ${thumbBytes.length} bytes`;
});

await run("MP4 project export through /api/projects/export", async () => {
  const timeline = {
    project: { id: TEST_ID, name: "cloud-live-export" },
    clips: [
      { id: "c1", source: videoKey, sourceIn: 0, sourceOut: 1.2, timelineStart: 0, duration: 1.2 }
    ]
  };
  const res = await fetch(`${BASE}/api/projects/export`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ timeline })
  });
  const contentType = res.headers.get("content-type") || "";
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!res.ok) throw new Error(`export failed (${res.status}): ${bytes.toString("utf8").slice(0, 300)}`);
  if (!contentType.includes("video/mp4")) throw new Error(`unexpected export content-type: ${contentType}`);
  if (bytes.length < 10_000) throw new Error(`export mp4 too small (${bytes.length})`);
  return `${bytes.length} bytes MP4`;
});

await run("Whisper transcription through /api/ai/transcribe", async () => {
  const wavPath = path.join(TMP, "speech.wav");
  let generatedSpeech = false;
  try {
    const ps = [
      "Add-Type -AssemblyName System.Speech",
      "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
      "$s.SelectVoice('Microsoft Zira Desktop')",
      `$s.SetOutputToWaveFile('${wavPath.replaceAll("'", "''")}')`,
      "$s.Speak('archive cloud transcription test')",
      "$s.Dispose()"
    ].join("; ");
    execFileSync("powershell", ["-NoProfile", "-Command", ps], { stdio: "pipe", timeout: 60_000 });
    generatedSpeech = existsSync(wavPath);
  } catch {
    execFileSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=16000",
      "-t", "1", wavPath
    ], { stdio: "pipe", timeout: 60_000 });
  }
  const audio = readFileSync(wavPath);
  const res = await fetch(`${BASE}/api/ai/transcribe`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "audio/wav", "X-Filename": "cloud-live.wav" }),
    body: audio
  });
  const body = await json(res);
  if (!res.ok || !body.ok) throw new Error(body.error || `transcribe failed (${res.status})`);
  const text = String(body.result?.transcription || "").trim();
  if (generatedSpeech && !text) throw new Error("Whisper returned an empty transcription for generated speech");
  return text ? text.slice(0, 80) : "endpoint accepted audio (no local speech voice text detected)";
});

await run("Arabic OCR through /api/ocr", async () => {
  const pngPath = path.join(TMP, "arabic-ocr.png");
  const svg = `
    <svg width="1400" height="420" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <text x="700" y="180" text-anchor="middle" direction="rtl"
        font-family="Arial, Tahoma, sans-serif" font-size="104" font-weight="700" fill="#111111">اختبار الأرشيف العربي</text>
      <text x="700" y="305" text-anchor="middle" direction="rtl"
        font-family="Arial, Tahoma, sans-serif" font-size="76" fill="#111111">نص واضح للتعرف الضوئي</text>
    </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(pngPath);
  const file = new Blob([readFileSync(pngPath)], { type: "image/png" });
  const form = new FormData();
  form.append("file", file, "arabic-ocr.png");
  const res = await fetch(`${BASE}/api/ocr`, {
    method: "POST",
    headers: authHeaders(),
    body: form
  });
  const body = await json(res);
  if (!res.ok) throw new Error(body.error || `ocr failed (${res.status})`);
  const text = String(body.text || "").trim();
  if (!text) throw new Error("OCR returned empty Arabic text");
  return text.replace(/\s+/g, " ").slice(0, 100);
});

await cleanup();

const failed = checks.filter((check) => !check.ok);
console.log(`\n${failed.length ? "CLOUD LIVE CHECKS FAILED" : "ALL CLOUD LIVE CHECKS PASSED"} - ${checks.length - failed.length} ok, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
