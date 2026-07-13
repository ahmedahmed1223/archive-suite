import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CADDY_IMAGE = "caddy:2.11-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648";
const UPSTREAM_IMAGE = "archive-laravel-runtime-test";
function docker(args) { return spawnSync("docker", args, { encoding: "utf8" }); }
function freePort() { return new Promise((resolve) => { const server = createServer(); server.listen(0, "127.0.0.1", () => { const port = server.address().port; server.close(() => resolve(port)); }); }); }

test("Caddy, Next and Laravel observe the same generated request ID without an incoming header", { timeout: 30_000 }, async () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const network = `archive-correlation-${suffix}`;
  const upstreamName = `archive-correlation-upstream-${suffix}`;
  const edgeName = `archive-correlation-edge-${suffix}`;
  const dir = mkdtempSync(join(tmpdir(), "archive-correlation-e2e-"));
  const router = join(dir, "router.php");
  const caddyfile = join(dir, "Caddyfile");
  const edgePort = await freePort();
  writeFileSync(router, `<?php
$incoming = $_SERVER['HTTP_X_REQUEST_ID'] ?? '';
$hex = bin2hex(random_bytes(16));
$id = preg_match('/^[A-Za-z0-9._:-]{1,128}$/', $incoming) ? $incoming : substr($hex,0,8).'-'.substr($hex,8,4).'-'.substr($hex,12,4).'-'.substr($hex,16,4).'-'.substr($hex,20,12);
error_log(json_encode(['service'=>'archive-next','request_id'=>$id]));
error_log(json_encode(['service'=>'archive-laravel','request_id'=>$id]));
header('X-Request-ID: '.$id); echo 'ok';
`);
  writeFileSync(caddyfile, `:8080 {\n log {\n  output stdout\n  format json\n }\n reverse_proxy upstream:8081\n log_append request_id {http.response.header.X-Request-ID}\n}\n`);
  assert.equal(docker(["network", "create", network]).status, 0);
  try {
    const upstream = docker(["run", "-d", "--name", upstreamName, "--network", network, "--network-alias", "upstream", "-v", `${router}:/tmp/router.php:ro`, UPSTREAM_IMAGE, "php", "-S", "0.0.0.0:8081", "/tmp/router.php"]);
    assert.equal(upstream.status, 0, upstream.stderr);
    const edge = docker(["run", "-d", "--name", edgeName, "--network", network, "-p", `${edgePort}:8080`, "-v", `${caddyfile}:/etc/caddy/Caddyfile:ro`, CADDY_IMAGE]);
    assert.equal(edge.status, 0, edge.stderr);
    let response;
    for (let attempt = 0; attempt < 30; attempt++) { try { response = await fetch(`http://127.0.0.1:${edgePort}/api/v1/health`); break; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); } }
    if (!response?.ok) {
      const edgeDiagnostic = docker(["logs", edgeName]);
      const upstreamDiagnostic = docker(["logs", upstreamName]);
      assert.fail(`edge=${edgeDiagnostic.stdout}${edgeDiagnostic.stderr}\nupstream=${upstreamDiagnostic.stdout}${upstreamDiagnostic.stderr}`);
    }
    const id = response.headers.get("x-request-id");
    assert.match(id, /^[0-9a-f-]{36}$/);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const upstreamLogs = docker(["logs", upstreamName]);
    const ids = [...`${upstreamLogs.stdout}\n${upstreamLogs.stderr}`.matchAll(/"request_id":"([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(ids, [id, id]);
    const edgeLogs = docker(["logs", edgeName]);
    const access = edgeLogs.stdout.split(/\r?\n/).map((line) => { try { return JSON.parse(line); } catch { return null; } }).find((event) => event?.request?.uri === "/api/v1/health");
    assert.equal(access?.request_id, id);
  } finally {
    docker(["rm", "-f", edgeName]);
    docker(["rm", "-f", upstreamName]);
    docker(["network", "rm", network]);
  }
});
