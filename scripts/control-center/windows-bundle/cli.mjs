// Thin CLI wrapper around assembleWindowsBundle for `pnpm run
// bundle:windows-native -- --out <dir>`. Wires the real archive-laravel
// build (via Docker -- this dev machine has no local PHP/Composer, only
// docker, per repo convention) and @archive/next standalone build as
// buildLaravel/buildNext, copying each build's real output into destDir.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCli } from "../cli.mjs";
import { assembleWindowsBundle as defaultAssembleWindowsBundle } from "./assemble.mjs";

const ROOT = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const LARAVEL_RUNTIME_IMAGE = "archive-laravel-runtime-bundle";
const LARAVEL_EXCLUDE_NAMES = new Set(["tests", "docker", "Dockerfile.worker", "Dockerfile.odbc-acceptance"]);

function defaultRunCommand(command, args, options) {
  return spawnSync(command, args, { stdio: "inherit", shell: true, cwd: ROOT, ...options });
}

function defaultCopyTree(src, dest, excludeNames = []) {
  cpSync(src, dest, {
    recursive: true,
    // pnpm's node_modules is symlinks into its content-addressable store;
    // without dereference the bundle just copies those symlinks verbatim,
    // so the "bundled" app still depends on the original dev repo path
    // existing and being readable -- confirmed on a real Windows 11 host:
    // archive-next crashed with EPERM stat'ing back into the dev checkout
    // because the service account has no ACL grant there.
    dereference: true,
    filter: (source) => !excludeNames.includes(source.split(sep).pop()),
  });
}

function pathInside(root, candidate) {
  const path = relative(resolve(root), resolve(candidate));
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

// Node's recursive cpSync with dereference:true fails with EPERM while
// stat'ing nested pnpm symlinks on Windows. Resolve each link lexically
// inside Next's standalone root and copy its target into the destination,
// producing a service-account-safe tree with no retained symlinks.
export function copyDereferencedTree(source, destination, { allowedRoot = source, maxEntries = 250_000 } = {}) {
  const root = resolve(allowedRoot);
  let entries = 0;
  const active = new Set();
  const expandedDependencyRoots = new Set();
  const copyEntry = (from, to) => {
    if (++entries > maxEntries) throw new Error("Next standalone output exceeds the safe materialization limit.");
    const metadata = lstatSync(from);
    if (metadata.isSymbolicLink()) {
      const rawTarget = readlinkSync(from);
      const target = isAbsolute(rawTarget) ? resolve(rawTarget) : resolve(dirname(from), rawTarget);
      if (!pathInside(root, target) || !existsSync(target)) throw new Error(`Next standalone link escapes or is broken: ${from}`);
      if (active.has(target)) throw new Error(`Next standalone contains a cyclic link: ${from}`);
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
  copyEntry(resolve(source), resolve(destination));
}

function runAndCheck(runCommand, command, args, options, label) {
  const result = runCommand(command, args, options);
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}: ${result.stderr ?? ""}`);
  }
  return result;
}

export async function runBundleCli(argv, {
  assembleWindowsBundle = defaultAssembleWindowsBundle,
  runCommand = defaultRunCommand,
  copyTree = defaultCopyTree,
  copyStandaloneTree,
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
    const copyNext = copyStandaloneTree || (copyTree === defaultCopyTree
      ? (source, destination) => copyDereferencedTree(source, destination, { allowedRoot: ROOT })
      : copyTree);
    copyNext(join(standaloneRoot, "archive-next"), destDir);
    const standaloneNodeModules = join(standaloneRoot, "node_modules");
    if (pathExists(standaloneNodeModules)) copyNext(standaloneNodeModules, join(destDir, "node_modules"));
    copyTree(join(nextRoot, ".next", "static"), join(destDir, ".next", "static"));
    const publicDir = join(nextRoot, "public");
    if (pathExists(publicDir)) copyTree(publicDir, join(destDir, "public"));
  };

  return assembleWindowsBundle({ outDir, buildLaravel, buildNext });
}

// pathToFileURL handles platform URL rules correctly (Windows needs
// file:///D:/... -- three slashes before the drive letter -- which a
// hand-rolled `file://${path}` string does not produce, so this guard
// never fired on Windows before).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBundleCli(process.argv).then(
    (result) => { console.log(`Bundle assembled: ${result.shasumsPath}`); },
    (error) => { console.error(error.message); process.exit(1); }
  );
}
