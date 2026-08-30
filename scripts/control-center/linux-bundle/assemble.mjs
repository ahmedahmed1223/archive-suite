// Produces the exact directory layout linux-host-effects.mjs and
// linux-services.mjs already assume. Mirrors infra/offline/install.sh's
// SHA256SUMS pattern (sha256sum --check).
import { createHash } from "node:crypto";
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, readlinkSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stagePhpRuntime } from "./stage-php.mjs";
import { stageNodeRuntime } from "./stage-node.mjs";
import { stageCaddyRuntime } from "./stage-caddy.mjs";
import { renderLinuxLauncher } from "../native-launchers.mjs";
import { createNativeReleaseMetadata, writeNativeReleaseMetadata } from "../native-release-metadata.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

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

function copyIfPresent(source, destination) {
  if (existsSync(source)) {
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination, { recursive: true, force: true });
  }
}

function stageControlCenterFiles({ destDir, rootDir, version }) {
  cpSync(join(ROOT, "scripts"), destDir, { recursive: true, filter: (source) => !source.endsWith(".test.mjs") });
  for (const directory of ["platform", "setup"]) {
    cpSync(join(ROOT, "infra", directory), join(rootDir, "infra", directory), { recursive: true });
  }
  cpSync(join(ROOT, "infra", ".env.example"), join(rootDir, "infra", ".env.example"), { force: true });
  copyIfPresent(join(ROOT, "README.md"), join(rootDir, "README.md"));
  copyIfPresent(join(ROOT, "README.ar.md"), join(rootDir, "README.ar.md"));
  copyIfPresent(join(ROOT, "docs", "native-installation.md"), join(rootDir, "docs", "native-installation.md"));
  copyIfPresent(join(ROOT, "docs", "native-installation.ar.md"), join(rootDir, "docs", "native-installation.ar.md"));
  copyIfPresent(join(ROOT, "docs", "control-center.md"), join(rootDir, "docs", "control-center.md"));
  copyIfPresent(join(ROOT, "docs", "control-center.ar.md"), join(rootDir, "docs", "control-center.ar.md"));
  const releaseNotes = join(ROOT, "docs", "release-notes", `v${version}.md`);
  const releaseNotesArabic = join(ROOT, "docs", "release-notes", `v${version}.ar.md`);
  copyIfPresent(releaseNotes, join(rootDir, "CHANGELOG.md"));
  copyIfPresent(releaseNotes, join(rootDir, "docs", "release-notes", `v${version}.md`));
  copyIfPresent(releaseNotesArabic, join(rootDir, "docs", "release-notes", `v${version}.ar.md`));
}

function writeChecksums(outDir) {
  const shasumsPath = join(outDir, "SHA256SUMS");
  const lines = listFilesRecursive(outDir)
    .filter((path) => path !== shasumsPath && statSync(path).isFile())
    .map((path) => `${bundleEntryDigest(path)}  ${relative(outDir, path).split("\\").join("/")}`)
    .sort();
  writeFileSync(shasumsPath, lines.join("\n") + "\n", "utf8");
  return shasumsPath;
}

export async function assembleLinuxBundle({
  outDir,
  stagePhp = stagePhpRuntime,
  stageNode = stageNodeRuntime,
  stageCaddy = stageCaddyRuntime,
  stageControlCenter = stageControlCenterFiles,
  stageDataServices,
  dataServices,
  version,
  builtAt = new Date().toISOString(),
  buildLaravel,
  buildNext,
} = {}) {
  if (typeof outDir !== "string" || !outDir.trim()) throw new Error("assembleLinuxBundle requires outDir.");
  if (typeof buildLaravel !== "function" || typeof buildNext !== "function") throw new Error("assembleLinuxBundle requires buildLaravel and buildNext callbacks.");

  mkdirSync(outDir, { recursive: true });
  await stagePhp({ destDir: join(outDir, "runtime", "php") });
  await stageNode({ destDir: join(outDir, "runtime", "node") });
  await stageCaddy({ destDir: join(outDir, "runtime", "caddy") });
  if (stageDataServices) await stageDataServices({ destDir: join(outDir, "data-services"), ...dataServices });
  await buildLaravel({ destDir: join(outDir, "app", "laravel") });
  await buildNext({ destDir: join(outDir, "app", "next") });
  await stageControlCenter({ destDir: join(outDir, "scripts"), rootDir: outDir, version });
  writeFileSync(join(outDir, "install.sh"), renderLinuxLauncher({ command: "install" }), "utf8");
  writeFileSync(join(outDir, "manage.sh"), renderLinuxLauncher({ command: "manage" }), "utf8");
  chmodSync(join(outDir, "install.sh"), 0o755);
  chmodSync(join(outDir, "manage.sh"), 0o755);
  mkdirSync(join(outDir, "config"), { recursive: true });
  mkdirSync(join(outDir, "storage"), { recursive: true });
  mkdirSync(join(outDir, "logs"), { recursive: true });

  if (!version) throw new Error("assembleLinuxBundle requires version.");
  const metadata = createNativeReleaseMetadata({ version, platform: "linux", builtAt });
  writeNativeReleaseMetadata({ bundlePath: outDir, metadata, writeChecksums });
  const shasumsPath = join(outDir, "SHA256SUMS");

  return { ok: true, shasumsPath };
}
