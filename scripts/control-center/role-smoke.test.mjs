import assert from "node:assert/strict";
import test from "node:test";

import { createRoleSmoke } from "./role-smoke.mjs";

test("role smoke requires anonymous denial and authenticated /auth/me acceptance without exposing the token", async () => {
  const calls = [];
  const smoke = createRoleSmoke({
    baseUrl: "http://127.0.0.1:3000",
    accessToken: "never-print-this-token",
    fetchImpl: async (_url, options = {}) => {
      calls.push(options);
      return calls.length === 1
        ? { status: 401, ok: false, json: async () => ({ ok: false }) }
        : { status: 200, ok: true, json: async () => ({ ok: true, user: { role: "admin" } }) };
    },
  });

  const result = await smoke();

  assert.equal(result.ok, true);
  assert.deepEqual(result.checkedRoles, ["anonymous-denied", "authenticated-accepted"]);
  assert.equal(calls[0].headers, undefined);
  assert.equal(calls[1].headers.Authorization, "Bearer never-print-this-token");
  assert.doesNotMatch(JSON.stringify(result), /never-print-this-token/);
});

test("role smoke fails closed when a configured token is absent or rejected", async () => {
  const missing = await createRoleSmoke({ baseUrl: "http://127.0.0.1:3000", accessToken: "", fetchImpl: async () => { throw new Error("must not fetch"); } })();
  assert.equal(missing.ok, false);
  assert.doesNotMatch(JSON.stringify(missing), /token/i);

  const rejected = await createRoleSmoke({
    baseUrl: "http://127.0.0.1:3000", accessToken: "secret", fetchImpl: async (_url, options = {}) => options.headers ? { status: 401, ok: false, json: async () => ({ ok: false }) } : { status: 401, ok: false, json: async () => ({ ok: false }) },
  })();
  assert.equal(rejected.ok, false);
  assert.doesNotMatch(JSON.stringify(rejected), /secret/);
});
