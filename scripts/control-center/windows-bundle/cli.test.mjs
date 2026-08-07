import { test } from "node:test";
import assert from "node:assert/strict";
import { runBundleCli } from "./cli.mjs";

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

test("runBundleCli's default buildLaravel runs composer install against archive-laravel", async () => {
  const calls = [];
  const assembleWindowsBundle = async (options) => { await options.buildLaravel({ destDir: "D:\\out\\app\\laravel" }); return { ok: true }; };
  const runCommand = (command, args, options) => { calls.push({ command, args, options }); return { status: 0 }; };
  await runBundleCli(["node", "cli.mjs", "--out=D:\\bundle-test"], { assembleWindowsBundle, runCommand });
  assert.equal(calls[0].command, "composer");
  assert.deepEqual(calls[0].args, ["install", "--no-dev", "--working-dir=archive-laravel"]);
});

test("runBundleCli's default buildNext runs the pnpm workspace build", async () => {
  const calls = [];
  const assembleWindowsBundle = async (options) => { await options.buildNext({ destDir: "D:\\out\\app\\next" }); return { ok: true }; };
  const runCommand = (command, args, options) => { calls.push({ command, args, options }); return { status: 0 }; };
  await runBundleCli(["node", "cli.mjs", "--out=D:\\bundle-test"], { assembleWindowsBundle, runCommand });
  assert.equal(calls[0].command, "pnpm");
  assert.deepEqual(calls[0].args, ["--filter", "@archive/next", "build"]);
});

test("runBundleCli surfaces a non-zero build exit code instead of continuing silently", async () => {
  const assembleWindowsBundle = async (options) => { await options.buildLaravel({ destDir: "D:\\out\\app\\laravel" }); return { ok: true }; };
  const runCommand = () => ({ status: 1, stderr: "composer failed" });
  await assert.rejects(
    () => runBundleCli(["node", "cli.mjs", "--out=D:\\bundle-test"], { assembleWindowsBundle, runCommand }),
    /composer failed|exit code 1/i
  );
});
