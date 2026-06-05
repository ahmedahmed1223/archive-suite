// Live end-to-end auth smoke: SPA cloud-session + token-aware cloud-http
// against an archive-server with auth ENABLED (writes to real Postgres).
// Run: API_BASE=http://127.0.0.1:8791 node scripts/smoke-cloud-auth-live.mjs

import assert from "node:assert/strict";
import { loginToCloud, getCloudToken } from "../src/bootstrap/cloudSession.js";
import { createCloudHttpProvider, CloudHttpError } from "../src/storage/adapters/cloud-http/index.js";

const baseUrl = process.env.API_BASE || "http://127.0.0.1:8791";
// In-memory storage so the test is self-contained (no real localStorage in node).
const mem = new Map();
const storage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k)
};

try {
  // 1) Without a token, the authed server must reject.
  const noAuth = createCloudHttpProvider({ baseUrl, getToken: () => "" });
  let rejected = false;
  try { await noAuth.getAll("video_items"); } catch (e) { rejected = e instanceof CloudHttpError && e.status === 401; }
  assert.equal(rejected, true, "expected 401 without token");

  // 2) Bad credentials → rejected.
  let badLogin = false;
  try { await loginToCloud({ baseUrl, username: "admin", password: "wrong", storage }); }
  catch { badLogin = true; }
  assert.equal(badLogin, true, "expected bad login to fail");

  // 3) Real login issues a token.
  const { user } = await loginToCloud({ baseUrl, username: "admin", password: "StrongPass123!", storage });
  assert.equal(user.username, "admin");
  assert.equal(user.role, "admin");
  const token = getCloudToken({ storage });
  assert.ok(token, "token stored after login");

  // 4) Token-aware adapter now writes + reads through the authed API.
  const provider = createCloudHttpProvider({ baseUrl, getToken: () => getCloudToken({ storage }) });
  await provider.clear("video_items");
  await provider.put("video_items", { id: "auth-1", title: "محميّ بـ JWT" });
  const got = await provider.get("video_items", "auth-1");
  assert.equal(got.title, "محميّ بـ JWT");
  const all = await provider.getAll("video_items");
  assert.deepEqual(all.map((r) => r.id), ["auth-1"]);

  console.log("✓ LIVE AUTH: 401-without-token + bad-login rejected + login→token + authed write/read all correct");
  console.log("  logged in as:", user.username, "(" + user.role + ")");
} catch (error) {
  console.error("✗ LIVE AUTH FAILED:", error?.message || error);
  process.exitCode = 1;
}
