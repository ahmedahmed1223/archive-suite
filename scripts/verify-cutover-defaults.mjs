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
  "root build must build Next.js, not the legacy Vite SPA"
);
assert.equal(
  scripts.verify,
  "pnpm run verify:laravel-next",
  "root verify must use the Laravel + Next.js verification gate"
);

for (const name of [
  "dev:legacy",
  "build:legacy",
  "server:legacy",
  "verify:legacy",
  "typecheck:legacy",
]) {
  assert.ok(scripts[name], `legacy script ${name} should remain explicit`);
}

assert.ok(
  scripts["verify:laravel"] === "node scripts/laravel-docker.mjs test",
  "Laravel verification should run through the Docker helper when local PHP is absent"
);
assert.ok(
  scripts["verify:cutover"] === "node scripts/verify-cutover-defaults.mjs",
  "cutover verification should be a named root script"
);
assert.ok(
  scripts["verify:laravel-next:live"] === "node scripts/verify-next-laravel-live.mjs",
  "live Laravel/Next verification should be available as one command"
);

const claude = read("CLAUDE.md");
assert.match(claude, /Frontend \(canonical\).*`archive-next`/);
assert.match(claude, /Backend \(canonical\).*`archive-laravel`/);
assert.match(claude, /Legacy reference/);

const readme = read("README.md");
assert.match(readme, /archive-next\/\s+# canonical frontend/i);
assert.match(readme, /archive-laravel\/\s+# canonical backend/i);
assert.match(readme, /legacy/i);

const tasks = read("TASKS.md");
assert.match(tasks, /Laravel \+ Next\.js هما المنتج القانوني/);
assert.doesNotMatch(tasks, /5e\.2-cutover.*\[ \]/s);

const changelog = read("ChangeLog.md");
assert.match(changelog, /\[x\]\s*5e\.2-cutover/);

console.log("ok - Laravel/Next cutover defaults");
