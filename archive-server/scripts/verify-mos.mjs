/**
 * verify-mos.mjs — tests for MOS protocol slice 1.
 *
 * Covers:
 *   1. roReq — well-formed XML with required envelope elements
 *   2. messageID increments per session call
 *   3. searchArchiveForMos — returns MOS-shaped rows for a query
 *   4. HTTP POST /api/mos/search — 401 without auth, 200 with auth
 *   5. HTTP GET  /api/mos/envelope-sample — returns XML for each known type
 *
 * Uses node:test (built-in) via tsx. Pattern mirrors verify-metadata-export.mjs.
 */

import assert from "node:assert/strict";

import { roReq, roCreate, roStorySend, roElementAction, objList, objCreate } from "../src/integrations/mos/messages.js";
import { createMosSession } from "../src/integrations/mos/session.js";
import { searchArchiveForMos } from "../src/integrations/mos/searchBridge.js";
import { createApiServer } from "../src/api/server.js";
import { signJwt } from "../src/auth/jwt.js";

let failures = 0;

function run(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((err) => {
      failures += 1;
      console.error(`not ok - ${name}\n  ${err?.stack || err?.message || err}`);
    });
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SESSION = { mosID: "ARCHIVE.TEST.1", ncsID: "ENPS.TEST.1" };

const SAMPLE_ITEMS = [
  {
    uid: "vid_001",
    title: "نشرة أخبار الساعة السادسة",
    description: "تغطية شاملة للأحداث اليومية",
    mimeType: "video/mp4",
    duration: "00:29:55",
    language: "ar",
    tags: ["أخبار", "مباشر"],
  },
  {
    uid: "vid_002",
    title: "تقرير الطقس",
    description: "حالة الطقس للأيام القادمة",
    mimeType: "video/mp4",
    duration: 180,
    language: "ar",
  },
  {
    uid: "doc_001",
    title: "وثيقة أرشيفية",
    description: "وثيقة تاريخية من الأرشيف",
    mimeType: "application/pdf",
  },
];

// ── 1. roReq — well-formed XML with required envelope elements ────────────────

run("roReq — returns well-formed XML with <mos> root", () => {
  const xml = roReq({ ...SESSION, messageID: 1, roID: "RO.1" });
  assert.ok(typeof xml === "string", "must return a string");
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<mos>/);
  assert.match(xml, /<\/mos>$/);
});

run("roReq — contains <mosID>", () => {
  const xml = roReq({ ...SESSION, messageID: 1, roID: "RO.1" });
  assert.match(xml, /<mosID>ARCHIVE\.TEST\.1<\/mosID>/);
});

run("roReq — contains <ncsID>", () => {
  const xml = roReq({ ...SESSION, messageID: 1, roID: "RO.1" });
  assert.match(xml, /<ncsID>ENPS\.TEST\.1<\/ncsID>/);
});

run("roReq — contains <messageID>", () => {
  const xml = roReq({ ...SESSION, messageID: 7, roID: "RO.1" });
  assert.match(xml, /<messageID>7<\/messageID>/);
});

run("roReq — contains <roReq> payload element", () => {
  const xml = roReq({ ...SESSION, messageID: 1, roID: "RO.TEST.42" });
  assert.match(xml, /<roReq>/);
  assert.match(xml, /<roID>RO\.TEST\.42<\/roID>/);
  assert.match(xml, /<\/roReq>/);
});

// ── 2. Other message builders ─────────────────────────────────────────────────

run("roCreate — contains <roCreate> and roSlug", () => {
  const xml = roCreate({ ...SESSION, messageID: 2, roID: "RO.2", roSlug: "Evening News" });
  assert.match(xml, /<roCreate>/);
  assert.match(xml, /<roSlug>Evening News<\/roSlug>/);
  assert.match(xml, /<\/roCreate>/);
});

run("roStorySend — contains story and item children", () => {
  const xml = roStorySend({
    ...SESSION, messageID: 3,
    roID: "RO.1", storyID: "STY.1", storySlug: "Lead",
    items: [{ itemID: "ITM.1", objID: "OBJ.1", objSlug: "Clip A", objDur: 30 }],
  });
  assert.match(xml, /<roStorySend>/);
  assert.match(xml, /<storyID>STY\.1<\/storyID>/);
  assert.match(xml, /<objDur>30<\/objDur>/);
});

