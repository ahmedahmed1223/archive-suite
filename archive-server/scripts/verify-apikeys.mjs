import assert from "node:assert/strict";

import { createApiServer } from "../src/api/server.js";
import { signJwt } from "../src/auth/jwt.js";
import {
  hashApiKey, createApiKey, listApiKeys, revokeApiKey, verifyApiKey,
} from "../src/auth/apiKeyService.js";

// API keys (§20.5) tests — service + HTTP management + public read, all offline.

let failures = 0;
function run(name, fn) {
  Promise.resolve().then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((err) => { failures += 1; console.error(`not ok - ${name}\n  ${err.stack || err.message}`); });
}

const SECRET = "apikey-secret";
const bearer = (sub = "u1", role = "admin") => `Bearer ${signJwt({ sub, username: "admin", role }, SECRET)}`;

function fakeApiKeyPrisma() {
  const rows = new Map(); // id → row
  let seq = 0;
  return {
    apiKey: {
      async create({ data }) {
        const row = { id: `ak_id_${++seq}`, active: true, lastUsedAt: null, createdAt: new Date(), ...data };
        rows.set(row.id, row);
        return row;
      },
      async findUnique({ where }) {
        if (where.keyHash) return [...rows.values()].find((r) => r.keyHash === where.keyHash) || null;
        return rows.get(where.id) || null;
      },
      async findMany({ where }) {
        return [...rows.values()].filter((r) => r.ownerId === where.ownerId);
      },
      async update({ where, data }) {
        const row = rows.get(where.id);
        if (row) Object.assign(row, data);
        return row;
      },
      async deleteMany({ where }) {
        let count = 0;
        for (const [id, row] of rows) {
          if (where.id && id !== where.id) continue;
          if (where.ownerId && row.ownerId !== where.ownerId) continue;
          rows.delete(id); count += 1;
        }
        return { count };
      },
    },
    __rows: rows,
  };
}

run("createApiKey stores only the hash and returns the plaintext once", async () => {
  const prisma = fakeApiKeyPrisma();
  const created = await createApiKey(prisma, { name: "CI reader", ownerId: "u1" });
  assert.match(created.key, /^ak_[0-9a-f]{8}_/);
  assert.equal(created.prefix, created.key.split("_").slice(0, 2).join("_"));
  assert.deepEqual(created.scopes, ["read"]);
  // stored row has the hash, never the plaintext
  const stored = [...prisma.__rows.values()][0];
  assert.equal(stored.keyHash, hashApiKey(created.key));
  assert.equal(stored.key, undefined);
});

run("createApiKey validates name and expiry", async () => {
  const prisma = fakeApiKeyPrisma();
  await assert.rejects(() => createApiKey(prisma, { name: "  ", ownerId: "u1" }), /اسم/);
  await assert.rejects(() => createApiKey(prisma, { name: "x", ownerId: "u1", expiresAt: "nope" }), /انتهاء/);
});

run("verifyApiKey honors hash, scopes→role, expiry and active flag", async () => {
  const prisma = fakeApiKeyPrisma();
  const reader = await createApiKey(prisma, { name: "r", ownerId: "u1", scopes: ["read"] });
  const writer = await createApiKey(prisma, { name: "w", ownerId: "u2", scopes: ["read", "write"] });

  const rp = await verifyApiKey(prisma, reader.key);
  assert.equal(rp.role, "viewer");
  assert.equal(rp.sub, "u1");
  const wp = await verifyApiKey(prisma, writer.key);
  assert.equal(wp.role, "editor");

  assert.equal(await verifyApiKey(prisma, "ak_deadbeef_wrong"), null);

  // expired key rejected
  const expired = await createApiKey(prisma, { name: "e", ownerId: "u1", expiresAt: new Date(Date.now() - 1000).toISOString() });
  assert.equal(await verifyApiKey(prisma, expired.key), null);
});

run("listApiKeys and revokeApiKey are owner-scoped", async () => {
  const prisma = fakeApiKeyPrisma();
  const a = await createApiKey(prisma, { name: "a", ownerId: "u1" });
  await createApiKey(prisma, { name: "b", ownerId: "u2" });
  const mine = await listApiKeys(prisma, "u1");
  assert.equal(mine.length, 1);
  assert.equal(mine[0].key, undefined); // no secret in listings

  assert.equal(await revokeApiKey(prisma, "u2", a.id), false); // not the owner
  assert.equal(await revokeApiKey(prisma, "u1", a.id), true);
  assert.equal((await listApiKeys(prisma, "u1")).length, 0);
});

