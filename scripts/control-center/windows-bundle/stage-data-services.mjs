// Stages the non-secret Windows data-service payload that a release builder
// has already downloaded and verified from its upstream sources. The bundle
// manifest contains only relative artifact paths and SHA-256 values, so a
// target installer can reject incomplete or modified payloads before it runs.
import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function requireRegularFile(path, label) {
  if (typeof path !== "string" || !path.trim() || !existsSync(path) || !statSync(path).isFile() || lstatSync(path).isSymbolicLink()) {
    throw new Error(`${label} must be an existing regular file.`);
  }
  return path;
}

function listRegularFiles(root, directory = root) {
  if (!existsSync(directory) || !statSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink()) {
    throw new Error("pgvectorDirectory must be an existing non-symlink directory.");
  }
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error("pgvectorDirectory must not contain symbolic links.");
    if (entry.isDirectory()) return listRegularFiles(root, path);
    if (!entry.isFile()) throw new Error("pgvectorDirectory must contain regular files only.");
    return [path];
  });
}

export function stageWindowsDataServices({ destDir, postgresInstaller, pgvectorDirectory } = {}) {
  if (typeof destDir !== "string" || !destDir.trim()) throw new Error("stageWindowsDataServices requires destDir.");
  const installer = requireRegularFile(postgresInstaller, "postgresInstaller");
  const pgvectorFiles = listRegularFiles(pgvectorDirectory);
  if (!pgvectorFiles.length) throw new Error("pgvectorDirectory must not be empty.");

  mkdirSync(destDir, { recursive: true });
  const stagedInstaller = join(destDir, "postgresql-installer.exe");
  const stagedPgvector = join(destDir, "pgvector");
  cpSync(installer, stagedInstaller, { force: true, dereference: false });
  cpSync(pgvectorDirectory, stagedPgvector, { recursive: true, force: true, dereference: false });

  const manifest = {
    schemaVersion: "1.0",
    components: {
      postgres: { installer: "postgresql-installer.exe", sha256: sha256(stagedInstaller) },
      pgvector: {
        files: listRegularFiles(stagedPgvector)
          .map((path) => ({ path: relative(destDir, path).split(sep).join("/"), sha256: sha256(path) }))
          .sort((left, right) => left.path.localeCompare(right.path)),
      },
      pgAdmin: { bundledWith: "postgres" },
    },
  };
  const manifestPath = join(destDir, "manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { ok: true, manifestPath };
}
