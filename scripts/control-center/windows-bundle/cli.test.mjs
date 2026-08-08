import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { copyDereferencedTree, runBundleCli } from "./cli.mjs";

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
  const assembleWindowsBundle = async (options) => { calls.push(options); return { ok: true, shasumsPath: "X" }; };
  const result = await runBundleCli(["node", "cli.mjs", "--out=D:\\bundle-test"], { assembleWindowsBundle });
  assert.equal(result.ok, true);
  assert.equal(calls[0].outDir, "D:\\bundle-test");
  assert.equal(typeof calls[0].buildLaravel, "function");
  assert.equal(typeof calls[0].buildNext, "function");
});

test("runBundleCli rejects when --out is missing", async () => {
  const assembleWindowsBundle = async () => ({ ok: true });
  await assert.rejects(
    () => runBundleCli(["node", "cli.mjs"], { assembleWindowsBundle }),
    /--out/i
  );
});

test("runBundleCli's default buildLaravel builds+runs composer via docker, then copies real output into destDir", async () => {
  const assembleWindowsBundle = async (options) => { await options.buildLaravel({ destDir: "D:\\out\\app\\laravel" }); return { ok: true }; };
  const { runCommand, calls } = fakeRunCommand();
  const { copyTree, calls: copyCalls } = fakeCopyTree();
  await runBundleCli(["node", "cli.mjs", "--out=D:\\bundle-test"], { assembleWindowsBundle, runCommand, copyTree });

  assert.equal(calls[0].command, "docker");
  assert.deepEqual(calls[0].args.slice(0, 2), ["build", "--quiet"]);
  assert.equal(calls[1].command, "docker");
  assert.deepEqual(calls[1].args.slice(0, 2), ["run", "--rm"]);
  assert.ok(calls[1].args.includes("composer"));
  assert.ok(calls[1].args.includes("--no-dev"));

  assert.equal(copyCalls.length, 1);
  assert.equal(copyCalls[0].dest, "D:\\out\\app\\laravel");
  assert.ok(copyCalls[0].src.endsWith("archive-laravel"));
  assert.ok(copyCalls[0].excludeNames.includes("tests"));
});

test("runBundleCli's default buildNext builds the pnpm workspace and copies standalone output, static, and public into destDir", async () => {
  const assembleWindowsBundle = async (options) => { await options.buildNext({ destDir: "D:\\out\\app\\next" }); return { ok: true }; };
  const { runCommand, calls } = fakeRunCommand();
  const { copyTree, calls: copyCalls } = fakeCopyTree();
  await runBundleCli(["node", "cli.mjs", "--out=D:\\bundle-test"], {
    assembleWindowsBundle, runCommand, copyTree, pathExists: () => true,
  });

  assert.equal(calls[0].command, "pnpm");
  assert.deepEqual(calls[0].args, ["--filter", "@archive/next", "build"]);

  assert.equal(copyCalls.length, 4);
  assert.equal(copyCalls[0].dest, "D:\\out\\app\\next");
  assert.ok(copyCalls[0].src.includes(`standalone${sep}archive-next`));
  assert.equal(copyCalls[1].dest, "D:\\out\\app\\next\\node_modules");
  assert.equal(copyCalls[2].dest, "D:\\out\\app\\next\\.next\\static");
  assert.equal(copyCalls[3].dest, "D:\\out\\app\\next\\public");
});

test("runBundleCli's buildNext skips optional node_modules/public copies when they don't exist", async () => {
  const assembleWindowsBundle = async (options) => { await options.buildNext({ destDir: "D:\\out\\app\\next" }); return { ok: true }; };
  const { runCommand } = fakeRunCommand();
  const { copyTree, calls: copyCalls } = fakeCopyTree();
  await runBundleCli(["node", "cli.mjs", "--out=D:\\bundle-test"], {
    assembleWindowsBundle, runCommand, copyTree, pathExists: () => false,
  });

  assert.equal(copyCalls.length, 2);
  assert.equal(copyCalls[0].dest, "D:\\out\\app\\next");
  assert.equal(copyCalls[1].dest, "D:\\out\\app\\next\\.next\\static");
});

test("runBundleCli surfaces a non-zero build exit code instead of continuing silently", async () => {
  const assembleWindowsBundle = async (options) => { await options.buildLaravel({ destDir: "D:\\out\\app\\laravel" }); return { ok: true }; };
  const runCommand = () => ({ status: 1, stderr: "docker build failed" });
  await assert.rejects(
    () => runBundleCli(["node", "cli.mjs", "--out=D:\\bundle-test"], { assembleWindowsBundle, runCommand }),
    /docker build failed|exit code 1/i
  );
});

test("copyDereferencedTree materializes nested relative pnpm links without retaining symlinks", () => {
  const root = mkdtempSync(join(tmpdir(), "windows-next-copy-"));
  const source = join(root, "standalone");
  const next = join(source, "node_modules", ".pnpm", "next@x", "node_modules", "next");
  const react = join(source, "node_modules", ".pnpm", "react@x", "node_modules", "react");
  const nextPeer = join(source, "node_modules", ".pnpm", "next@x", "node_modules", "react");
  const appModules = join(source, "archive-next", "node_modules");
  mkdirSync(next, { recursive: true });
  mkdirSync(react, { recursive: true });
  mkdirSync(appModules, { recursive: true });
  writeFileSync(join(next, "package.json"), "{}\n");
  writeFileSync(join(react, "index.js"), "export {};\n");
  symlinkSync(join("..", "..", "react@x", "node_modules", "react"), nextPeer, "dir");
  symlinkSync(join("..", "..", "node_modules", ".pnpm", "next@x", "node_modules", "next"), join(appModules, "next"), "dir");

  const output = join(root, "output");
  copyDereferencedTree(join(source, "archive-next"), output, { allowedRoot: source });

  assert.equal(existsSync(join(output, "node_modules", "next", "package.json")), true);
  assert.equal(existsSync(join(output, "node_modules", "react", "index.js")), true);
  assert.equal(lstatSync(join(output, "node_modules", "next")).isSymbolicLink(), false);
  assert.equal(lstatSync(join(output, "node_modules", "react")).isSymbolicLink(), false);
});
