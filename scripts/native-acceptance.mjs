#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const CHECKSUM_LINE = /^([a-f0-9]{64})  (.+)$/i;

const sha256File = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const sha256Value = (value) => createHash("sha256").update(value).digest("hex");

function bundleFiles(root, directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) return bundleFiles(root, absolute);
    const name = relative(root, absolute).split(sep).join("/");
    return name === "SHA256SUMS" ? [] : [name];
  });
}

function safeInventoryPath(raw) {
  const normalized = raw.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (!normalized || isAbsolute(raw) || /^[A-Za-z]:/.test(normalized) || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`Invalid checksum inventory path: ${raw}`);
  }
  return normalized;
}

const canonicalPath = (path) => existsSync(path) ? realpathSync.native(path) : resolve(path);

function isWithin(root, candidate) {
  const path = relative(canonicalPath(root), canonicalPath(candidate));
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

function isLexicallyWithin(root, candidate) {
  const path = relative(resolve(root), resolve(candidate));
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

function bundleLinks(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    if (entry.isSymbolicLink()) return [absolute];
    return entry.isDirectory() ? bundleLinks(absolute) : [];
  });
}

function rewriteBundleLinks(sourceRoot, outputRoot, linkTargetMappings) {
  const mappings = linkTargetMappings.map(({ from, to }) => {
    const targetRoot = canonicalPath(resolve(to));
    if (!isWithin(sourceRoot, targetRoot)) throw new Error("Native acceptance link mapping target must be inside the source bundle.");
    return { from: canonicalPath(resolve(from)), to: targetRoot };
  });
  for (const link of bundleLinks(outputRoot)) {
    const rawTarget = readlinkSync(link);
    const unresolvedTarget = isAbsolute(rawTarget) ? resolve(rawTarget) : resolve(dirname(link), rawTarget);
    let outputTarget;
    if (!isAbsolute(rawTarget)) {
      outputTarget = unresolvedTarget;
    } else if (isWithin(sourceRoot, unresolvedTarget)) {
      outputTarget = join(outputRoot, relative(canonicalPath(sourceRoot), canonicalPath(unresolvedTarget)));
    } else {
      const mapping = mappings.find(({ from }) => isWithin(from, unresolvedTarget));
      if (!mapping) throw new Error(`Native acceptance link target is outside the bundle and has no safe mapping: ${link}`);
      const mappedSourceTarget = join(mapping.to, relative(mapping.from, canonicalPath(unresolvedTarget)));
      outputTarget = join(outputRoot, relative(canonicalPath(sourceRoot), canonicalPath(mappedSourceTarget)));
    }
    if (!isLexicallyWithin(outputRoot, outputTarget) || !existsSync(outputTarget)) {
      throw new Error(`Native acceptance link target is outside or missing from the prepared bundle: ${link}`);
    }
    const portableTarget = relative(dirname(link), outputTarget).split(sep).join("/");
    const targetType = lstatSync(outputTarget).isDirectory() ? "dir" : "file";
    unlinkSync(link);
    symlinkSync(portableTarget, link, targetType);
  }
}

function bundleEntryDigest(root, path) {
  const metadata = lstatSync(path);
  if (!metadata.isSymbolicLink()) return sha256File(path);
  const rawTarget = readlinkSync(path);
  if (isAbsolute(rawTarget)) throw new Error(`Native bundle link must be relative: ${relative(root, path)}`);
  const target = resolve(dirname(path), rawTarget);
  if (!isLexicallyWithin(root, target) || !existsSync(target)) throw new Error(`Native bundle link escapes or is broken: ${relative(root, path)}`);
  return sha256Value(`symlink\0${rawTarget.replaceAll("\\", "/")}`);
}

