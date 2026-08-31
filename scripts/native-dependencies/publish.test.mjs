import assert from "node:assert/strict";
import test from "node:test";

import { loadClosedManifest, releaseAssetUrl, variableNamesForAssets } from "./publish.mjs";

test("maps published assets to release workflow variables", () => {
  assert.deepEqual(variableNamesForAssets(["windows-postgres", "linux-redis"]), [
    "WINDOWS_POSTGRES_URL", "WINDOWS_POSTGRES_SHA256",
    "LINUX_REDIS_URL", "LINUX_REDIS_SHA256",
  ]);
});

test("builds a GitHub release asset URL from repo, tag, and archive", () => {
  assert.equal(
    releaseAssetUrl({ repo: "acme/archive-suite", tag: "native-dependencies-v1.5.1", archive: "redis.zip" }),
    "https://github.com/acme/archive-suite/releases/download/native-dependencies-v1.5.1/redis.zip",
  );
});

test("rejects a release asset URL missing repo, tag, or archive", () => {
  assert.throws(() => releaseAssetUrl({ tag: "v1", archive: "x.zip" }), /required/i);
});

test("loads the real six-source manifest and maps it to twelve variables", () => {
  const sources = loadClosedManifest();
  assert.equal(sources.length, 6);
  assert.equal(variableNamesForAssets(sources.map(({ id }) => id)).length, 12);
});
