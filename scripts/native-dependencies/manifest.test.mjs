import assert from "node:assert/strict";
import test from "node:test";

import { loadDependencySources } from "./manifest.mjs";

test("pins six uniquely identified Native dependency sources", () => {
  const sources = loadDependencySources();

  assert.deepEqual(sources.map(({ id }) => id), [
    "windows-postgres",
    "windows-pgvector",
    "windows-redis",
    "linux-postgres",
    "linux-pgvector",
    "linux-redis",
  ]);
  assert.ok(sources.every(({ url }) => /^https:\/\//.test(url)));
  assert.ok(sources.every(({ sha256 }) => /^[a-f0-9]{64}$/i.test(sha256)));
});