run("HTTP: management routes + public read enforce auth and scopes", async () => {
  const prisma = fakeApiKeyPrisma();
  const storage = {
    async getAll(store) { return store === "video_items" ? [{ id: "v1", title: "A" }, { id: "v2", title: "B" }] : []; },
  };
  const server = createApiServer({ backend: "test", authSecret: SECRET, prisma, resolveStorage: () => storage, rateLimit: null });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    // create requires JWT
    const anon = await fetch(`${base}/api/api-keys`, { method: "POST", body: "{}" });
    assert.equal(anon.status, 401);

    const createRes = await fetch(`${base}/api/api-keys`, {
      method: "POST",
      headers: { Authorization: bearer("u1"), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "External CMS", scopes: ["read"] }),
    });
    assert.equal(createRes.status, 201);
    const { apiKey } = await createRes.json();
    assert.ok(apiKey.key, "plaintext key returned once");

    // list shows it without the secret
    const listRes = await fetch(`${base}/api/api-keys`, { headers: { Authorization: bearer("u1") } });
    const { keys } = await listRes.json();
    assert.equal(keys.length, 1);
    assert.equal(keys[0].key, undefined);

    // public read with the key works
    const pub = await fetch(`${base}/api/public/records?store=video_items&limit=1`, {
      headers: { "X-API-Key": apiKey.key },
    });
    assert.equal(pub.status, 200);
    const body = await pub.json();
    assert.equal(body.count, 2);
    assert.equal(body.records.length, 1);

    // public read without a key is 401
    const noKey = await fetch(`${base}/api/public/records?store=video_items`);
    assert.equal(noKey.status, 401);

    // SECURITY: a non-allowlisted store (e.g. users) must be refused — no
    // dumping password hashes through the public read endpoint.
    const sensitive = await fetch(`${base}/api/public/records?store=users`, {
      headers: { "X-API-Key": apiKey.key },
    });
    assert.equal(sensitive.status, 403, "public read must block non-content stores");

    // revoke, then the key no longer reads
    const delRes = await fetch(`${base}/api/api-keys/${keys[0].id}`, {
      method: "DELETE", headers: { Authorization: bearer("u1") },
    });
    assert.equal(delRes.status, 200);
    const afterRevoke = await fetch(`${base}/api/public/records?store=video_items`, {
      headers: { "X-API-Key": apiKey.key },
    });
    assert.equal(afterRevoke.status, 401);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

run("HTTP: write scope requires editor+ (viewer cannot mint write keys)", async () => {
  const prisma = fakeApiKeyPrisma();
  const server = createApiServer({ backend: "test", authSecret: SECRET, prisma, resolveStorage: () => ({ async getAll() { return []; } }), rateLimit: null });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    // viewer requesting a write-scoped key → 403
    const denied = await fetch(`${base}/api/api-keys`, {
      method: "POST",
      headers: { Authorization: bearer("vu", "viewer"), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "esc", scopes: ["read", "write"] }),
    });
    assert.equal(denied.status, 403);

    // viewer requesting read-only → allowed
    const ok = await fetch(`${base}/api/api-keys`, {
      method: "POST",
      headers: { Authorization: bearer("vu", "viewer"), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "ro", scopes: ["read"] }),
    });
    assert.equal(ok.status, 201);

    // editor requesting write → allowed
    const editorWrite = await fetch(`${base}/api/api-keys`, {
      method: "POST",
      headers: { Authorization: bearer("eu", "editor"), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "rw", scopes: ["read", "write"] }),
    });
    assert.equal(editorWrite.status, 201);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

run("HTTP: public read is throttled per API key (429 past the cap)", async () => {
  const prisma = fakeApiKeyPrisma();
  const storage = { async getAll() { return [{ id: "v1" }]; } };
  // Tiny per-key cap so the test stays fast; other limiters stay generous.
  const server = createApiServer({
    backend: "test", authSecret: SECRET, prisma, resolveStorage: () => storage,
    rateLimit: { apiKeyMax: 3, rpcMax: 1000, windowMs: 60_000 },
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const created = await fetch(`${base}/api/api-keys`, {
      method: "POST",
      headers: { Authorization: bearer("u1"), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "throttled", scopes: ["read"] }),
    });
    const { apiKey } = await created.json();
    const hit = () => fetch(`${base}/api/public/records?store=video_items`, { headers: { "X-API-Key": apiKey.key } });

    assert.equal((await hit()).status, 200);
    assert.equal((await hit()).status, 200);
    assert.equal((await hit()).status, 200);
    assert.equal((await hit()).status, 429, "4th call exceeds the per-key cap");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

process.on("beforeExit", () => {
  if (failures > 0) { console.error(`\n${failures} api-key test(s) failed`); process.exit(1); }
  else console.log("\nAll API key tests passed.");
});