function materializeAllBundleLinks(root) {
  let count = 0;
  while (true) {
    const links = bundleLinks(root);
    if (links.length === 0) return;
    for (const link of links) {
      if (++count > 10_000) throw new Error("Native acceptance bundle contains too many nested links to materialize safely.");
      const target = realpathSync.native(link);
      if (!isWithin(root, target)) throw new Error(`Native acceptance link escapes the prepared bundle: ${link}`);
      const isDirectory = lstatSync(target).isDirectory();
      unlinkSync(link);
      cpSync(target, link, { recursive: isDirectory, dereference: true });
    }
  }
}

function hoistPnpmDependencies(root) {
  const nodeModules = join(root, "app", "next", "node_modules");
  const virtualRoot = join(nodeModules, ".pnpm", "node_modules");
  if (!existsSync(virtualRoot)) return;
  const copyIfMissing = (source, destination) => {
    if (!existsSync(destination)) cpSync(source, destination, { recursive: true, dereference: true });
  };
  for (const entry of readdirSync(virtualRoot, { withFileTypes: true })) {
    const source = join(virtualRoot, entry.name);
    if (entry.name.startsWith("@") && entry.isDirectory()) {
      const scope = join(nodeModules, entry.name);
      mkdirSync(scope, { recursive: true });
      for (const child of readdirSync(source, { withFileTypes: true })) copyIfMissing(join(source, child.name), join(scope, child.name));
    } else {
      copyIfMissing(source, join(nodeModules, entry.name));
    }
  }
}

export function writeNativeBundleChecksums(bundlePath) {
  const root = resolve(bundlePath);
  const inventory = bundleFiles(root)
    .sort()
    .map((path) => `${bundleEntryDigest(root, join(root, ...path.split("/")))}  ${path}`);
  writeFileSync(join(root, "SHA256SUMS"), `${inventory.join("\n")}\n`, { mode: 0o600 });
  return inventory.length;
}

export function prepareNativeAcceptanceBundle({ sourceBundle, outDir, overlays = [], linkTargetMappings = [], linkMode = "relative" }) {
  const sourceRoot = resolve(sourceBundle);
  const outputRoot = resolve(outDir);
  if (!existsSync(sourceRoot)) throw new Error(`Native source bundle does not exist: ${sourceRoot}`);
  if (existsSync(outputRoot)) throw new Error(`Native acceptance output already exists: ${outputRoot}`);
  if (!new Set(["relative", "materialized"]).has(linkMode)) throw new Error(`Unsupported Native acceptance link mode: ${linkMode}`);

  cpSync(sourceRoot, outputRoot, { recursive: true, dereference: false, verbatimSymlinks: true });
  rewriteBundleLinks(sourceRoot, outputRoot, linkTargetMappings);
  if (linkMode === "materialized") {
    materializeAllBundleLinks(outputRoot);
    hoistPnpmDependencies(outputRoot);
    materializeAllBundleLinks(outputRoot);
  }
  for (const overlay of overlays) {
    const relativePath = safeInventoryPath(overlay.relativePath);
    const sourcePath = resolve(overlay.source);
    if (!existsSync(sourcePath)) throw new Error(`Native acceptance overlay does not exist: ${sourcePath}`);
    const destination = join(outputRoot, ...relativePath.split("/"));
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(sourcePath, destination, { recursive: true, dereference: true, force: true });
  }

  writeNativeBundleChecksums(outputRoot);
  return { ok: true, outputRoot, ...verifyNativeBundle(outputRoot) };
}

