// Produces the exact directory layout windows-host-effects.mjs and
// windows-services.mjs already assume. Mirrors the existing offline-bundle
// pattern (infra/offline/install.ps1 + SHA256SUMS).
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { stagePhpRuntime } from "./stage-php.mjs";
import { stageNodeRuntime } from "./stage-node.mjs";
import { stageCaddyRuntime } from "./stage-caddy.mjs";
import { stageWindowsDataServices } from "./stage-data-services.mjs";
import { stageWinswCopies } from "./stage-winsw.mjs";

function listFilesRecursive(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(path));
    else out.push(path);
  }
  return out;
}

export async function assembleWindowsBundle({
  outDir,
  stagePhp = stagePhpRuntime,
  stageNode = stageNodeRuntime,
  stageCaddy = stageCaddyRuntime,
  stageWinsw = stageWinswCopies,
  stageDataServices = stageWindowsDataServices,
  dataServices,
  buildLaravel,
  buildNext,
} = {}) {
  if (typeof outDir !== "string" || !outDir.trim()) throw new Error("assembleWindowsBundle requires outDir.");
  if (typeof buildLaravel !== "function" || typeof buildNext !== "function") throw new Error("assembleWindowsBundle requires buildLaravel and buildNext callbacks.");

  mkdirSync(outDir, { recursive: true });
  await stagePhp({ destDir: join(outDir, "runtime", "php") });
  await stageNode({ destDir: join(outDir, "runtime", "node") });
  await stageCaddy({ destDir: join(outDir, "runtime", "caddy") });
  await stageWinsw({ destDir: join(outDir, "services") });
  await stageDataServices({ destDir: join(outDir, "data-services"), ...dataServices });
  await buildLaravel({ destDir: join(outDir, "app", "laravel") });
  await buildNext({ destDir: join(outDir, "app", "next") });
  mkdirSync(join(outDir, "config"), { recursive: true });
  mkdirSync(join(outDir, "storage"), { recursive: true });
  mkdirSync(join(outDir, "logs"), { recursive: true });

  const shasumsPath = join(outDir, "SHA256SUMS");
  const lines = listFilesRecursive(outDir)
    .filter((path) => path !== shasumsPath && statSync(path).isFile())
    .map((path) => `${createHash("sha256").update(readFileSync(path)).digest("hex")}  ${relative(outDir, path)}`)
    .sort();
  writeFileSync(shasumsPath, lines.join("\n") + "\n", "utf8");

  return { ok: true, manifestPath: join(outDir, "config"), shasumsPath };
}
