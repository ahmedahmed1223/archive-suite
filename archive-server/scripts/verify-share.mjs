import assert from "node:assert/strict";

import { createShareScope, resolveScopedItemIds, filterSnapshotForShare } from "../src/share/scope.js";
import { mintShareToken, readShareToken, readShareTokenPayload, ShareTokenError } from "../src/share/token.js";
import { signJwt } from "../src/auth/jwt.js";
import { createApiServer } from "../src/api/server.js";

// Scoped sharing (G6) — pure scope/filter logic + signed token round-trip + the
// public/auth HTTP endpoints (with an injected fake storage snapshot).

let failures = 0;
function run(name, fn) {
  Promise.resolve().then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((err) => { failures += 1; console.error(`not ok - ${name}\n  ${err.message}`); });
}

const SNAP = {
  videoItems: [
    {
      id: "v1",
      title: "A",
      type: "t1",
      tags: ["internal"],
      notes: "internal note",
      metadata: { public: "ok", transcript: "secret transcript" },
      fieldAcl: { tags: ["admin"], notes: ["admin"], transcript: ["admin"] }
    },
    { id: "v2", title: "B", type: "t2", isDeleted: true },     // deleted → never shared
    { id: "v3", title: "C", type: "t1" }
  ],
  contentTypes: [{ id: "t1", name: "نوع" }, { id: "t2", name: "آخر" }, { id: "t3", name: "غير مستخدم" }],
  virtualCollections: [{ id: "c1", itemIds: ["v1", "v2"] }],
  vocabulary: [{ id: "w1" }],
  hierarchicalTags: [{ id: "h1" }],
  users: [{ id: "u1", username: "admin" }],
  auditLogs: [{ id: "a1" }],
  settings: { secret: "x" }
};

run("createShareScope normalizes type/ids/label", () => {
  assert.deepEqual(createShareScope({ type: "items", ids: ["a", "a", "", "b"], label: " x ", permission: "download" }), { type: "items", ids: ["a", "b"], label: "x", permission: "download" });
  assert.deepEqual(createShareScope({ type: "item", ids: ["a"], permission: "owner" }), { type: "items", ids: ["a"], label: "", permission: "view" });
  assert.equal(createShareScope({ type: "bogus" }).type, "all");          // unknown → all
  assert.deepEqual(createShareScope().ids, []);
});

run("resolveScopedItemIds: all / items / collection (excludes deleted)", () => {
  assert.deepEqual([...resolveScopedItemIds({ type: "all" }, SNAP)].sort(), ["v1", "v3"]);
  assert.deepEqual([...resolveScopedItemIds({ type: "items", ids: ["v1", "v2"] }, SNAP)], ["v1"]); // v2 deleted
  assert.deepEqual([...resolveScopedItemIds({ type: "collection", ids: ["c1"] }, SNAP)], ["v1"]);  // c1 has v1,v2; v2 deleted
});

run("filterSnapshotForShare exposes only scoped items + used types; hides private data", () => {
  const out = filterSnapshotForShare(SNAP, createShareScope({ type: "items", ids: ["v1"], permission: "comment" }));
  assert.deepEqual(out.videoItems.map((i) => i.id), ["v1"]);
  assert.deepEqual(out.contentTypes.map((t) => t.id), ["t1"]);           // only the referenced type
  assert.equal(out.counts.items, 1);
  assert.equal(out.share.permission, "comment");
  assert.deepEqual(out.share.capabilities, { canView: true, canComment: true, canDownload: false, canEdit: false });
  assert.ok(out.vocabulary && out.hierarchicalTags);
  // privacy: no users / audit / settings / collections leak
  assert.equal(out.users, undefined);
  assert.equal(out.auditLogs, undefined);
  assert.equal(out.settings, undefined);
  assert.equal(out.virtualCollections, undefined);
});

run("filterSnapshotForShare applies field ACL before public exposure", () => {
  const out = filterSnapshotForShare(SNAP, createShareScope({ type: "items", ids: ["v1"] }));
  const [item] = out.videoItems;
  assert.equal(item.metadata.public, "ok");
  assert.equal(item.metadata.transcript, undefined);
  assert.deepEqual(item.tags, []);
  assert.equal(item.notes, "");
});

