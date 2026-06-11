import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createApiServer } from "../src/api/server.js";
import { signJwt } from "../src/auth/jwt.js";
import { notifyMention, notifyRecordShared, notifyUploadComplete } from "../src/notifications/notificationService.js";

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

process.on("beforeExit", () => {
  if (failures > 0) {
    console.error(`\n${failures} notification test(s) failed`);
    process.exit(1);
  }
  console.log("\nAll notification tests passed.");
});
