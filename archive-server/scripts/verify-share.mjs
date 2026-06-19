import assert from "node:assert/strict";

import { createShareScope, resolveScopedItemIds, filterSnapshotForShare } from "../src/share/scope.js";
import { mintShareToken, readShareToken, readShareTokenPayload, ShareTokenError } from "../src/share/token.js";
import { createShareInvitationService } from "../src/share/invitationService.js";
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

run("share invitation service mints token, sends email, and stores invitation", async () => {
  const SECRET = "share-secret";
  const sent = [];
  const invitations = [];
  const svc = createShareInvitationService({
    resolvedShareSecret: SECRET,
    sendMail: async (message) => {
      sent.push(message);
      return { sent: true };
    },
    db: {
      shareInvitation: {
        create: async ({ data }) => {
          invitations.push(data);
          return data;
        }
      }
    }
  });

  const result = await svc.createInvitation({
    email: " Reviewer@Example.COM ",
    scope: { type: "items", ids: ["v1"], permission: "comment" },
    title: "مراجعة خارجية",
    message: "راجع التعليقات قبل النشر.",
    origin: "https://archive.example",
    sender: { sub: "u1", username: "Admin" }
  });

  assert.equal(result.invitation.email, "reviewer@example.com");
  assert.equal(result.invitation.permission, "comment");
  assert.equal(result.invitation.persisted, "prisma");
  assert.equal(result.invitation.status, "sent");
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /https:\/\/archive\.example\/api\/share\//);
  assert.equal(invitations.length, 1);
  assert.equal(invitations[0].email, "reviewer@example.com");
  assert.ok(invitations[0].createdAt instanceof Date);
  const payload = readShareTokenPayload(result.token, SECRET);
  assert.deepEqual(payload.scope, { type: "items", ids: ["v1"], label: "", permission: "comment" });
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

run("HTTP: share-access enforces comment capability and item scope", async () => {
  const SECRET = "s6";
  const comments = [];
  const storage = {
    snapshot: async () => SNAP,
    getAll: async (store) => (store === "share_comments" ? comments : []),
    put: async (store, row) => {
      if (store === "share_comments") comments.push(row);
      return row;
    }
  };
  const server = createApiServer({
    backend: "test", authSecret: SECRET, rateLimit: null,
    resolveStorage: () => storage
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const viewToken = mintShareToken({ scope: { type: "items", ids: ["v1"], permission: "view" }, secret: SECRET });
    const commentToken = mintShareToken({ scope: { type: "items", ids: ["v1"], permission: "comment" }, secret: SECRET });

    const access = await fetch(`${base}/api/share-access?shareToken=${encodeURIComponent(commentToken)}`);
    assert.equal(access.status, 200);
    const accessPayload = (await access.json()).result;
    assert.equal(accessPayload.capabilities.canComment, true);

    const denied = await fetch(`${base}/api/share-access/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-share-token": viewToken },
      body: JSON.stringify({ itemId: "v1", text: "تعليق" })
    });
    assert.equal(denied.status, 403);

    const outOfScope = await fetch(`${base}/api/share-access/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-share-token": commentToken },
      body: JSON.stringify({ itemId: "v3", text: "تعليق خارج النطاق" })
    });
    assert.equal(outOfScope.status, 403);

    const ok = await fetch(`${base}/api/share-access/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-share-token": commentToken },
      body: JSON.stringify({ itemId: "v1", text: "تعليق عام", authorName: "مراجع" })
    });
    assert.equal(ok.status, 201);
    const comment = (await ok.json()).result;
    assert.equal(comment.itemId, "v1");
    assert.equal(comment.text, "تعليق عام");
    assert.equal(comment.authorName, "مراجع");
    assert.equal(comments.length, 1);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

run("HTTP: share comments persist through Prisma when available", async () => {
  const SECRET = "s6";
  const prismaComments = [];
  const server = createApiServer({
    backend: "test",
    authSecret: SECRET,
    rateLimit: null,
    resolveStorage: () => ({ snapshot: async () => SNAP }),
    prisma: {
      shareComment: {
        create: async ({ data }) => {
          prismaComments.push(data);
          return data;
        }
      }
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const commentToken = mintShareToken({ scope: { type: "items", ids: ["v1"], permission: "comment" }, secret: SECRET });
    const ok = await fetch(`${base}/api/share-access/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-share-token": commentToken },
      body: JSON.stringify({ itemId: "v1", text: "تعليق محفوظ", authorName: "مراجع" })
    });
    assert.equal(ok.status, 201);
    assert.equal(prismaComments.length, 1);
    assert.equal(prismaComments[0].itemId, "v1");
    assert.equal(prismaComments[0].shareJti, readShareTokenPayload(commentToken, SECRET).jti);
    assert.ok(prismaComments[0].createdAt instanceof Date);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

run("HTTP: share invitations require auth and send/store invitation", async () => {
  const SECRET = "s6";
  const sent = [];
  const invitations = [];
  const storage = {
    snapshot: async () => SNAP,
    put: async (store, row) => {
      if (store === "share_invitations") invitations.push(row);
      return row;
    }
  };
  const server = createApiServer({
    backend: "test",
    authSecret: SECRET,
    rateLimit: null,
    resolveStorage: () => storage,
    notificationSendMail: async (message) => {
      sent.push(message);
      return { sent: true };
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const noAuth = await fetch(`${base}/api/share/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "reviewer@example.com", scope: { type: "items", ids: ["v1"] } })
    });
    assert.equal(noAuth.status, 401);

    const jwt = signJwt({ sub: "u1", role: "admin", username: "Admin" }, SECRET);
    const invalid = await fetch(`${base}/api/share/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ email: "not-an-email", scope: { type: "items", ids: ["v1"] } })
    });
    assert.equal(invalid.status, 400);

    const ok = await fetch(`${base}/api/share/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({
        email: "reviewer@example.com",
        scope: { type: "items", ids: ["v1"], permission: "comment" },
        title: "مراجعة",
        message: "فضلاً راجع السجل."
      })
    });
    assert.equal(ok.status, 201);
    const payload = (await ok.json()).result;
    assert.ok(payload.token);
    assert.equal(payload.invitation.email, "reviewer@example.com");
    assert.equal(payload.invitation.permission, "comment");
    assert.equal(payload.emailStatus.sent, true);
    assert.equal(sent.length, 1);
    assert.equal(invitations.length, 1);
    assert.match(payload.url, /\/api\/share\//);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

process.on("beforeExit", () => {
  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  else console.log("\nAll share tests passed.");
});
