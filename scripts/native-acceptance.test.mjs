import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { verifyNativeBundle } from "./native-acceptance.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function bundleFixture() {
  const root = mkdtempSync(join(tmpdir(), "native-bundle-"));
  mkdirSync(join(root, "nested"));
  writeFileSync(join(root, "app.txt"), "app\n");
  writeFileSync(join(root, "nested", "runtime.txt"), "runtime\n");
  writeFileSync(join(root, "SHA256SUMS"), `${sha256("app\n")}  app.txt\n${sha256("runtime\n")}  nested/runtime.txt\n`);
  return root;
}

test("bundle verifier accepts a closed checksum inventory and returns its digest", () => {
  const result = verifyNativeBundle(bundleFixture());
  assert.equal(result.files, 2);
  assert.match(result.bundleDigest, /^[a-f0-9]{64}$/);
});

test("bundle verifier rejects checksum mismatch, missing files, and unlisted files", () => {
  const mismatch = bundleFixture();
  writeFileSync(join(mismatch, "app.txt"), "changed\n");
  assert.throws(() => verifyNativeBundle(mismatch), /checksum/i);

  const extra = bundleFixture();
  writeFileSync(join(extra, "extra.txt"), "extra\n");
  assert.throws(() => verifyNativeBundle(extra), /unlisted/i);

  const missing = bundleFixture();
  writeFileSync(join(missing, "SHA256SUMS"), `${sha256("app\n")}  app.txt\n${sha256("runtime\n")}  nested/runtime.txt\n${sha256("missing\n")}  missing.txt\n`);
  assert.throws(() => verifyNativeBundle(missing), /missing/i);
});

test("bundle verifier rejects traversal and duplicate inventory entries", () => {
  const traversal = bundleFixture();
  writeFileSync(join(traversal, "SHA256SUMS"), `${sha256("app\n")}  ../app.txt\n`);
  assert.throws(() => verifyNativeBundle(traversal), /path|inventory/i);

  const duplicate = bundleFixture();
  writeFileSync(join(duplicate, "SHA256SUMS"), `${sha256("app\n")}  app.txt\n${sha256("app\n")}  app.txt\n`);
  assert.throws(() => verifyNativeBundle(duplicate), /duplicate/i);
});
