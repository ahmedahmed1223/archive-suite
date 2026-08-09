// Thin CLI wrapper around assembleLinuxBundle for `pnpm run
// bundle:linux-native -- --out <dir>`. Wires the real archive-laravel
// build (via Docker -- this dev machine has no local PHP/Composer, only
// docker, per repo convention) and @archive/next standalone build as
// buildLaravel/buildNext, copying each build's real output into destDir.
// Mirrors scripts/control-center/windows-bundle/cli.mjs.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCli } from "../cli.mjs";
import { assembleLinuxBundle as defaultAssembleLinuxBundle } from "./assemble.mjs";

const ROOT = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const LARAVEL_RUNTIME_IMAGE = "archive-laravel-runtime-bundle";
const LARAVEL_EXCLUDE_NAMES = new Set(["tests", "docker", "Dockerfile.worker", "Dockerfile.odbc-acceptance"]);

function defaultRunCommand(command, args, options) {
  return spawnSync(command, args, { stdio: "inherit", shell: true, cwd: ROOT, ...options });
}

function pathInside(root, candidate) {
  const path = relative(resolve(root), resolve(candidate));
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

export function copyBundleTree(src, dest, excludeNames = [], { allowedRoot = src, maxEntries = 250_000 } = {}) {
  const root = resolve(allowedRoot);
  let entries = 0;
  const active = new Set();
  const expandedDependencyRoots = new Set();
  const copyEntry = (from, to) => {
    if (++entries > maxEntries) throw new Error("Bundle tree exceeds the safe materialization limit.");
    if (excludeNames.includes(from.split(sep).pop())) return;
    const metadata = lstatSync(from);
    if (metadata.isSymbolicLink()) {
      const rawTarget = readlinkSync(from);
      const target = isAbsolute(rawTarget) ? resolve(rawTarget) : resolve(dirname(from), rawTarget);
      if (!pathInside(root, target) || !existsSync(target)) throw new Error(`Bundle link escapes or is broken: ${from}`);
      if (active.has(target)) throw new Error(`Bundle tree contains a cyclic link: ${from}`);
      active.add(target);
      copyEntry(target, to);
      active.delete(target);
      const dependencyRoot = dirname(target);
      if (target.includes(`${sep}.pnpm${sep}`) && !expandedDependencyRoots.has(dependencyRoot)) {
        expandedDependencyRoots.add(dependencyRoot);
        for (const peer of readdirSync(dependencyRoot)) {
          const peerSource = join(dependencyRoot, peer);
          if (resolve(peerSource) !== resolve(target)) copyEntry(peerSource, join(dirname(to), peer));
        }
      }
      return;
    }
    if (metadata.isDirectory()) {
      mkdirSync(to, { recursive: true });
      for (const entry of readdirSync(from)) copyEntry(join(from, entry), join(to, entry));
      return;
    }
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to, { force: true });
  };
  copyEntry(resolve(src), resolve(dest));
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
  copyTree = copyBundleTree,
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
    const copyNext = copyTree === copyBundleTree
      ? (source, destination) => copyBundleTree(source, destination, [], { allowedRoot: standaloneRoot })
      : copyTree;
    copyNext(join(standaloneRoot, "archive-next"), destDir);
    const standaloneNodeModules = join(standaloneRoot, "node_modules");
    if (pathExists(standaloneNodeModules)) copyNext(standaloneNodeModules, join(destDir, "node_modules"));
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
