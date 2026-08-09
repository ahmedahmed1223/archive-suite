// Produces the exact directory layout linux-host-effects.mjs and
// linux-services.mjs already assume. Mirrors infra/offline/install.sh's
// SHA256SUMS pattern (sha256sum --check).
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readlinkSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { stagePhpRuntime } from "./stage-php.mjs";
import { stageNodeRuntime } from "./stage-node.mjs";
import { stageCaddyRuntime } from "./stage-caddy.mjs";

function listFilesRecursive(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(path));
    else out.push(path);
  }
  return out;
}

function bundleEntryDigest(path) {
  if (!lstatSync(path).isSymbolicLink()) {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  }
  const target = readlinkSync(path).replaceAll("\\", "/");
  return createHash("sha256").update(`symlink\0${target}`).digest("hex");
}

export async function assembleLinuxBundle({
  outDir,
  stagePhp = stagePhpRuntime,
  stageNode = stageNodeRuntime,
  stageCaddy = stageCaddyRuntime,
  buildLaravel,
  buildNext,
} = {}) {
  if (typeof outDir !== "string" || !outDir.trim()) throw new Error("assembleLinuxBundle requires outDir.");
  if (typeof buildLaravel !== "function" || typeof buildNext !== "function") throw new Error("assembleLinuxBundle requires buildLaravel and buildNext callbacks.");

  mkdirSync(outDir, { recursive: true });
  await stagePhp({ destDir: join(outDir, "runtime", "php") });
  await stageNode({ destDir: join(outDir, "runtime", "node") });
  await stageCaddy({ destDir: join(outDir, "runtime", "caddy") });
  await buildLaravel({ destDir: join(outDir, "app", "laravel") });
  await buildNext({ destDir: join(outDir, "app", "next") });
  mkdirSync(join(outDir, "config"), { recursive: true });
  mkdirSync(join(outDir, "storage"), { recursive: true });
  mkdirSync(join(outDir, "logs"), { recursive: true });

  const shasumsPath = join(outDir, "SHA256SUMS");
  const lines = listFilesRecursive(outDir)
    .filter((path) => path !== shasumsPath && statSync(path).isFile())
    // SHA256SUMS describes a Linux bundle layout regardless of which OS
    // assembled it -- normalize to forward slashes so sha256sum --check
    // on the target host matches paths built on Windows too.
    .map((path) => `${bundleEntryDigest(path)}  ${relative(outDir, path).split("\\").join("/")}`)
    .sort();
  writeFileSync(shasumsPath, lines.join("\n") + "\n", "utf8");

  return { ok: true, shasumsPath };
}
