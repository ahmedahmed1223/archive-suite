import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

function filesIn(root, directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Linux data-service inputs must not contain symbolic links.");
    if (entry.isDirectory()) return filesIn(root, path);
    if (!entry.isFile()) throw new Error("Linux data-service inputs must contain regular files only.");
    return [path];
  });
}

function requireDirectory(path, name) {
  if (typeof path !== "string" || !path.trim() || !existsSync(path) || !statSync(path).isDirectory() || lstatSync(path).isSymbolicLink()) {
    throw new Error(`${name} must be an existing non-symlink directory.`);
  }
  if (!filesIn(path).length) throw new Error(`${name} must not be empty.`);
  return path;
}

function digest(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function stageLinuxDataServices({ destDir, postgresDirectory, pgvectorDirectory, redisDirectory } = {}) {
  if (typeof destDir !== "string" || !destDir.trim()) throw new Error("stageLinuxDataServices requires destDir.");
  const inputs = {
    postgres: requireDirectory(postgresDirectory, "postgresDirectory"),
    pgvector: requireDirectory(pgvectorDirectory, "pgvectorDirectory"),
    redis: requireDirectory(redisDirectory, "redisDirectory"),
  };
  mkdirSync(destDir, { recursive: true });
  const components = {};
  for (const [name, source] of Object.entries(inputs)) {
    const target = join(destDir, name);
    cpSync(source, target, { recursive: true, dereference: false });
    components[name] = {
      files: filesIn(target).map((path) => ({ path: relative(destDir, path).split(sep).join("/"), sha256: digest(path) })).sort((left, right) => left.path.localeCompare(right.path)),
    };
  }
  const manifestPath = join(destDir, "manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify({ schemaVersion: "1.0", platform: "linux-native", components }, null, 2)}\n`, "utf8");
  return { ok: true, manifestPath };
}
