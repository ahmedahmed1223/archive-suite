import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildOperatorReport, createSupportBundle, redactText } from "./observability.mjs";

test("redaction removes secrets, credentials, bearer tokens, and host paths", () => {
  const input = "APP_KEY=base64:secret\nAuthorization: Bearer abc.def\npostgres://user:pass@db/archive\nD:\\archiveaq\\private\\file";
  const output = redactText(input);
  assert.doesNotMatch(output, /secret|abc\.def|user:pass|archiveaq/i);
  assert.match(output, /\[REDACTED\]/);
});

test("support bundle is bounded and contains only allow-listed diagnostics", () => {
  const dir = mkdtempSync(join(tmpdir(), "archive-support-"));
  const result = createSupportBundle({
    outputDir: dir,
    now: new Date("2026-07-13T12:00:00Z"),
    versions: { node: "v22.13.0", app: "1.0.0" },
    config: "APP_ENV=production\nAPP_KEY=hidden\nARCHIVE_PATH=/srv/archive/user-file.mov",
    health: { ok: true },
    manifests: { "compose.yml": "services:\n  app: {}" },
    logs: { laravel: Array.from({ length: 500 }, (_, i) => `line-${i}`).join("\n") },
    maxLogLines: 25,
    maxBytes: 16_384,
  });
  const bundle = JSON.parse(readFileSync(result.path, "utf8"));
  assert.deepEqual(Object.keys(bundle).sort(), ["config", "generatedAt", "health", "logs", "manifests", "schemaVersion", "versions"]);
  assert.equal(bundle.logs.laravel.split("\n").length, 25);
  assert.doesNotMatch(JSON.stringify(bundle), /hidden|user-file\.mov|\/srv\/archive/);
  assert.ok(result.bytes <= 16_384);
});

test("operator report alerts on service, queue, disk, backup, and repeated errors", () => {
  const report = buildOperatorReport({
    services: { laravel: "running", worker: "exited" }, queueDepth: 120,
    diskUsedPercent: 91, backupAgeHours: 30, repeatedErrors: 8,
  });
  assert.deepEqual(report.alerts.map((x) => x.code), ["service_down", "queue_backlog", "disk_pressure", "backup_stale", "repeated_errors"]);
  assert.equal(report.ok, false);
});

test("canonical compose and Caddy wire rotation and JSON logs", () => {
  const compose = readFileSync(new URL("../infra/docker-compose.yml", import.meta.url), "utf8");
  const services = ["postgres", "redis", "laravel", "laravel-fpm", "laravel-worker", "ocr", "laravel-reverb", "next", "caddy"];
  for (const service of services) assert.match(compose, new RegExp(`\\n  ${service}:[\\s\\S]*?\\n    logging: (?:&local-logging|\\*local-logging)`));
  assert.match(compose, /driver: "local"[\s\S]*max-size: "10m"[\s\S]*max-file: "5"/);
  assert.match(compose, /LOG_CHANNEL: stderr_json/);
  const caddy = readFileSync(new URL("../infra/deploy/Caddyfile", import.meta.url), "utf8");
  assert.match(caddy, /format json/);
  const docs = readFileSync(new URL("../docs/local-observability.md", import.meta.url), "utf8");
  assert.match(docs, /10 MB[\s\S]*5 files/i);
  assert.match(docs, /200 lines[\s\S]*1 MB/i);
});
