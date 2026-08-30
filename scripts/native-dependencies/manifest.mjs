import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SHA256 = /^[a-f0-9]{64}$/i;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const EXPECTED_IDS = [
  "windows-postgres",
  "windows-pgvector",
  "windows-redis",
  "linux-postgres",
  "linux-pgvector",
  "linux-redis",
];

export function loadDependencySources(path = resolve(ROOT, "infra/native-dependencies/sources.v1.json")) {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(parsed.schemaVersion, "1.0", "Native dependency source manifest schema must be 1.0.");
  assert.ok(Array.isArray(parsed.sources), "Native dependency source manifest must contain sources.");
  assert.deepEqual(parsed.sources.map(({ id }) => id), EXPECTED_IDS, "Native dependency source IDs must be complete and ordered.");

  for (const source of parsed.sources) {
    assert.match(source.url ?? "", /^https:\/\//, `${source.id}: source URL must use HTTPS.`);
    assert.match(source.sha256 ?? "", SHA256, `${source.id}: source SHA-256 must be exact.`);
    assert.ok(source.platform === "windows" || source.platform === "linux", `${source.id}: platform must be Windows or Linux.`);
    assert.ok(source.version && source.license && source.archive, `${source.id}: version, license, and archive are required.`);
  }

  return parsed.sources;
}