run("token round-trips scope; rejects wrong-kind / tampered / expired", () => {
  const secret = "share-secret";
  const token = mintShareToken({ scope: { type: "items", ids: ["v1"], label: "لقطات", permission: "download" }, secret, title: "مراجعة العميل", expiresInDays: 7 });
  assert.deepEqual(readShareToken(token, secret), { type: "items", ids: ["v1"], label: "لقطات", permission: "download" });
  const payload = readShareTokenPayload(token, secret);
  assert.deepEqual(payload.scope, { type: "items", ids: ["v1"], label: "لقطات", permission: "download" });
  assert.equal(payload.title, "مراجعة العميل");
  assert.ok(payload.expiresAt);

  // a normal auth JWT (no kind:"share") must be rejected
  const authToken = signJwt({ sub: "u1", role: "admin" }, secret);
  assert.throws(() => readShareToken(authToken, secret), (e) => e instanceof ShareTokenError);

  // tampered
  assert.throws(() => readShareToken(token + "x", secret), (e) => e instanceof ShareTokenError);

  // expired
  const expired = signJwt({ kind: "share", scope: { type: "all", ids: [] } }, secret, { expiresInSec: -10 });
  assert.throws(() => readShareToken(expired, secret), (e) => e instanceof ShareTokenError);
});

run("password-protected share tokens require the link password", () => {
  const secret = "share-secret";
  const token = mintShareToken({
    scope: { type: "items", ids: ["v1"], label: "لقطات", permission: "view" },
    secret,
    title: "مراجعة محمية",
    password: "open-sesame"
  });

  assert.throws(() => readShareTokenPayload(token, secret), (e) => e instanceof ShareTokenError && e.statusCode === 401);
  assert.throws(() => readShareTokenPayload(token, secret, { password: "wrong" }), (e) => e instanceof ShareTokenError && e.statusCode === 401);

  const payload = readShareTokenPayload(token, secret, { password: "open-sesame" });
  assert.equal(payload.passwordProtected, true);
  assert.deepEqual(payload.scope, { type: "items", ids: ["v1"], label: "لقطات", permission: "view" });
});

run("HTTP: POST /api/share needs auth; GET /api/share/:token is public + scoped", async () => {
  const SECRET = "s6";
  const server = createApiServer({
    backend: "test", authSecret: SECRET, rateLimit: null,
    resolveStorage: () => ({ snapshot: async () => SNAP })
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    // mint requires auth
    const noAuth = await fetch(`${base}/api/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: { type: "all" } }) });
    assert.equal(noAuth.status, 401);

    const jwt = signJwt({ sub: "u1", role: "admin" }, SECRET);
    const mint = await fetch(`${base}/api/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ scope: { type: "items", ids: ["v1", "v3"], label: "للمراجعة", permission: "download" }, title: "مراجعة عامة", expiresInDays: 5 })
    });
    assert.equal(mint.status, 200);
    const { result } = await mint.json();
    assert.ok(result.token && result.path.includes(result.token));
    assert.equal(result.title, "مراجعة عامة");
    assert.ok(result.expiresAt);

    // public read — no auth header
    const pub = await fetch(`${base}/api/share/${result.token}`);
    assert.equal(pub.status, 200);
    const payload = (await pub.json()).result;
    assert.deepEqual(payload.videoItems.map((i) => i.id).sort(), ["v1", "v3"]);
    assert.equal(payload.share.title, "مراجعة عامة");
    assert.equal(payload.share.scopeLabel, "للمراجعة");
    assert.equal(payload.share.permission, "download");
    assert.equal(payload.share.capabilities.canDownload, true);
    assert.ok(payload.share.expiresAt);
    assert.equal(payload.users, undefined);

    // invalid token → 404
    const bad = await fetch(`${base}/api/share/not-a-real-token`);
    assert.equal(bad.status, 404);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

run("HTTP: password-protected share requires x-share-password", async () => {
  const SECRET = "s6";
  const server = createApiServer({
    backend: "test", authSecret: SECRET, rateLimit: null,
    resolveStorage: () => ({ snapshot: async () => SNAP })
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const jwt = signJwt({ sub: "u1", role: "admin" }, SECRET);
    const mint = await fetch(`${base}/api/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ scope: { type: "items", ids: ["v1"], permission: "view" }, title: "محمية", password: "123456" })
    });
    assert.equal(mint.status, 200);
    const { result } = await mint.json();
    assert.equal(result.passwordProtected, true);

    const missingPassword = await fetch(`${base}/api/share/${result.token}`);
    assert.equal(missingPassword.status, 401);

    const wrongPassword = await fetch(`${base}/api/share/${result.token}`, { headers: { "x-share-password": "nope" } });
    assert.equal(wrongPassword.status, 401);

    const ok = await fetch(`${base}/api/share/${result.token}`, { headers: { "x-share-password": "123456" } });
    assert.equal(ok.status, 200);
    const payload = (await ok.json()).result;
    assert.equal(payload.share.passwordProtected, true);
    assert.deepEqual(payload.videoItems.map((i) => i.id), ["v1"]);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

process.on("beforeExit", () => {
  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  else console.log("\nAll share tests passed.");
});