run("roElementAction — operation attribute present", () => {
  const xml = roElementAction({ ...SESSION, messageID: 4, roID: "RO.1", operation: "DELETE", storyID: "STY.1" });
  assert.match(xml, /operation="DELETE"/);
  assert.match(xml, /<roElementAction/);
});

run("objList — contains <mosObj> children", () => {
  const xml = objList({
    ...SESSION, messageID: 5,
    objects: [{ objID: "OBJ.1", objSlug: "Clip", objDur: 60, mosAbstract: "A clip" }],
  });
  assert.match(xml, /<objList>/);
  assert.match(xml, /<mosObj>/);
  assert.match(xml, /<objID>OBJ\.1<\/objID>/);
});

run("objCreate — contains objID and objSlug", () => {
  const xml = objCreate({ ...SESSION, messageID: 6, objID: "OBJ.NEW", objSlug: "New Clip" });
  assert.match(xml, /<objCreate>/);
  assert.match(xml, /<objID>OBJ\.NEW<\/objID>/);
  assert.match(xml, /<objSlug>New Clip<\/objSlug>/);
});

// ── 3. messageID increments per session call ──────────────────────────────────

run("session — messageID increments on each wrap() call", () => {
  const session = createMosSession(SESSION);
  const e1 = session.wrap();
  const e2 = session.wrap();
  const e3 = session.wrap();
  assert.equal(e1.messageID, 1);
  assert.equal(e2.messageID, 2);
  assert.equal(e3.messageID, 3);
});

run("session — nextMessageID is the same counter as wrap()", () => {
  const session = createMosSession(SESSION);
  assert.equal(session.nextMessageID(), 1);
  assert.equal(session.wrap().messageID, 2);
  assert.equal(session.nextMessageID(), 3);
});

run("session — wrap() returns mosID and ncsID", () => {
  const session = createMosSession(SESSION);
  const env = session.wrap();
  assert.equal(env.mosID, SESSION.mosID);
  assert.equal(env.ncsID, SESSION.ncsID);
});

run("session — unwrap() parses roReq XML correctly", () => {
  const session = createMosSession(SESSION);
  const xml = roReq({ ...session.wrap(), roID: "RO.PARSE.1" });
  const parsed = session.unwrap(xml);
  assert.equal(parsed.mosID, SESSION.mosID);
  assert.equal(parsed.ncsID, SESSION.ncsID);
  assert.equal(parsed.type, "roReq");
  assert.equal(parsed.roID, "RO.PARSE.1");
});

run("session — unwrap() coerces messageID to number", () => {
  const session = createMosSession(SESSION);
  const xml = roReq({ ...session.wrap(), roID: "RO.1" });
  const parsed = session.unwrap(xml);
  assert.equal(typeof parsed.messageID, "number");
});

run("session — throws when mosID missing", () => {
  assert.throws(() => createMosSession({ mosID: "", ncsID: "X" }), /mosID/i);
});

// ── 4. searchArchiveForMos ─────────────────────────────────────────────────────

run("searchArchiveForMos — returns MOS-shaped rows", () => {
  const results = searchArchiveForMos({ query: "أخبار", items: SAMPLE_ITEMS });
  assert.ok(results.length > 0, "should find at least one match");
  const row = results[0];
  assert.ok("objID" in row, "missing objID");
  assert.ok("objSlug" in row, "missing objSlug");
  assert.ok("objDur" in row, "missing objDur");
  assert.ok("mosAbstract" in row, "missing mosAbstract");
  assert.ok("mosExternalMetadata" in row, "missing mosExternalMetadata");
});

run("searchArchiveForMos — objDur derived from duration string HH:MM:SS", () => {
  const results = searchArchiveForMos({ query: "أخبار", items: SAMPLE_ITEMS });
  const item = results.find((r) => r.objID === "vid_001");
  assert.ok(item, "vid_001 should be in results");
  // 00:29:55 = 1795 seconds
  assert.equal(item.objDur, 1795);
});

run("searchArchiveForMos — objDur derived from numeric seconds", () => {
  const results = searchArchiveForMos({ query: "طقس", items: SAMPLE_ITEMS });
  assert.ok(results.length > 0, "should match تقرير الطقس");
  assert.equal(results[0].objDur, 180);
});

run("searchArchiveForMos — objDur is null when missing", () => {
  const results = searchArchiveForMos({ query: "وثيقة", items: SAMPLE_ITEMS });
  assert.ok(results.length > 0);
  assert.equal(results[0].objDur, null);
});

