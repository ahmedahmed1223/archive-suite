import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

const pkg = readJson("package.json");
const scripts = pkg.scripts || {};

assert.equal(
  scripts.dev,
  "node scripts/dev-laravel-next.mjs",
  "root dev must start the Laravel + Next.js stack"
);
assert.equal(
  scripts.build,
  "pnpm run build:next",
  "root build must build the canonical Next.js frontend"
);
assert.equal(
  scripts.verify,
  "pnpm run verify:laravel-next",
  "root verify must use the Laravel + Next.js verification gate"
);

assert.ok(
  scripts["verify:laravel"] === "node scripts/laravel-docker.mjs test",
  "Laravel verification should run through the Docker helper when local PHP is absent"
);
assert.ok(
  scripts["verify:canonical-defaults"] === "node scripts/verify-canonical-defaults.mjs",
  "canonical defaults verification should be a named root script"
);
assert.ok(
  scripts["verify:public-docs"] === "node scripts/verify-public-documentation.mjs",
  "public documentation verification should be a named root script"
);
assert.ok(
  scripts["verify:laravel-next:live"] === "node scripts/verify-next-laravel-live.mjs",
  "live Laravel/Next verification should be available as one command"
);

const readme = read("README.md");
assert.match(readme, /`archive-next\/`/);
assert.match(readme, /`archive-laravel\/`/);

console.log("ok - Laravel/Next canonical defaults");
