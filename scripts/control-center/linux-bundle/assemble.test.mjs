import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assembleLinuxBundle } from "./assemble.mjs";
import { verifyNativeBundle } from "../../native-acceptance.mjs";

test("assembleLinuxBundle lays out runtime/app/config and writes SHA256SUMS", async () => {
  const outDir = mkdtempSync(join(tmpdir(), "archive-linux-bundle-"));
  try {
    const stagePhp = async ({ destDir }) => { mkdirSync(join(destDir, "bin"), { recursive: true }); writeFileSync(join(destDir, "bin", "php"), "php"); return { ok: true }; };
    const stageNode = async ({ destDir }) => {
      mkdirSync(join(destDir, "bin"), { recursive: true });
      writeFileSync(join(destDir, "bin", "node"), "node");
      if (process.platform !== "win32") symlinkSync("node", join(destDir, "bin", "npx"));
      return { ok: true };
    };
    const stageCaddy = async ({ destDir }) => { mkdirSync(destDir, { recursive: true }); writeFileSync(join(destDir, "caddy"), "caddy"); return { ok: true }; };
    const buildLaravel = async ({ destDir }) => { mkdirSync(destDir, { recursive: true }); writeFileSync(join(destDir, "artisan"), "#!/usr/bin/env php\n"); };
    const buildNext = async ({ destDir }) => { mkdirSync(destDir, { recursive: true }); writeFileSync(join(destDir, "server.js"), "// standalone server\n"); };

    const result = await assembleLinuxBundle({ outDir, stagePhp, stageNode, stageCaddy, buildLaravel, buildNext });

    assert.equal(result.ok, true);
    assert.ok(existsSync(join(outDir, "runtime", "php", "bin", "php")));
    assert.ok(existsSync(join(outDir, "runtime", "node", "bin", "node")));
    assert.ok(existsSync(join(outDir, "runtime", "caddy", "caddy")));
    assert.ok(existsSync(join(outDir, "app", "laravel", "artisan")));
    assert.ok(existsSync(join(outDir, "app", "next", "server.js")));
    assert.ok(existsSync(result.shasumsPath));
    const shasums = readFileSync(result.shasumsPath, "utf8");
    assert.match(shasums, /runtime\/php\/bin\/php/);
    assert.match(shasums, /^[0-9a-f]{64}  /m);
    assert.doesNotThrow(() => verifyNativeBundle(outDir));
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
