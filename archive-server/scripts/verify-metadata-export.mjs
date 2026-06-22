/**
 * verify-metadata-export.mjs — tests for PBCore/Dublin Core export (§22.x).
 *
 * Uses node:test (built-in, no extra deps) run via tsx so ESM imports work.
 * Pattern mirrors verify-export.mjs.
 */
import assert from "node:assert/strict";

import { toDublinCore } from "../src/export/dublinCore.js";
import { toPBCore } from "../src/export/pbcore.js";
import { escapeXml, serializeElement, serializeDocument } from "../src/export/xmlSerializer.js";
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

// ── Sample records ────────────────────────────────────────────────────────────

const fullRecord = {
  uid: "item_001",
  data: {
    title: "نشرة أخبار 2026",
    description: "نشرة مصوّرة من أرشيف القناة.",
    documentType: "video",
    mimeType: "video/mp4",
    tags: ["أخبار", "أرشيف"],
    createdAt: "2026-01-15T09:00:00.000Z",
    author: "أحمد علي",
    project: "أرشيف القناة",
    fileKey: "media/news-2026.mp4",
    fileSizeBytes: 524288000,
    duration: "00:30:00",
    language: "ar",
    rights: "جميع الحقوق محفوظة",
  },
};

const minimalRecord = {
  id: "item_min",
};

// ── Dublin Core mapping ───────────────────────────────────────────────────────

run("toDublinCore — all 15 elements present", () => {
  const DC_KEYS = [
    "title", "creator", "subject", "description", "publisher",
    "contributor", "date", "type", "format", "identifier",
    "source", "language", "relation", "coverage", "rights",
  ];
  const dc = toDublinCore(fullRecord);
  for (const key of DC_KEYS) {
    assert.ok(key in dc, `Missing DC element: ${key}`);
  }
  assert.equal(Object.keys(dc).length, 15);
});

run("toDublinCore — correct field mappings", () => {
  const dc = toDublinCore(fullRecord);
  assert.equal(dc.title, "نشرة أخبار 2026");
  assert.equal(dc.creator, "أحمد علي");
  assert.equal(dc.subject, "أخبار; أرشيف");
  assert.equal(dc.description, "نشرة مصوّرة من أرشيف القناة.");
  assert.equal(dc.publisher, "أرشيف القناة");
  assert.equal(dc.date, "2026-01-15");
  assert.equal(dc.type, "video");
  assert.equal(dc.format, "video/mp4");
  assert.equal(dc.identifier, "item_001");
  assert.equal(dc.language, "ar");
  assert.equal(dc.rights, "جميع الحقوق محفوظة");
});

run("toDublinCore — missing fields render as empty strings", () => {
  const dc = toDublinCore(minimalRecord);
  const DC_KEYS = [
    "title", "creator", "subject", "description", "publisher",
    "contributor", "date", "type", "format", "identifier",
    "source", "language", "relation", "coverage", "rights",
  ];
  for (const key of DC_KEYS) {
    assert.equal(typeof dc[key], "string", `${key} should be a string`);
  }
  // identifier maps from id
  assert.equal(dc.identifier, "item_min");
});

// ── PBCore mapping ────────────────────────────────────────────────────────────

run("toPBCore — all top-level PBCore keys present", () => {
  const PB_KEYS = [
    "pbcoreAssetType", "pbcoreAssetDate", "pbcoreIdentifier", "pbcoreTitle",
    "pbcoreSubject", "pbcoreDescription", "pbcoreGenre", "pbcoreRelation",
    "pbcoreCoverage", "pbcoreAudienceLevel", "pbcoreAudienceRating",
    "pbcoreCreator", "pbcoreContributor", "pbcorePublisher",
    "pbcoreRightsSummary", "pbcoreInstantiation",
  ];
  const pb = toPBCore(fullRecord);
  for (const key of PB_KEYS) {
    assert.ok(key in pb, `Missing PBCore key: ${key}`);
  }
});

run("toPBCore — pbcoreAssetType maps video → Moving Image", () => {
  const pb = toPBCore(fullRecord);
  assert.equal(pb.pbcoreAssetType, "Moving Image");
});

run("toPBCore — pbcoreSubject is an array", () => {
  const pb = toPBCore(fullRecord);
  assert.ok(Array.isArray(pb.pbcoreSubject), "pbcoreSubject should be an array");
  assert.deepEqual(pb.pbcoreSubject, ["أخبار", "أرشيف"]);
});

run("toPBCore — pbcoreInstantiation contains technical fields", () => {
  const pb = toPBCore(fullRecord);
  const inst = pb.pbcoreInstantiation;
  assert.ok(inst, "pbcoreInstantiation should exist");
  assert.equal(inst.instantiationIdentifier, "item_001");
  assert.equal(inst.instantiationDigital, "video/mp4");
  assert.equal(inst.instantiationLocation, "media/news-2026.mp4");
  assert.equal(inst.instantiationDuration, "00:30:00");
});

run("toPBCore — rights option overrides record field", () => {
  const pb = toPBCore(fullRecord, { rights: "Creative Commons BY" });
  assert.equal(pb.pbcoreRightsSummary, "Creative Commons BY");
});

run("toPBCore — missing fields produce empty strings not undefined", () => {
  const pb = toPBCore(minimalRecord);
  assert.equal(typeof pb.pbcoreTitle, "string");
  assert.equal(typeof pb.pbcoreDescription, "string");
  assert.ok(Array.isArray(pb.pbcoreSubject));
  assert.equal(pb.pbcoreSubject.length, 0);
});

