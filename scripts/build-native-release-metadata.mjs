import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const ARCHIVE = /^archive-suite-v(.+)-(windows|linux)-native\.tar\.gz$/;

function filesIn(root, directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesIn(root, path);
    if (!entry.isFile() || lstatSync(path).isSymbolicLink()) throw new Error(`Release asset must be a regular file: ${path}`);
    return [path];
  });
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function buildNativeReleaseMetadata({ version, assetsRoot, builtAt = new Date().toISOString() } = {}) {
  if (typeof version !== "string" || !VERSION.test(version)) throw new Error("version must be a semantic version without a v prefix.");
  const root = resolve(assetsRoot || "");
  if (!assetsRoot || !existsSync(root)) throw new Error("assetsRoot must be an existing directory.");
  const archives = filesIn(root)
    .map((path) => ({ path, name: basename(path) }))
    .filter(({ name }) => ARCHIVE.test(name))
    .map(({ path, name }) => {
      const match = ARCHIVE.exec(name);
      if (match[1] !== version) throw new Error(`Native archive version does not match release version: ${name}`);
      return { platform: `${match[2]}-x64`, name, sha256: sha256(path), path: relative(root, path).replaceAll("\\", "/") };
    })
    .sort((left, right) => left.platform.localeCompare(right.platform));
  if (archives.length !== 2 || new Set(archives.map((archive) => archive.platform)).size !== 2) {
    throw new Error("The release requires exactly one Windows and one Linux Native archive.");
  }
  if (!/Z$/u.test(builtAt)) throw new Error("builtAt must be an ISO-8601 UTC timestamp.");
  return {
    schemaVersion: 1,
    version,
    builtAt,
    releaseNotes: `docs/release-notes/v${version}.md`,
    nativeArchives: archives,
  };
}

export function writeNativeReleaseMetadata({ outputPath, metadata } = {}) {
  if (typeof outputPath !== "string" || !outputPath.trim()) throw new Error("outputPath is required.");
  writeFileSync(resolve(outputPath), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  return resolve(outputPath);
}

async function main(argv) {
  const [version, outputPath, assetsRoot] = argv;
  if (!version || !outputPath || !assetsRoot) throw new Error("Usage: node scripts/build-native-release-metadata.mjs <version> <output> <native-assets-directory>");
  const metadata = buildNativeReleaseMetadata({ version, assetsRoot });
  writeNativeReleaseMetadata({ outputPath, metadata });
  console.log(JSON.stringify({ ok: true, outputPath: resolve(outputPath), archives: metadata.nativeArchives }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
