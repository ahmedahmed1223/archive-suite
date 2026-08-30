// Reads and verifies the Linux Native data-service payload before any host
// service is created. The release builder supplies a manifest of relative
// files; this reader resolves only those files and exposes the small binary
// contract the Linux host-effects layer needs.
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function resolveBundleFile(root, item) {
  if (typeof item?.path !== "string" || !/^[a-z0-9][a-z0-9._/-]*$/i.test(item.path)
    || item.path.includes("..") || isAbsolute(item.path)) {
    throw new Error("Linux data package contains an invalid artifact path.");
  }
  if (typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(item.sha256)) {
    throw new Error("Linux data package contains an invalid artifact checksum.");
  }
  const path = resolve(root, ...item.path.split("/"));
  const traversal = relative(root, path);
  if (!traversal || traversal === ".." || traversal.startsWith(`..${sep}`) || isAbsolute(traversal)) {
    throw new Error("Linux data package artifact escapes its bundle.");
  }
  if (!existsSync(path) || !statSync(path).isFile() || lstatSync(path).isSymbolicLink()) {
    throw new Error("Linux data package artifact is missing or unsafe.");
  }
  if (sha256(path) !== item.sha256.toLowerCase()) throw new Error(`Linux data package checksum mismatch: ${item.path}`);
  return path;
}

function requireManifestFiles(root, component, name) {
  const entries = component?.files;
  if (!Array.isArray(entries) || entries.length === 0) throw new Error(`Linux data package does not include ${name} files.`);
  return entries.map((item) => ({ ...item, absolute: resolveBundleFile(root, item) }));
}

function findOne(entries, pattern, label) {
  const matches = entries.filter((item) => pattern.test(item.path));
  if (matches.length !== 1) throw new Error(`Linux data package must contain exactly one ${label}.`);
  return matches[0].absolute;
}

export function readLinuxDataPackage({ dataServicesPath } = {}) {
  const root = resolve(dataServicesPath || "");
  const manifestPath = resolve(root, "manifest.json");
  if (!dataServicesPath || !existsSync(manifestPath)) throw new Error("Linux data package manifest is missing.");
  let manifest;
  try { manifest = JSON.parse(readFileSync(manifestPath, "utf8")); }
  catch { throw new Error("Linux data package manifest is invalid."); }
  if (manifest?.schemaVersion !== "1.0" || manifest?.platform !== "linux-native") {
    throw new Error("Linux data package manifest is for an unsupported platform.");
  }

  const postgresFiles = requireManifestFiles(root, manifest.components?.postgres, "PostgreSQL");
  const pgvectorFiles = requireManifestFiles(root, manifest.components?.pgvector, "pgvector");
  const redisFiles = requireManifestFiles(root, manifest.components?.redis, "Redis-compatible");
  return {
    postgresRoot: resolve(root, "postgres"),
    postgresFiles: postgresFiles.map((item) => ({ path: item.path, absolute: item.absolute })),
    initdb: findOne(postgresFiles, /(?:^|\/)initdb(?:\.exe)?$/i, "initdb binary"),
    pgCtl: findOne(postgresFiles, /(?:^|\/)pg_ctl(?:\.exe)?$/i, "pg_ctl binary"),
    psql: findOne(postgresFiles, /(?:^|\/)psql(?:\.exe)?$/i, "psql binary"),
    pgvectorFiles: pgvectorFiles.map((item) => item.absolute),
    redisServer: findOne(redisFiles, /(?:^|\/)redis-server(?:\.exe)?$/i, "redis-server binary"),
  };
}