export function verifyNativeBundle(bundlePath) {
  const root = resolve(bundlePath);
  const checksumPath = join(root, "SHA256SUMS");
  if (!existsSync(checksumPath)) throw new Error("Native bundle is missing SHA256SUMS.");
  const inventory = new Map();
  for (const [index, line] of readFileSync(checksumPath, "utf8").split(/\r?\n/).filter(Boolean).entries()) {
    const parsed = CHECKSUM_LINE.exec(line);
    if (!parsed) throw new Error(`Invalid checksum inventory line ${index + 1}.`);
    const path = safeInventoryPath(parsed[2]);
    const identity = process.platform === "win32" ? path.toLowerCase() : path;
    if (inventory.has(identity)) throw new Error(`Duplicate checksum inventory path: ${path}`);
    inventory.set(identity, { path, sha256: parsed[1].toLowerCase() });
  }
  const actualFiles = bundleFiles(root).sort();
  for (const path of actualFiles) {
    const identity = process.platform === "win32" ? path.toLowerCase() : path;
    if (!inventory.has(identity)) throw new Error(`Native bundle contains an unlisted file: ${path}`);
  }
  for (const { path, sha256 } of inventory.values()) {
    const absolute = join(root, ...path.split("/"));
    if (!existsSync(absolute)) throw new Error(`Native bundle is missing an inventoried file: ${path}`);
    if (bundleEntryDigest(root, absolute) !== sha256) throw new Error(`Native bundle checksum mismatch: ${path}`);
  }
  if (actualFiles.length !== inventory.size) throw new Error("Native bundle inventory is not closed.");
  return { files: inventory.size, bundleDigest: sha256File(checksumPath) };
}

async function main() {
  const [, , platform, ...args] = process.argv;
  if (!new Set(["windows", "linux"]).has(platform)) {
    console.error("Usage: node scripts/native-acceptance.mjs <windows|linux> --bundle <path>");
    return 2;
  }
  const bundleIndex = args.indexOf("--bundle");
  const bundle = bundleIndex >= 0 ? args[bundleIndex + 1] : null;
  if (!bundle) {
    console.error("BUNDLE_REQUIRED");
    return 2;
  }
  if (platform === "windows" && !args.includes("--confirm-host-effects")) {
    console.error("HOST_EFFECTS_CONFIRMATION_REQUIRED");
    return 2;
  }
  const verified = verifyNativeBundle(bundle);
  if (args.includes("--verify-only")) {
    console.log(JSON.stringify({ ok: true, code: "BUNDLE_VERIFIED", platform, ...verified }));
    return 0;
  }
  if (platform === "windows") {
    console.error("WINDOWS_HOST_RUNNER_NOT_READY");
    return 2;
  }

  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const runIdIndex = args.indexOf("--run-id");
  const runId = runIdIndex >= 0 ? args[runIdIndex + 1] : `${Date.now().toString(36)}`;
  if (!runId || !/^[a-z0-9-]{4,32}$/i.test(runId)) throw new Error("INVALID_RUN_ID");
  const outputIndex = args.indexOf("--evidence-out");
  if (outputIndex >= 0 && !args[outputIndex + 1]) throw new Error("EVIDENCE_OUTPUT_REQUIRED");
  const evidenceOutputDir = outputIndex >= 0 ? resolve(args[outputIndex + 1]) : join(repoRoot, "docs", "evidence", "v1-211d-native");
  const commitResult = spawnSync("git", ["-c", `safe.directory=${repoRoot.replaceAll("\\", "/")}`, "rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8", stdio: "pipe" });
  const commit = commitResult.status === 0 ? commitResult.stdout.trim() : "unknown";
  const version = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).version;
  const { runLinuxNativeAcceptance } = await import("./native-acceptance/linux-runner.mjs");
  const result = await runLinuxNativeAcceptance({
    bundlePath: resolve(bundle),
    bundleDigest: verified.bundleDigest,
    runId,
    evidenceOutputDir,
    repoRoot,
    commit,
    version,
    progress: (message) => console.error(`[native-acceptance] ${message}`),
  });
  console.log(JSON.stringify({ ok: true, code: "NATIVE_ACCEPTANCE_PASSED", platform, bundleDigest: verified.bundleDigest, evidencePath: result.evidencePath }));
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  try {
    process.exitCode = await main();
  } catch (error) {
    console.error(error?.message || "NATIVE_ACCEPTANCE_FAILED");
    process.exitCode = 1;
  }
}