// ── XML serialiser ────────────────────────────────────────────────────────────

run("escapeXml — escapes &, <, >, \", '", () => {
  const result = escapeXml("a & b < c > d \" e ' f");
  assert.equal(result, "a &amp; b &lt; c &gt; d &quot; e &apos; f");
});

run("escapeXml — handles null/undefined gracefully", () => {
  assert.equal(escapeXml(null), "");
  assert.equal(escapeXml(undefined), "");
  assert.equal(escapeXml(0), "0");
});

run("serializeElement — text content is escaped", () => {
  const el = serializeElement("title", "Cats & Dogs <bold>", {}, 0);
  assert.equal(el, "<title>Cats &amp; Dogs &lt;bold&gt;</title>");
});

run("serializeElement — attributes are escaped", () => {
  const el = serializeElement("link", "text", { href: "https://x.com/?a=1&b=2" }, 0);
  assert.match(el, /href="https:\/\/x\.com\/\?a=1&amp;b=2"/);
});

run("serializeElement — empty value produces self-closing tag", () => {
  const el = serializeElement("empty", "", {}, 0);
  assert.equal(el, "<empty/>");
});

run("serializeElement — indent applied correctly", () => {
  const el = serializeElement("child", "val", {}, 2);
  assert.match(el, /^    <child>/);
});

run("serializeDocument — wraps in root with declaration", () => {
  const doc = serializeDocument("root", { xmlns: "http://example.com/" }, [
    "  <child>value</child>",
  ]);
  assert.match(doc, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(doc, /<root xmlns="http:\/\/example\.com\/">/);
  assert.match(doc, /<\/root>$/);
  assert.match(doc, /<child>value<\/child>/);
});

run("serializeDocument — PBCore root element name is pbcoreDescriptionDocument", () => {
  // Smoke-test: round-trip a minimal PBCore record through the renderer.
  const pb = toPBCore(fullRecord);
  // Re-implement minimal rendering inline to avoid importing the route module.
  const doc = serializeDocument(
    "pbcoreDescriptionDocument",
    { xmlns: "http://www.pbcore.org/PBCore/PBCoreNamespace.html" },
    [
      serializeElement("pbcoreTitle", pb.pbcoreTitle, {}, 1),
      serializeElement("pbcoreIdentifier", pb.pbcoreIdentifier, { source: "local" }, 1),
    ]
  );
  assert.match(doc, /<pbcoreDescriptionDocument/);
  assert.match(doc, /pbcoreTitle/);
  assert.match(doc, /pbcoreIdentifier/);
  assert.match(doc, /<\/pbcoreDescriptionDocument>/);
});

// ── HTTP endpoints ────────────────────────────────────────────────────────────

run("HTTP: GET /api/items/:id/export/pbcore.xml — requires auth", async () => {
  const SECRET = "export-test";
  const storage = {
    async get(store, id) {
      return id === "item_001" ? fullRecord : null;
    },
  };
  const server = createApiServer({
    backend: "test",
    authSecret: SECRET,
    resolveStorage: () => storage,
    rateLimit: null,
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    // No auth → 401
    const noAuth = await fetch(`${base}/api/items/item_001/export/pbcore.xml`);
    assert.equal(noAuth.status, 401);

    // With auth → 200 + valid XML
    const token = signJwt({ sub: "u1", role: "editor" }, SECRET);
    const res = await fetch(`${base}/api/items/item_001/export/pbcore.xml`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /application\/xml/);
    const body = await res.text();
    assert.match(body, /<\?xml version="1\.0" encoding="UTF-8"\?>/);
    assert.match(body, /<pbcoreDescriptionDocument/);
    assert.match(body, /pbcoreTitle/);
    assert.match(body, /<\/pbcoreDescriptionDocument>/);

    // Not found → 404
    const missing = await fetch(`${base}/api/items/not_exist/export/pbcore.xml`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(missing.status, 404);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

run("HTTP: GET /api/items/:id/export/dublincore.rdf — returns rdf+xml", async () => {
  const SECRET = "export-dc";
  const storage = {
    async get(store, id) {
      return id === "item_001" ? fullRecord : null;
    },
  };
  const server = createApiServer({
    backend: "test",
    authSecret: SECRET,
    resolveStorage: () => storage,
    rateLimit: null,
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const token = signJwt({ sub: "u1", role: "viewer" }, SECRET);
    const res = await fetch(`${base}/api/items/item_001/export/dublincore.rdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /rdf\+xml/);
    const body = await res.text();
    assert.match(body, /<rdf:RDF/);
    assert.match(body, /dc:title/);
    assert.match(body, /dc:identifier/);
    assert.match(body, /<\/rdf:RDF>/);
    // All 15 DC elements present
    const DC_ELEMENTS = [
      "title", "creator", "subject", "description", "publisher",
      "contributor", "date", "type", "format", "identifier",
      "source", "language", "relation", "coverage", "rights",
    ];
    for (const el of DC_ELEMENTS) {
      assert.ok(body.includes(`dc:${el}`), `Missing dc:${el} in RDF output`);
    }
  } finally {
    await new Promise((r) => server.close(r));
  }
});

// ── Process exit ─────────────────────────────────────────────────────────────

process.on("beforeExit", () => {
  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  } else {
    console.log("\nAll metadata-export tests passed.");
  }
});
