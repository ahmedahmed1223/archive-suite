import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildOperatorReport, buildReadinessContract, collectOperatorSnapshot, createSupportBundle, redactText, sanitizeLogLines, secureBundleFile } from "./observability.mjs";

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

test("final bundle removes adversarial JSON, query, env, multiline, CLI and encoded secrets", () => {
  const dir = mkdtempSync(join(tmpdir(), "archive-adversarial-"));
  const secrets = ["json-secret", "nested-secret", "query-secret", "encoded-secret", "env secret value", "cli-secret", "multi-line-secret"];
  const logs = [
    JSON.stringify({ level: "error", token: secrets[0], nested: { client_secret: secrets[1] } }),
    `GET /x?access_token=${secrets[2]}&ok=1`,
    `GET /x?api_key%3D${secrets[3]}%26ok%3D1`,
    `APP_KEY = "${secrets[4]}"`,
    `tool --password ${secrets[5]} --safe yes`,
    `CLIENT_SECRET='${secrets[6]}\ncontinued'`,
  ].join("\n");
  const result = createSupportBundle({ outputDir: dir, logs: { app: logs }, config: logs, manifests: { compose: logs } });
  const serialized = readFileSync(result.path, "utf8");
  for (const secret of secrets) assert.equal(serialized.includes(secret), false, secret);
  if (process.platform !== "win32") assert.equal(statSync(result.path).mode & 0o777, 0o600);
});

test("structured log sanitizer recursively sanitizes JSON lines and preserves event shape", () => {
  const output = sanitizeLogLines('{"timestamp":"2026-07-13T10:00:00Z","level":"error","api_key":"live","nested":{"password":"pw"}}');
  const event = JSON.parse(output);
  assert.equal(event.api_key, "[REDACTED]");
  assert.equal(event.nested.password, "[REDACTED]");
  assert.equal(event.level, "error");
});

test("collector fails closed for missing/unhealthy services and failed probes", () => {
  const snapshot = collectOperatorSnapshot({
    expectedServices: ["laravel", "laravel-worker", "laravel-reverb"],
    composePs: { status: 0, stdout: JSON.stringify({ Service: "laravel", State: "running", Health: "healthy" }) },
    redis: { status: 1, stdout: "" }, logs: { status: 1, stdout: "" },
    diskUsedPercent: 20, backupAgeHours: 1, now: new Date("2026-07-13T12:00:00Z"),
  });
  assert.equal(snapshot.services["laravel-worker"], "missing");
  assert.equal(snapshot.services["laravel-reverb"], "missing");
  assert.equal(snapshot.queueDepth, null);
  assert.deepEqual(snapshot.unknown.sort(), ["logs", "redis"]);
  assert.equal(buildOperatorReport(snapshot).ok, false);
});

test("collector rejects malformed compose ps and counts timestamped error events in window", () => {
  const now = new Date("2026-07-13T12:00:00Z");
  const malformed = collectOperatorSnapshot({ expectedServices: ["laravel"], composePs: { status: 0, stdout: "{}" }, redis: { status: 0, stdout: "2" }, logs: { status: 0, stdout: "" }, diskUsedPercent: 1, backupAgeHours: 1, now });
  assert.ok(malformed.unknown.includes("docker"));
  const logs = [
    '{"timestamp":"2026-07-13T11:59:00Z","level":"error","message":"same"}',
    '{"timestamp":"2026-07-13T11:58:00Z","level":"error","message":"same"}',
    '{"timestamp":"2026-07-13T09:00:00Z","level":"error","message":"same"}',
  ].join("\n");
  const valid = collectOperatorSnapshot({ expectedServices: ["laravel"], composePs: { status: 0, stdout: '{"Service":"laravel","State":"running","Health":"healthy"}' }, redis: { status: 0, stdout: "2" }, logs: { status: 0, stdout: logs }, diskUsedPercent: 1, backupAgeHours: 1, now, errorWindowMinutes: 60 });
  assert.equal(valid.repeatedErrors, 2);
});

test("error collector parses actual Compose service prefixes and fails closed on malformed JSON events", () => {
  const base = { expectedServices: ["next"], composePs: { status: 0, stdout: '{"Service":"next","State":"running","Health":"healthy"}' }, redis: { status: 0, stdout: "0" }, diskUsedPercent: 1, backupAgeHours: 1, now: new Date("2026-07-13T12:00:00Z") };
  const prefixed = collectOperatorSnapshot({ ...base, logs: { status: 0, stdout: 'archive-ln-next | {"timestamp":"2026-07-13T11:59:00Z","level":"error","message":"failed"}' } });
  assert.equal(prefixed.repeatedErrors, 1);
  assert.equal(prefixed.unknown.includes("logs"), false);
  const malformed = collectOperatorSnapshot({ ...base, logs: { status: 0, stdout: 'archive-ln-next | {"timestamp":"broken"' } });
  assert.equal(malformed.repeatedErrors, null);
  assert.equal(malformed.unknown.includes("logs"), true);
});