run("searchArchiveForMos — empty query returns empty array", () => {
  const results = searchArchiveForMos({ query: "", items: SAMPLE_ITEMS });
  assert.deepEqual(results, []);
});

run("searchArchiveForMos — limit is respected", () => {
  const many = Array.from({ length: 20 }, (_, i) => ({
    uid: `item_${i}`, title: `خبر رقم ${i}`, description: "تغطية الأحداث",
  }));
  const results = searchArchiveForMos({ query: "خبر", limit: 5, items: many });
  assert.equal(results.length, 5);
});

run("searchArchiveForMos — mosExternalMetadata contains archiveMimeType", () => {
  const results = searchArchiveForMos({ query: "أخبار", items: SAMPLE_ITEMS });
  const item = results.find((r) => r.objID === "vid_001");
  assert.ok(item, "vid_001 should be in results");
  assert.match(item.mosExternalMetadata, /archiveMimeType/);
  assert.match(item.mosExternalMetadata, /video\/mp4/);
});

// ── 5. HTTP endpoints ──────────────────────────────────────────────────────────

const SECRET = "mos-test-secret";
const ITEMS = SAMPLE_ITEMS;

function makeStorage(items) {
  return {
    async getAll(store) {
      return store === "video_items" ? items : [];
    },
    async get() { return null; },
  };
}

run("HTTP POST /api/mos/search — 401 without auth", async () => {
  const server = createApiServer({
    backend: "test", authSecret: SECRET,
    resolveStorage: () => makeStorage(ITEMS), rateLimit: null,
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const res = await fetch(`${base}/api/mos/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "أخبار" }),
    });
    assert.equal(res.status, 401);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

run("HTTP POST /api/mos/search — 200 with valid auth and results", async () => {
  const server = createApiServer({
    backend: "test", authSecret: SECRET,
    resolveStorage: () => makeStorage(ITEMS), rateLimit: null,
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = signJwt({ sub: "u1", role: "editor" }, SECRET);
  try {
    const res = await fetch(`${base}/api/mos/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: "أخبار" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.ok(Array.isArray(body.results), "results must be an array");
    assert.ok(body.results.length > 0, "should return at least one result");
    assert.ok(typeof body.xml === "string", "xml field must be present");
    assert.match(body.xml, /<mos>/);
    assert.match(body.xml, /<objList>/);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

run("HTTP POST /api/mos/search — 400 for short query", async () => {
  const server = createApiServer({
    backend: "test", authSecret: SECRET,
    resolveStorage: () => makeStorage(ITEMS), rateLimit: null,
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = signJwt({ sub: "u1", role: "editor" }, SECRET);
  try {
    const res = await fetch(`${base}/api/mos/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: "أ" }),
    });
    assert.equal(res.status, 400);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

run("HTTP GET /api/mos/envelope-sample — returns XML for roReq", async () => {
  const server = createApiServer({
    backend: "test", authSecret: SECRET,
    resolveStorage: () => makeStorage([]), rateLimit: null,
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = signJwt({ sub: "u1", role: "viewer" }, SECRET);
  try {
    const res = await fetch(`${base}/api/mos/envelope-sample?type=roReq`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /application\/xml/);
    const body = await res.text();
    assert.match(body, /<mos>/);
    assert.match(body, /<roReq>/);
    assert.match(body, /<\/mos>$/);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

run("HTTP GET /api/mos/envelope-sample — returns XML for objList", async () => {
  const server = createApiServer({
    backend: "test", authSecret: SECRET,
    resolveStorage: () => makeStorage([]), rateLimit: null,
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = signJwt({ sub: "u1", role: "viewer" }, SECRET);
  try {
    const res = await fetch(`${base}/api/mos/envelope-sample?type=objList`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.match(body, /<objList>/);
    assert.match(body, /<mosObj>/);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

run("HTTP GET /api/mos/envelope-sample — 401 without auth", async () => {
  const server = createApiServer({
    backend: "test", authSecret: SECRET,
    resolveStorage: () => makeStorage([]), rateLimit: null,
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const res = await fetch(`${base}/api/mos/envelope-sample?type=roReq`);
    assert.equal(res.status, 401);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

// ── Process exit ──────────────────────────────────────────────────────────────

process.on("beforeExit", () => {
  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  } else {
    console.log("\nAll MOS tests passed.");
  }
});
