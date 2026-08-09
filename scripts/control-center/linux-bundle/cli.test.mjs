import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { copyBundleTree, runBundleCli } from "./cli.mjs";

// cli.mjs deals with real host filesystem paths (this machine's OS), unlike
// the Linux-target paths inside the bundle -- build expected values with
// join() so this test passes on both Windows and Linux dev machines.
const OUT_LARAVEL = join("tmp", "out", "app", "laravel");
const OUT_NEXT = join("tmp", "out", "app", "next");

function fakeRunCommand(status = 0) {
  const calls = [];
  const runCommand = (command, args, options) => { calls.push({ command, args, options }); return { status }; };
  return { runCommand, calls };
}

function fakeCopyTree() {
  const calls = [];
  const copyTree = (src, dest, excludeNames) => { calls.push({ src, dest, excludeNames }); };
  return { copyTree, calls };
}

test("runBundleCli requires --out and passes it through as outDir", async () => {
  const calls = [];
  const assembleLinuxBundle = async (options) => { calls.push(options); return { ok: true, shasumsPath: "X" }; };
  const result = await runBundleCli(["node", "cli.mjs", "--out=/tmp/bundle-test"], { assembleLinuxBundle });
  assert.equal(result.ok, true);
  assert.equal(calls[0].outDir, "/tmp/bundle-test");
  assert.equal(typeof calls[0].buildLaravel, "function");
  assert.equal(typeof calls[0].buildNext, "function");
});

test("copyBundleTree dereferences pnpm directory links so the bundle is self-contained", () => {
  const root = mkdtempSync(join(tmpdir(), "linux-bundle-copy-"));
  const source = join(root, "source");
  const target = join(source, "store", "package");
  const link = join(source, "node_modules", "package");
  const destination = join(root, "destination");
  mkdirSync(target, { recursive: true });
  mkdirSync(join(source, "node_modules"), { recursive: true });
  writeFileSync(join(target, "index.js"), "export default true;\n");
  symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");

  copyBundleTree(source, destination);

  assert.equal(lstatSync(join(destination, "node_modules", "package")).isSymbolicLink(), false);
  assert.equal(readFileSync(join(destination, "node_modules", "package", "index.js"), "utf8"), "export default true;\n");
});

test("copyBundleTree includes pnpm dependency siblings required by a linked package", () => {
  const root = mkdtempSync(join(tmpdir(), "linux-next-copy-"));
  const source = join(root, "standalone");
  const next = join(source, "node_modules", ".pnpm", "next@x", "node_modules", "next");
  const swc = join(source, "node_modules", ".pnpm", "swc@x", "node_modules", "@swc", "helpers");
  const nextPeer = join(source, "node_modules", ".pnpm", "next@x", "node_modules", "@swc", "helpers");
  const appModules = join(source, "archive-next", "node_modules");
  mkdirSync(next, { recursive: true });
  mkdirSync(swc, { recursive: true });
  mkdirSync(join(source, "node_modules", ".pnpm", "next@x", "node_modules", "@swc"), { recursive: true });
  mkdirSync(appModules, { recursive: true });
  writeFileSync(join(next, "package.json"), "{}\n");
  writeFileSync(join(swc, "index.js"), "export {};\n");
  symlinkSync(join("..", "..", "..", "swc@x", "node_modules", "@swc", "helpers"), nextPeer, "dir");
  symlinkSync(join("..", "..", "node_modules", ".pnpm", "next@x", "node_modules", "next"), join(appModules, "next"), "dir");

  const output = join(root, "output");
  copyBundleTree(join(source, "archive-next"), output, [], { allowedRoot: source });

  assert.equal(existsSync(join(output, "node_modules", "next", "package.json")), true);
  assert.equal(existsSync(join(output, "node_modules", "@swc", "helpers", "index.js")), true);
});

test("runBundleCli rejects when --out is missing", async () => {
  const assembleLinuxBundle = async () => ({ ok: true });
  await assert.rejects(
    () => runBundleCli(["node", "cli.mjs"], { assembleLinuxBundle }),
    /--out/i
  );
});

test("runBundleCli's default buildLaravel builds+runs composer via docker, then copies real output into destDir", async () => {
  const assembleLinuxBundle = async (options) => { await options.buildLaravel({ destDir: OUT_LARAVEL }); return { ok: true }; };
  const { runCommand, calls } = fakeRunCommand();
  const { copyTree, calls: copyCalls } = fakeCopyTree();
  await runBundleCli(["node", "cli.mjs", "--out=/tmp/bundle-test"], { assembleLinuxBundle, runCommand, copyTree });

  assert.equal(calls[0].command, "docker");
  assert.deepEqual(calls[0].args.slice(0, 2), ["build", "--quiet"]);
  assert.equal(calls[1].command, "docker");
  assert.deepEqual(calls[1].args.slice(0, 2), ["run", "--rm"]);
  assert.ok(calls[1].args.includes("composer"));
  assert.ok(calls[1].args.includes("--no-dev"));

  assert.equal(copyCalls.length, 1);
  assert.equal(copyCalls[0].dest, OUT_LARAVEL);
  assert.ok(copyCalls[0].src.endsWith("archive-laravel"));
  assert.ok(copyCalls[0].excludeNames.includes("tests"));
});

test("runBundleCli's default buildNext builds the pnpm workspace and copies standalone output, static, and public into destDir", async () => {
  const assembleLinuxBundle = async (options) => { await options.buildNext({ destDir: OUT_NEXT }); return { ok: true }; };
  const { runCommand, calls } = fakeRunCommand();
  const { copyTree, calls: copyCalls } = fakeCopyTree();
  await runBundleCli(["node", "cli.mjs", "--out=/tmp/bundle-test"], {
    assembleLinuxBundle, runCommand, copyTree, pathExists: () => true,
  });

  assert.equal(calls[0].command, "pnpm");
  assert.deepEqual(calls[0].args, ["--filter", "@archive/next", "build"]);

  assert.equal(copyCalls.length, 4);
  assert.equal(copyCalls[0].dest, OUT_NEXT);
  assert.ok(copyCalls[0].src.includes(`standalone${sep}archive-next`));
  assert.equal(copyCalls[1].dest, join(OUT_NEXT, "node_modules"));
  assert.equal(copyCalls[2].dest, join(OUT_NEXT, ".next", "static"));
  assert.equal(copyCalls[3].dest, join(OUT_NEXT, "public"));
});

test("runBundleCli's buildNext skips optional node_modules/public copies when they don't exist", async () => {
  const assembleLinuxBundle = async (options) => { await options.buildNext({ destDir: OUT_NEXT }); return { ok: true }; };
  const { runCommand } = fakeRunCommand();
  const { copyTree, calls: copyCalls } = fakeCopyTree();
  await runBundleCli(["node", "cli.mjs", "--out=/tmp/bundle-test"], {
    assembleLinuxBundle, runCommand, copyTree, pathExists: () => false,
  });

  assert.equal(copyCalls.length, 2);
  assert.equal(copyCalls[0].dest, OUT_NEXT);
  assert.equal(copyCalls[1].dest, join(OUT_NEXT, ".next", "static"));
});

test("runBundleCli surfaces a non-zero build exit code instead of continuing silently", async () => {
  const assembleLinuxBundle = async (options) => { await options.buildLaravel({ destDir: OUT_LARAVEL }); return { ok: true }; };
  const runCommand = () => ({ status: 1, stderr: "docker build failed" });
  await assert.rejects(
    () => runBundleCli(["node", "cli.mjs", "--out=/tmp/bundle-test"], { assembleLinuxBundle, runCommand }),
    /docker build failed|exit code 1/i
  );
});
