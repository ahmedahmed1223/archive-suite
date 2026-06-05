import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";

import { signJwt, verifyJwt } from "../src/auth/jwt.js";
import { loginUser, seedAdminIfMissing, verifySecret } from "../src/auth/authService.js";
import { createApiServer } from "../src/api/server.js";

// Auth tests — JWT round-trip + login service + HTTP enforcement, all offline.

let failures = 0;
function run(name, fn) {
  Promise.resolve().then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((err) => { failures += 1; console.error(`not ok - ${name}\n  ${err.message}`); });
}

const SECRET = "test-secret-please-change";

function fakeProviderWithUsers(users) {
  const stores = new Map([["users", new Map(users.map((u) => [u.id, u]))]]);
  return {
    async getAll(store) { return [...(stores.get(store)?.values() || [])]; },
    async put(store, rec) { if (!stores.has(store)) stores.set(store, new Map()); stores.get(store).set(rec.id, rec); return rec; },
    __stores: stores
  };
}

run("JWT sign/verify round-trip", () => {
  const token = signJwt({ sub: "u1", role: "admin" }, SECRET);
  const payload = verifyJwt(token, SECRET);
  assert.equal(payload.sub, "u1");
  assert.equal(payload.role, "admin");
  assert.ok(payload.iat && payload.exp && payload.exp > payload.iat);
});

run("JWT rejects tampered payload", () => {
  const token = signJwt({ sub: "u1", role: "viewer" }, SECRET);
  const [h, , s] = token.split(".");
  const forgedBody = Buffer.from(JSON.stringify({ sub: "u1", role: "admin", exp: 9999999999 }))
    .toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  assert.throws(() => verifyJwt(`${h}.${forgedBody}.${s}`, SECRET), /signature/i);
});

run("JWT rejects wrong secret + expired", () => {
  const token = signJwt({ sub: "u1" }, SECRET);
  assert.throws(() => verifyJwt(token, "other-secret"), /signature/i);
  const expired = signJwt({ sub: "u1" }, SECRET, { expiresInSec: -1 });
  assert.throws(() => verifyJwt(expired, SECRET), /expired/i);
});

run("verifySecret handles bcrypt + legacy sha256", async () => {
  const bhash = await bcrypt.hash("StrongPass123!", 10);
  assert.equal(await verifySecret("StrongPass123!", bhash), true);
  assert.equal(await verifySecret("wrong", bhash), false);
  const legacy = createHash("sha256").update("legacy-pw").digest("hex");
  assert.equal(await verifySecret("legacy-pw", legacy), true);
  assert.equal(await verifySecret("nope", legacy), false);
});

run("loginUser issues a token for valid credentials", async () => {
  const passwordHash = await bcrypt.hash("StrongPass123!", 10);
  const provider = fakeProviderWithUsers([
    { id: "a1", username: "admin", role: "admin", isActive: true, passwordHash }
  ]);
  const { token, user } = await loginUser({ username: "admin", password: "StrongPass123!" }, { provider, secret: SECRET });
  assert.equal(user.username, "admin");
  assert.equal(user.role, "admin");
  assert.equal(verifyJwt(token, SECRET).sub, "a1");
});

run("loginUser rejects bad password + unknown user (no enumeration)", async () => {
  const passwordHash = await bcrypt.hash("StrongPass123!", 10);
  const provider = fakeProviderWithUsers([
    { id: "a1", username: "admin", role: "admin", isActive: true, passwordHash }
  ]);
  await assert.rejects(() => loginUser({ username: "admin", password: "wrong" }, { provider, secret: SECRET }), /غير صحيحة/);
  await assert.rejects(() => loginUser({ username: "ghost", password: "x" }, { provider, secret: SECRET }), /غير صحيحة/);
});

run("seedAdminIfMissing seeds only when users empty", async () => {
  const empty = fakeProviderWithUsers([]);
  const r1 = await seedAdminIfMissing({ provider: empty, username: "root", password: "Sup3rSecret!" });
  assert.equal(r1.seeded, true);
  const users = await empty.getAll("users");
  assert.equal(users.length, 1);
  assert.equal(users[0].role, "admin");
  assert.ok(await verifySecret("Sup3rSecret!", users[0].passwordHash));
  // second call is a no-op
  const r2 = await seedAdminIfMissing({ provider: empty, username: "root2", password: "x" });
  assert.equal(r2.seeded, false);
});

run("HTTP: /api/rpc is 401 without token, 200 with valid token", async () => {
  const dispatch = async (body) => ({ echoed: body.method });
  const server = createApiServer({ backend: "test", authSecret: SECRET, dispatch });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const noAuth = await fetch(`${base}/api/rpc`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "getAll", args: ["video_items"] })
    });
    assert.equal(noAuth.status, 401);

    const token = signJwt({ sub: "u1", role: "admin" }, SECRET);
    const withAuth = await fetch(`${base}/api/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ method: "getAll", args: ["video_items"] })
    });
    assert.equal(withAuth.status, 200);
    const json = await withAuth.json();
    assert.equal(json.ok, true);

    // health advertises authRequired
    const health = await fetch(`${base}/api/health`).then((r) => r.json());
    assert.equal(health.authRequired, true);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

run("HTTP: /api/auth/login issues a usable token end-to-end", async () => {
  const passwordHash = await bcrypt.hash("StrongPass123!", 10);
  const provider = fakeProviderWithUsers([
    { id: "a1", username: "admin", role: "admin", isActive: true, passwordHash }
  ]);
  const login = (body) => loginUser(body, { provider, secret: SECRET });
  const dispatch = async () => ({ ok: true });
  const server = createApiServer({ backend: "test", authSecret: SECRET, login, dispatch });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const bad = await fetch(`${base}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "nope" })
    });
    assert.equal(bad.status, 401);

    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "StrongPass123!" })
    }).then((r) => r.json());
    assert.equal(res.ok, true);
    assert.ok(res.token);

    // the issued token is accepted by /api/rpc
    const rpc = await fetch(`${base}/api/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${res.token}` },
      body: JSON.stringify({ method: "snapshot", args: [] })
    });
    assert.equal(rpc.status, 200);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

run("HTTP: open API (no authSecret) lets /api/rpc through", async () => {
  const dispatch = async () => ({ ok: true });
  const server = createApiServer({ backend: "test", dispatch }); // no authSecret
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const res = await fetch(`${base}/api/rpc`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "getAll", args: ["x"] })
    });
    assert.equal(res.status, 200);
    const health = await fetch(`${base}/api/health`).then((r) => r.json());
    assert.equal(health.authRequired, false);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

process.on("beforeExit", () => {
  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  else console.log("\nAll auth tests passed.");
});
