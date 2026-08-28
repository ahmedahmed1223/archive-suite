import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const PLATFORMS = new Map([["windows", "windows-x64"], ["linux", "linux-x64"]]);
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SHA256 = /^[a-f0-9]{64}$/i;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function required(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  return value.trim();
}

export function createNativeReleaseMetadata({ version, platform, archiveName, archiveSha256, builtAt } = {}) {
  const normalizedVersion = required(version, "version");
  if (!SEMVER.test(normalizedVersion)) throw new Error("version must be a semantic version without a v prefix.");
  const platformKey = required(platform, "platform");
  const platformId = PLATFORMS.get(platformKey);
  if (!platformId) throw new Error("platform must be windows or linux.");
  const name = required(archiveName, "archiveName");
  if (name.includes("/") || name.includes("\\")) throw new Error("archiveName must be a file name.");
  const sha256 = required(archiveSha256, "archiveSha256").toLowerCase();
  if (!SHA256.test(sha256)) throw new Error("archiveSha256 must be a SHA-256 digest.");
  const timestamp = required(builtAt, "builtAt");
  if (!UTC_TIMESTAMP.test(timestamp)) throw new Error("builtAt must be an ISO-8601 UTC timestamp.");
  return {
    schemaVersion: 1,
    version: normalizedVersion,
    platform: platformId,
    builtAt: timestamp,
    archive: { name, sha256 },
    releaseNotes: `docs/release-notes/v${normalizedVersion}.md`,
  };
}

export function writeNativeReleaseMetadata({ bundlePath, metadata, writeChecksums } = {}) {
  const root = resolve(required(bundlePath, "bundlePath"));
  if (!metadata || typeof metadata !== "object") throw new Error("metadata must be an object.");
  if (typeof writeChecksums !== "function") throw new Error("writeChecksums must be a function.");
  writeFileSync(join(root, "RELEASE.json"), `${JSON.stringify(metadata, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return writeChecksums(root);
}