test("collector accepts Docker Compose JSON arrays and marks unhealthy containers down", () => {
  const snapshot = collectOperatorSnapshot({ expectedServices: ["laravel", "laravel-worker"], composePs: { status: 0, stdout: JSON.stringify([{ Service: "laravel", State: "running", Health: "healthy" }, { Service: "laravel-worker", State: "running", Health: "unhealthy" }]) }, redis: { status: 0, stdout: "0" }, logs: { status: 0, stdout: "" }, diskUsedPercent: 1, backupAgeHours: 1 });
  assert.equal(snapshot.services.laravel, "running");
  assert.equal(snapshot.services["laravel-worker"], "unhealthy");
  assert.equal(snapshot.unknown.includes("docker"), false);
});

test("readiness combines the existing deep probe with worker and Reverb process probes", () => {
  assert.equal(buildReadinessContract({ deepHealth: { ok: true, checks: { db: true, redis: true, storage: true } }, services: { "laravel-worker": "running", "laravel-reverb": "missing" } }).ok, false);
  assert.equal(buildReadinessContract({ deepHealth: { ok: true }, services: { "laravel-worker": "running", "laravel-reverb": "running" } }).ok, true);
  assert.equal(buildReadinessContract({ deepHealth: { ok: false }, services: { "laravel-worker": "running", "laravel-reverb": "running" } }).ok, false);
});

test("Windows ACL contract fails closed when icacls cannot apply or verify owner-only access", () => {
  const oldDomain = process.env.USERDOMAIN; const oldUser = process.env.USERNAME;
  process.env.USERDOMAIN = "DOMAIN"; process.env.USERNAME = "operator";
  assert.throws(() => secureBundleFile("bundle.json", "win32", () => ({ status: 1 })), /Failed to apply/);
  let call = 0;
  assert.throws(() => secureBundleFile("bundle.json", "win32", () => ++call === 1 ? ({ status: 0 }) : ({ status: 0, stdout: "Everyone:(R)" })), /Failed to verify/);
  process.env.USERDOMAIN = oldDomain; process.env.USERNAME = oldUser;
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
  for (const name of ["docker-compose.yml", "docker-compose.laravel-next.yml"]) {
    const compose = readFileSync(new URL(`../infra/${name}`, import.meta.url), "utf8");
    const services = ["postgres", "redis", "laravel", "laravel-fpm", "laravel-worker", "ocr", "laravel-reverb", "next"];
    for (const service of services) assert.match(compose, new RegExp(`\\n  ${service}:[\\s\\S]*?\\n    logging: (?:&local-logging|\\*local-logging)`));
    assert.match(compose, /driver: "local"[\s\S]*max-size: "10m"[\s\S]*max-file: "5"/);
    assert.match(compose, /LOG_CHANNEL: stderr_json/);
  }
  const caddy = readFileSync(new URL("../infra/deploy/Caddyfile", import.meta.url), "utf8");
  assert.match(caddy, /format json/);
  assert.match(caddy, /X-Request-ID/);
  assert.match(caddy, /log_append request_id \{http\.response\.header\.X-Request-ID\}/);
  const nginx = readFileSync(new URL("../archive-laravel/docker/nginx/laravel.conf", import.meta.url), "utf8");
  assert.match(nginx, /log_format archive_json escape=json/);
  const proxy = readFileSync(new URL("../archive-next/proxy.ts", import.meta.url), "utf8");
  assert.match(proxy, /JSON\.stringify/);
  assert.match(proxy, /x-request-id/i);
  assert.match(proxy, /api\/v1/);
  const docs = readFileSync(new URL("../docs/local-observability.md", import.meta.url), "utf8");
  assert.match(docs, /10 MB[\s\S]*5 files/i);
  assert.match(docs, /200 lines[\s\S]*1 MB/i);
  const control = readFileSync(new URL("./control-center.mjs", import.meta.url), "utf8");
  assert.match(control, /\["ps", "--all", "--format", "json"\]/);
  assert.match(control, /"logs", "--tail=500", "--no-color", "--no-log-prefix"/);
  assert.match(control, /"laravel-worker"[\s\S]*"laravel-reverb"/);
});
