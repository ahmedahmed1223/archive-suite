#!/usr/bin/env node
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const CHECKSUM_LINE = /^([a-f0-9]{64})  (.+)$/i;

const sha256File = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

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

export function writeNativeBundleChecksums(bundlePath) {
  const root = resolve(bundlePath);
  const inventory = bundleFiles(root)
    .sort()
    .map((path) => `${sha256File(join(root, ...path.split("/")))}  ${path}`);
  writeFileSync(join(root, "SHA256SUMS"), `${inventory.join("\n")}\n`, { mode: 0o600 });
  return inventory.length;
}

export function prepareNativeAcceptanceBundle({ sourceBundle, outDir, overlays = [] }) {
  const sourceRoot = resolve(sourceBundle);
  const outputRoot = resolve(outDir);
  if (!existsSync(sourceRoot)) throw new Error(`Native source bundle does not exist: ${sourceRoot}`);
  if (existsSync(outputRoot)) throw new Error(`Native acceptance output already exists: ${outputRoot}`);

  cpSync(sourceRoot, outputRoot, { recursive: true, dereference: true });
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
    if (sha256File(absolute) !== sha256) throw new Error(`Native bundle checksum mismatch: ${path}`);
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
  console.log(JSON.stringify({ ok: true, code: "BUNDLE_VERIFIED", platform, ...verified }));
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  process.exitCode = await main();
}
