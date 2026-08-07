// Thin CLI wrapper around assembleLinuxBundle for `pnpm run
// bundle:linux-native -- --out <dir>`. Wires the real archive-laravel
// build (via Docker -- this dev machine has no local PHP/Composer, only
// docker, per repo convention) and @archive/next standalone build as
// buildLaravel/buildNext, copying each build's real output into destDir.
// Mirrors scripts/control-center/windows-bundle/cli.mjs.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCli } from "../cli.mjs";
import { assembleLinuxBundle as defaultAssembleLinuxBundle } from "./assemble.mjs";

const ROOT = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const LARAVEL_RUNTIME_IMAGE = "archive-laravel-runtime-bundle";
const LARAVEL_EXCLUDE_NAMES = new Set(["tests", "docker", "Dockerfile.worker", "Dockerfile.odbc-acceptance"]);

function defaultRunCommand(command, args, options) {
  return spawnSync(command, args, { stdio: "inherit", shell: true, cwd: ROOT, ...options });
}

function defaultCopyTree(src, dest, excludeNames = []) {
  cpSync(src, dest, {
    recursive: true,
    filter: (source) => !excludeNames.includes(source.split(sep).pop()),
  });
}

function runAndCheck(runCommand, command, args, options, label) {
  const result = runCommand(command, args, options);
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}: ${result.stderr ?? ""}`);
  }
  return result;
}

export async function runBundleCli(argv, {
  assembleLinuxBundle = defaultAssembleLinuxBundle,
  runCommand = defaultRunCommand,
  copyTree = defaultCopyTree,
  pathExists = existsSync,
} = {}) {
  const { flagValue } = createCli(argv);
  const outDir = flagValue("out");
  if (!outDir) throw new Error("runBundleCli requires --out=<directory>.");

  const buildLaravel = async ({ destDir }) => {
    runAndCheck(runCommand, "docker", [
      "build", "--quiet", "--tag", LARAVEL_RUNTIME_IMAGE,
      "--file", "archive-laravel/Dockerfile.worker", "archive-laravel",
    ], {}, "docker build (laravel runtime image)");
    runAndCheck(runCommand, "docker", [
      "run", "--rm", "-v", `${ROOT}${sep}archive-laravel:/app`, "-w", "/app",
      LARAVEL_RUNTIME_IMAGE, "composer", "install", "--no-dev", "--no-interaction", "--no-progress",
    ], {}, "composer install (docker, --no-dev)");
    copyTree(join(ROOT, "archive-laravel"), destDir, [...LARAVEL_EXCLUDE_NAMES]);
  };

  const buildNext = async ({ destDir }) => {
    runAndCheck(runCommand, "pnpm", ["--filter", "@archive/next", "build"], {}, "pnpm build");
    const nextRoot = join(ROOT, "archive-next");
    const standaloneRoot = join(nextRoot, ".next", "standalone");
    copyTree(join(standaloneRoot, "archive-next"), destDir);
    const standaloneNodeModules = join(standaloneRoot, "node_modules");
    if (pathExists(standaloneNodeModules)) copyTree(standaloneNodeModules, join(destDir, "node_modules"));
    copyTree(join(nextRoot, ".next", "static"), join(destDir, ".next", "static"));
    const publicDir = join(nextRoot, "public");
    if (pathExists(publicDir)) copyTree(publicDir, join(destDir, "public"));
  };

  return assembleLinuxBundle({ outDir, buildLaravel, buildNext });
}

// pathToFileURL handles platform URL rules correctly (Windows needs
// file:///D:/... -- three slashes before the drive letter -- which a
// hand-rolled `file://${path}` string does not produce).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBundleCli(process.argv).then(
    (result) => { console.log(`Bundle assembled: ${result.shasumsPath}`); },
    (error) => { console.error(error.message); process.exit(1); }
  );
}
