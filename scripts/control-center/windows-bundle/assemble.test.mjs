import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assembleWindowsBundle } from "./assemble.mjs";

test("assembleWindowsBundle lays out runtime/app/services/config and writes SHA256SUMS", async () => {
  const outDir = mkdtempSync(join(tmpdir(), "archive-windows-bundle-"));
  try {
    const stagePhp = async ({ destDir }) => { mkdirSync(destDir, { recursive: true }); writeFileSync(join(destDir, "php.exe"), "php"); return { ok: true }; };
    const stageNode = async ({ destDir }) => { mkdirSync(destDir, { recursive: true }); writeFileSync(join(destDir, "node.exe"), "node"); return { ok: true }; };
    const stageCaddy = async ({ destDir }) => { mkdirSync(destDir, { recursive: true }); writeFileSync(join(destDir, "caddy.exe"), "caddy"); return { ok: true }; };
    const stageWinsw = async ({ destDir }) => { mkdirSync(destDir, { recursive: true }); writeFileSync(join(destDir, "archive-http.exe"), "winsw"); return { ok: true }; };
    const stageDataServices = async ({ destDir }) => { mkdirSync(destDir, { recursive: true }); writeFileSync(join(destDir, "manifest.json"), "{\"schemaVersion\":\"1.0\"}\n"); return { ok: true, manifestPath: join(destDir, "manifest.json") }; };
    const buildLaravel = async ({ destDir }) => { mkdirSync(destDir, { recursive: true }); writeFileSync(join(destDir, "artisan"), "#!/usr/bin/env php\n"); };
    const buildNext = async ({ destDir }) => { mkdirSync(destDir, { recursive: true }); writeFileSync(join(destDir, "server.js"), "// standalone server\n"); };

    const result = await assembleWindowsBundle({ outDir, version: "1.5.1", builtAt: "2026-08-30T12:00:00Z", stagePhp, stageNode, stageCaddy, stageWinsw, stageDataServices, buildLaravel, buildNext });

    assert.equal(result.ok, true);
    assert.ok(existsSync(join(outDir, "runtime", "php", "php.exe")));
    assert.ok(existsSync(join(outDir, "runtime", "node", "node.exe")));
    assert.ok(existsSync(join(outDir, "runtime", "caddy", "caddy.exe")));
    assert.ok(existsSync(join(outDir, "services", "archive-http.exe")));
    assert.ok(existsSync(join(outDir, "data-services", "manifest.json")));
    assert.ok(existsSync(join(outDir, "app", "laravel", "artisan")));
    assert.ok(existsSync(join(outDir, "app", "next", "server.js")));
    assert.ok(existsSync(join(outDir, "install.bat")));
    assert.ok(existsSync(join(outDir, "manage.bat")));
    assert.ok(existsSync(join(outDir, "scripts", "control-center.mjs")));
    assert.ok(existsSync(join(outDir, "install.sh")));
    assert.ok(existsSync(join(outDir, "README.ar.md")));
    assert.ok(existsSync(join(outDir, "CHANGELOG.md")));
    assert.equal(JSON.parse(readFileSync(join(outDir, "RELEASE.json"), "utf8")).platform, "windows-x64");
    assert.ok(existsSync(result.shasumsPath));
    const shasums = readFileSync(result.shasumsPath, "utf8");
    assert.match(shasums, /runtime\\php\\php\.exe/);
    assert.match(shasums, /^[0-9a-f]{64}  /m);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
