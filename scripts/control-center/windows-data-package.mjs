// Reads the data-services payload staged in a Windows Native bundle. This is
// deliberately separate from host effects: all paths are validated against
// the bundle root and every artifact hash is proven before an installer is
// allowed to run.
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function resolveBundleFile(root, item) {
  if (typeof item?.path !== "string" || !/^[a-z0-9][a-z0-9._/-]*$/i.test(item.path) || item.path.includes("..") || isAbsolute(item.path)) {
    throw new Error("Windows data package contains an invalid artifact path.");
  }
  if (typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(item.sha256)) {
    throw new Error("Windows data package contains an invalid artifact checksum.");
  }
  const path = resolve(root, ...item.path.split("/"));
  const traversal = relative(root, path);
  if (!traversal || traversal === ".." || traversal.startsWith(`..${sep}`) || isAbsolute(traversal)) {
    throw new Error("Windows data package artifact escapes its bundle.");
  }
  if (!existsSync(path) || !statSync(path).isFile() || lstatSync(path).isSymbolicLink()) {
    throw new Error("Windows data package artifact is missing or unsafe.");
  }
  if (sha256(path) !== item.sha256.toLowerCase()) throw new Error(`Windows data package checksum mismatch: ${item.path}`);
  return path;
}

export function readWindowsDataPackage({ dataServicesPath } = {}) {
  const root = resolve(dataServicesPath || "");
  const manifestPath = resolve(root, "manifest.json");
  if (!dataServicesPath || !existsSync(manifestPath)) throw new Error("Windows data package manifest is missing.");
  let manifest;
  try { manifest = JSON.parse(readFileSync(manifestPath, "utf8")); }
  catch { throw new Error("Windows data package manifest is invalid."); }
  if (manifest?.schemaVersion !== "1.0" || manifest?.components?.pgAdmin?.bundledWith !== "postgres") {
    throw new Error("Windows data package does not include the required PostgreSQL and pgAdmin components.");
  }
  const postgresInstaller = resolveBundleFile(root, {
    path: manifest.components?.postgres?.installer,
    sha256: manifest.components?.postgres?.sha256,
  });
  const pgvectorEntries = manifest.components?.pgvector?.files;
  if (!Array.isArray(pgvectorEntries) || pgvectorEntries.length === 0) throw new Error("Windows data package does not include pgvector files.");
  return {
    postgresInstaller,
    pgvectorFiles: pgvectorEntries.map((item) => resolveBundleFile(root, item)),
    includesPgAdmin: true,
  };
}
