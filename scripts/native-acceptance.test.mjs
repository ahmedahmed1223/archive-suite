import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { prepareNativeAcceptanceBundle, verifyNativeBundle, writeNativeBundleChecksums } from "./native-acceptance.mjs";

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

test("acceptance bundle preparation rewrites internal links as portable relative links and refreshes checksums", () => {
  const root = mkdtempSync(join(tmpdir(), "native-prepare-"));
  const source = join(root, "source");
  const target = join(source, "store", "package");
  const link = join(source, "app", "next", "node_modules", "package");
  const overlay = join(root, "filesystems.php");
  const output = join(root, "prepared");
  mkdirSync(target, { recursive: true });
  mkdirSync(join(source, "app", "next", "node_modules"), { recursive: true });
  writeFileSync(join(target, "index.js"), "self-contained\n");
  symlinkSync(target, link, "dir");
  writeFileSync(overlay, "<?php return [];\n");

  const result = prepareNativeAcceptanceBundle({
    sourceBundle: source,
    outDir: output,
    overlays: [{ source: overlay, relativePath: "app/laravel/config/filesystems.php" }],
  });

  assert.equal(result.ok, true);
  assert.equal(lstatSync(join(output, "app", "next", "node_modules", "package")).isSymbolicLink(), true);
  assert.equal(readFileSync(join(output, "app", "next", "node_modules", "package", "index.js"), "utf8"), "self-contained\n");
  assert.equal(readFileSync(join(output, "app", "laravel", "config", "filesystems.php"), "utf8"), "<?php return [];\n");
  assert.equal(existsSync(join(output, "SHA256SUMS")), true);
  assert.equal(verifyNativeBundle(output).bundleDigest, result.bundleDigest);
  assert.throws(() => prepareNativeAcceptanceBundle({ sourceBundle: source, outDir: output }), /already exists/i);
});

test("acceptance bundle preparation maps external build links back to portable internal links", () => {
  const root = mkdtempSync(join(tmpdir(), "native-prepare-links-"));
  const source = join(root, "source");
  const allowed = join(root, "allowed");
  const target = join(allowed, "package");
  const internalTarget = join(source, "store", "package");
  const nestedLink = join(source, "app", "node_modules", "package");
  mkdirSync(join(source, "app", "node_modules"), { recursive: true });
  mkdirSync(target, { recursive: true });
  mkdirSync(internalTarget, { recursive: true });
  writeFileSync(join(target, "index.js"), "external package\n");
  writeFileSync(join(internalTarget, "index.js"), "self-contained package\n");
  symlinkSync(target, nestedLink, "dir");

  assert.throws(
    () => prepareNativeAcceptanceBundle({ sourceBundle: source, outDir: join(root, "rejected") }),
    /outside the bundle|safe mapping/i,
  );

  const output = join(root, "prepared");
  const result = prepareNativeAcceptanceBundle({
    sourceBundle: source,
    outDir: output,
    linkTargetMappings: [{ from: allowed, to: join(source, "store") }],
  });
  assert.equal(lstatSync(join(output, "app", "node_modules", "package")).isSymbolicLink(), true);
  assert.equal(readFileSync(join(output, "app", "node_modules", "package", "index.js"), "utf8"), "self-contained package\n");
  assert.equal(verifyNativeBundle(output).bundleDigest, result.bundleDigest);
});

test("checksum generation refuses links that escape the bundle", () => {
  const root = mkdtempSync(join(tmpdir(), "native-link-escape-"));
  const outside = join(root, "..", "outside-package");
  mkdirSync(outside, { recursive: true });
  symlinkSync(outside, join(root, "escape"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => writeNativeBundleChecksums(root), /link.*outside|escape/i);
});

test("materialized preparation hoists pnpm dependencies for Windows-to-Linux container copy", () => {
  const root = mkdtempSync(join(tmpdir(), "native-materialized-"));
  const source = join(root, "source");
  const storePackage = join(source, "store", "package");
  const storeHelper = join(source, "store", "helper");
  const packageLink = join(source, "app", "next", "node_modules", "package");
  const helperLink = join(source, "app", "next", "node_modules", ".pnpm", "node_modules", "helper");
  mkdirSync(storePackage, { recursive: true });
  mkdirSync(storeHelper, { recursive: true });
  mkdirSync(join(source, "app", "next", "node_modules", ".pnpm", "node_modules"), { recursive: true });
  writeFileSync(join(storePackage, "index.js"), "package\n");
  writeFileSync(join(storeHelper, "index.js"), "helper\n");
  symlinkSync(storePackage, packageLink, "dir");
  symlinkSync(storeHelper, helperLink, "dir");

  const output = join(root, "prepared");
  prepareNativeAcceptanceBundle({ sourceBundle: source, outDir: output, linkMode: "materialized" });
  assert.equal(lstatSync(join(output, "app", "next", "node_modules", "package")).isSymbolicLink(), false);
  assert.equal(lstatSync(join(output, "app", "next", "node_modules", "helper")).isSymbolicLink(), false);
  assert.equal(readFileSync(join(output, "app", "next", "node_modules", "helper", "index.js"), "utf8"), "helper\n");
  assert.equal(verifyNativeBundle(output).files > 0, true);
});

test("preparation excludes runtime configuration and logs before they enter the acceptance artifact", () => {
  const root = mkdtempSync(join(tmpdir(), "native-excludes-"));
  const source = join(root, "source");
  mkdirSync(join(source, "app", "laravel"), { recursive: true });
  mkdirSync(join(source, "services"), { recursive: true });
  writeFileSync(join(source, "app", "laravel", ".env"), "DB_PASSWORD=must-not-copy\n");
  writeFileSync(join(source, "services", "archive-http.out.log"), "runtime log\n");
  writeFileSync(join(source, "app", "laravel", "artisan"), "safe\n");
  const output = join(root, "prepared");

  prepareNativeAcceptanceBundle({
    sourceBundle: source,
    outDir: output,
    excludedPaths: ["app/laravel/.env", "services/archive-http.out.log"],
  });

  assert.equal(existsSync(join(output, "app", "laravel", ".env")), false);
  assert.equal(existsSync(join(output, "services", "archive-http.out.log")), false);
  assert.equal(readFileSync(join(output, "app", "laravel", "artisan"), "utf8"), "safe\n");
  assert.doesNotMatch(readFileSync(join(output, "SHA256SUMS"), "utf8"), /\.env|\.log/);
});
