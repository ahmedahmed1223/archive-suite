import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createApiServer } from "../src/api/server.js";
import { signJwt } from "../src/auth/jwt.js";
import { notifyMention, notifyRecordShared, notifyUploadComplete } from "../src/notifications/notificationService.js";
import { saveSubscription, sendPushToUser } from "../src/notifications/webPushService.js";

let failures = 0;
function run(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((err) => {
      failures += 1;
      console.error(`not ok - ${name}\n  ${err.stack || err.message}`);
    });
}

function bearer(secret = "notification-secret") {
  return `Bearer ${signJwt({ sub: "u1", username: "admin", role: "admin" }, secret)}`;
}

function createFakeFileStore() {
  const files = new Map();
  return {
    async putBlob(key, blob) {
      const bytes = Buffer.isBuffer(blob) ? blob : Buffer.from(await blob.arrayBuffer());
      files.set(key, bytes);
      return { key, url: `/api/files/${encodeURIComponent(key)}` };
    },
    async getBlob(key) {
      return files.get(key) || null;
    },
  };
}

async function withServer(server, fn) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function waitFor(predicate, { timeoutMs = 1000, intervalMs = 10 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  assert.fail("timed out waiting for condition");
}

run("Prisma NotificationPreference model exposes emailOn* fields mapped to migration columns", async () => {
  const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const model = schema.match(/model NotificationPreference \{[\s\S]*?\n\}/)?.[0] || "";

  assert.match(model, /emailOnShare\s+Boolean\s+@default\(true\)\s+@map\("email_on_share"\)/);
  assert.match(model, /emailOnUpload\s+Boolean\s+@default\(false\)\s+@map\("email_on_upload"\)/);
  assert.match(model, /emailOnMention\s+Boolean\s+@default\(true\)\s+@map\("email_on_mention"\)/);
  assert.doesNotMatch(model, /\bonShare\b|\bonUpload\b|\bonMention\b/);
});

run("notification preferences API persists the emailOn* field shape", async () => {
  const secret = "notification-secret";
  const prefsByUser = new Map();
  const prisma = {
    notificationPreference: {
      async findUnique({ where }) {
        return prefsByUser.get(where.userId) || null;
      },
      async upsert({ where, create, update }) {
        const previous = prefsByUser.get(where.userId) || {};
        const row = { ...previous, ...create, ...update };
        prefsByUser.set(where.userId, row);
        return row;
      },
    },
  };
  const server = createApiServer({ authSecret: secret, prisma, rateLimit: null });

  await withServer(server, async (base) => {
    const patch = await fetch(`${base}/api/notification-preferences`, {
      method: "PATCH",
      headers: { Authorization: bearer(secret), "Content-Type": "application/json" },
      body: JSON.stringify({ emailOnShare: false, emailOnUpload: true, emailOnMention: false }),
    });
    assert.equal(patch.status, 200);
    const patched = await patch.json();
    assert.equal(patched.ok, true);
    assert.deepEqual(
      {
        emailOnShare: patched.prefs.emailOnShare,
        emailOnUpload: patched.prefs.emailOnUpload,
        emailOnMention: patched.prefs.emailOnMention,
      },
      { emailOnShare: false, emailOnUpload: true, emailOnMention: false }
    );

    const get = await fetch(`${base}/api/notification-preferences`, {
      headers: { Authorization: bearer(secret) },
    });
    assert.equal(get.status, 200);
    const loaded = await get.json();
    assert.deepEqual(
      {
        emailOnShare: loaded.prefs.emailOnShare,
        emailOnUpload: loaded.prefs.emailOnUpload,
        emailOnMention: loaded.prefs.emailOnMention,
      },
      { emailOnShare: false, emailOnUpload: true, emailOnMention: false }
    );
  });
});

run("share email notification resolves recipient email and respects share preference", async () => {
  const sent = [];
  const preferences = new Map([
    ["enabled-user", { emailOnShare: true, emailOnUpload: false, emailOnMention: true }],
    ["disabled-user", { emailOnShare: false, emailOnUpload: false, emailOnMention: true }],
  ]);
  const users = new Map([
    ["enabled-user", { email: "enabled@example.test" }],
    ["disabled-user", { email: "disabled@example.test" }],
  ]);
  const prisma = {
    notificationPreference: {
      async findUnique({ where }) {
        return preferences.get(where.userId) || null;
      },
    },
    user: {
      async findUnique({ where, select }) {
        assert.deepEqual(select, { email: true });
        return users.get(where.id) || null;
      },
    },
  };
  const sendMail = async (message) => {
    sent.push(message);
  };

  notifyRecordShared({
    prisma,
    sendMail,
    sharedWithUserId: "disabled-user",
    sharedByUsername: "Admin",
    recordTitle: "Suppressed",
    shareUrl: "https://archive.example/share/suppressed",
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sent.length, 0);

  notifyRecordShared({
    prisma,
    sendMail,
    sharedWithUserId: "enabled-user",
    sharedByUsername: "Admin",
    recordTitle: "Shared Record",
    shareUrl: "https://archive.example/share/enabled",
  });
  await waitFor(() => sent.length === 1);

  assert.equal(sent[0].to, "enabled@example.test");
  assert.match(sent[0].subject, /Shared Record/);
  assert.match(sent[0].text, /https:\/\/archive\.example\/share\/enabled/);
});

run("upload complete email notification respects upload preference", async () => {
  const sent = [];
  const preferences = new Map([
    ["enabled-user", { emailOnShare: true, emailOnUpload: true, emailOnMention: true }],
    ["disabled-user", { emailOnShare: true, emailOnUpload: false, emailOnMention: true }],
  ]);
  const prisma = {
    notificationPreference: {
      async findUnique({ where }) {
        return preferences.get(where.userId) || null;
      },
    },
  };
  const sendMail = async (message) => {
    sent.push(message);
  };

  notifyUploadComplete({
    prisma,
    sendMail,
    userId: "disabled-user",
    userEmail: "disabled@example.test",
    recordTitle: "Suppressed Upload",
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sent.length, 0);

  notifyUploadComplete({
    prisma,
    sendMail,
    userId: "enabled-user",
    userEmail: "enabled@example.test",
    recordTitle: "Finished Upload",
  });
  await waitFor(() => sent.length === 1);

  assert.equal(sent[0].to, "enabled@example.test");
  assert.match(sent[0].subject, /Finished Upload/);
});

run("file upload completion sends email when upload preference is enabled", async () => {
  const secret = "notification-secret";
  const sent = [];
  const prisma = {
    notificationPreference: {
      async findUnique({ where }) {
        assert.equal(where.userId, "u1");
        return { emailOnShare: true, emailOnUpload: true, emailOnMention: true };
      },
    },
    user: {
      async findUnique({ where }) {
        assert.equal(where.id, "u1");
        return { email: "u1@example.test" };
      },
    },
  };
  const server = createApiServer({
    authSecret: secret,
    prisma,
    resolveFileStore: () => createFakeFileStore(),
    notificationSendMail: async (message) => sent.push(message),
    rateLimit: null,
  });

  await withServer(server, async (base) => {
    const res = await fetch(`${base}/api/files/uploads/document.pdf`, {
      method: "PUT",
      headers: { Authorization: bearer(secret), "Content-Type": "application/pdf" },
      body: "pdf bytes",
    });
    assert.equal(res.status, 200);
    await waitFor(() => sent.length === 1);
    assert.equal(sent[0].to, "u1@example.test");
    assert.match(sent[0].subject, /uploads\/document\.pdf/);
  });
});

run("mention email notification resolves recipient email and respects mention preference", async () => {
  const sent = [];
  const preferences = new Map([
    ["enabled-user", { emailOnShare: true, emailOnUpload: false, emailOnMention: true }],
    ["disabled-user", { emailOnShare: true, emailOnUpload: false, emailOnMention: false }],
  ]);
  const users = new Map([
    ["enabled-user", { email: "enabled@example.test" }],
    ["disabled-user", { email: "disabled@example.test" }],
  ]);
  const prisma = {
    notificationPreference: {
      async findUnique({ where }) {
        return preferences.get(where.userId) || null;
      },
    },
    user: {
      async findUnique({ where }) {
        return users.get(where.id) || null;
      },
    },
  };
  const sendMail = async (message) => {
    sent.push(message);
  };

  notifyMention({
    prisma,
    sendMail,
    mentionedUserId: "disabled-user",
    mentionedByUsername: "Admin",
    recordTitle: "Suppressed Mention",
    context: "@disabled-user please review",
    url: "https://archive.example/records/suppressed",
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sent.length, 0);

  notifyMention({
    prisma,
    sendMail,
    mentionedUserId: "enabled-user",
    mentionedByUsername: "Admin",
    recordTitle: "Mentioned Record",
    context: "@enabled-user please review",
    url: "https://archive.example/records/enabled",
  });
  await waitFor(() => sent.length === 1);

  assert.equal(sent[0].to, "enabled@example.test");
  assert.match(sent[0].subject, /Mentioned Record/);
  assert.match(sent[0].text, /@enabled-user please review/);
  assert.match(sent[0].text, /https:\/\/archive\.example\/records\/enabled/);
});

// ── Web Push (§20.2) ─────────────────────────────────────────────────────────

function createFakePushPrisma({ prefs } = {}) {
  const subs = new Map(); // endpoint → row
  return {
    notificationPreference: {
      async findUnique({ where }) {
        return prefs?.get(where.userId) || null;
      },
    },
    pushSubscription: {
      async upsert({ where, create, update }) {
        const previous = subs.get(where.endpoint);
        const row = previous ? { ...previous, ...update } : { id: `ps_${subs.size + 1}`, ...create };
        subs.set(where.endpoint, row);
        return row;
      },
      async findMany({ where }) {
        return [...subs.values()].filter((row) => row.userId === where.userId);
      },
      async deleteMany({ where }) {
        let count = 0;
        for (const [endpoint, row] of subs) {
          if (where.endpoint && endpoint !== where.endpoint) continue;
          if (where.userId && row.userId !== where.userId) continue;
          subs.delete(endpoint);
          count += 1;
        }
        return { count };
      },
    },
    __subs: subs,
  };
}

run("saveSubscription validates the payload and upserts by endpoint", async () => {
  const prisma = createFakePushPrisma();
  await saveSubscription(prisma, "u1", { endpoint: "https://push.example/e1", keys: { p256dh: "p", auth: "a" } });
  assert.equal(prisma.__subs.size, 1);

  // Same endpoint re-registers (e.g. another login on the same browser) — still one row.
  await saveSubscription(prisma, "u2", { endpoint: "https://push.example/e1", keys: { p256dh: "p2", auth: "a2" } });
  assert.equal(prisma.__subs.size, 1);
  assert.equal(prisma.__subs.get("https://push.example/e1").userId, "u2");

  await assert.rejects(() => saveSubscription(prisma, "u1", { endpoint: "http://insecure", keys: { p256dh: "p", auth: "a" } }), /غير صالح/);
  await assert.rejects(() => saveSubscription(prisma, "u1", { endpoint: "https://ok", keys: {} }), /غير صالح/);
});

run("sendPushToUser delivers to every device and respects per-type prefs", async () => {
  const prefs = new Map([
    ["push-on", { pushOnShare: true, pushOnUpload: true, pushOnMention: true, pushOnSystem: true }],
    ["push-off", { pushOnShare: false, pushOnUpload: true, pushOnMention: true, pushOnSystem: true }],
  ]);
  const prisma = createFakePushPrisma({ prefs });
  await saveSubscription(prisma, "push-on", { endpoint: "https://push.example/d1", keys: { p256dh: "p", auth: "a" } });
  await saveSubscription(prisma, "push-on", { endpoint: "https://push.example/d2", keys: { p256dh: "p", auth: "a" } });
  await saveSubscription(prisma, "push-off", { endpoint: "https://push.example/d3", keys: { p256dh: "p", auth: "a" } });

  const delivered = [];
  const sendImpl = async (subscription, payload) => delivered.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload) });

  // pref off → nothing
  await new Promise((resolve) => sendPushToUser({ prisma, userId: "push-off", type: "share", title: "Suppressed", sendImpl, onDone: resolve }));
  assert.equal(delivered.length, 0);

  // pref on → both devices get the same payload
  await new Promise((resolve) => sendPushToUser({ prisma, userId: "push-on", type: "share", title: "تمت مشاركة سجل معك", url: "/share/x", sendImpl, onDone: resolve }));
  assert.equal(delivered.length, 2);
  assert.deepEqual(new Set(delivered.map((d) => d.endpoint)), new Set(["https://push.example/d1", "https://push.example/d2"]));
  assert.equal(delivered[0].payload.title, "تمت مشاركة سجل معك");
  assert.equal(delivered[0].payload.url, "/share/x");
  assert.equal(delivered[0].payload.tag, "share");
});

run("sendPushToUser aggregates identical alerts and prunes dead endpoints", async () => {
  const prefs = new Map([["agg-user", { pushOnShare: true, pushOnUpload: true, pushOnMention: true, pushOnSystem: true }]]);
  const prisma = createFakePushPrisma({ prefs });
  await saveSubscription(prisma, "agg-user", { endpoint: "https://push.example/live", keys: { p256dh: "p", auth: "a" } });
  await saveSubscription(prisma, "agg-user", { endpoint: "https://push.example/dead", keys: { p256dh: "p", auth: "a" } });

  const delivered = [];
  const sendImpl = async (subscription, payload) => {
    if (subscription.endpoint.endsWith("/dead")) {
      const err = new Error("Gone");
      err.statusCode = 410;
      throw err;
    }
    delivered.push(subscription.endpoint);
  };

  await new Promise((resolve) => sendPushToUser({ prisma, userId: "agg-user", type: "system", title: "نسخ احتياطي فشل", sendImpl, onDone: resolve }));
  assert.deepEqual(delivered, ["https://push.example/live"]);
  // 410 endpoint was pruned
  assert.equal(prisma.__subs.has("https://push.example/dead"), false);

  // identical alert inside the aggregation window → dropped
  await new Promise((resolve) => sendPushToUser({ prisma, userId: "agg-user", type: "system", title: "نسخ احتياطي فشل", sendImpl, onDone: resolve }));
  assert.deepEqual(delivered, ["https://push.example/live"]);
});

run("push HTTP routes: subscribe/unsubscribe persist rows; vapid 501 without keys", async () => {
  const secret = "notification-secret";
  const prisma = createFakePushPrisma();
  const server = createApiServer({ authSecret: secret, prisma, rateLimit: null });

  await withServer(server, async (base) => {
    // VAPID keys are not configured in this test env → 501 with guidance
    const keyRes = await fetch(`${base}/api/push/vapid-public-key`, { headers: { Authorization: bearer(secret) } });
    assert.equal(keyRes.status, 501);

    // subscribe requires auth
    const anon = await fetch(`${base}/api/push/subscribe`, { method: "POST", body: "{}" });
    assert.equal(anon.status, 401);

    const sub = await fetch(`${base}/api/push/subscribe`, {
      method: "POST",
      headers: { Authorization: bearer(secret), "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: { endpoint: "https://push.example/http1", keys: { p256dh: "p", auth: "a" } } }),
    });
    assert.equal(sub.status, 200);
    assert.equal(prisma.__subs.size, 1);
    assert.equal(prisma.__subs.get("https://push.example/http1").userId, "u1");

    const bad = await fetch(`${base}/api/push/subscribe`, {
      method: "POST",
      headers: { Authorization: bearer(secret), "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: { endpoint: "not-a-url" } }),
    });
    assert.equal(bad.status, 400);

    const unsub = await fetch(`${base}/api/push/unsubscribe`, {
      method: "POST",
      headers: { Authorization: bearer(secret), "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: "https://push.example/http1" }),
    });
    assert.equal(unsub.status, 200);
    assert.equal(prisma.__subs.size, 0);
  });
});

run("notification preferences PATCH accepts pushOn* fields", async () => {
  const secret = "notification-secret";
  const prefsByUser = new Map();
  const prisma = {
    notificationPreference: {
      async findUnique({ where }) {
        return prefsByUser.get(where.userId) || null;
      },
      async upsert({ where, create, update }) {
        const previous = prefsByUser.get(where.userId) || {};
        const row = { ...previous, ...create, ...update };
        prefsByUser.set(where.userId, row);
        return row;
      },
    },
  };
  const server = createApiServer({ authSecret: secret, prisma, rateLimit: null });

  await withServer(server, async (base) => {
    const patch = await fetch(`${base}/api/notification-preferences`, {
      method: "PATCH",
      headers: { Authorization: bearer(secret), "Content-Type": "application/json" },
      body: JSON.stringify({ pushOnShare: false, pushOnSystem: false }),
    });
    assert.equal(patch.status, 200);
    const patched = await patch.json();
    assert.equal(patched.prefs.pushOnShare, false);
    assert.equal(patched.prefs.pushOnSystem, false);
  });
});

process.on("beforeExit", () => {
  if (failures > 0) {
    console.error(`\n${failures} notification test(s) failed`);
    process.exit(1);
  }
  console.log("\nAll notification tests passed.");
});
