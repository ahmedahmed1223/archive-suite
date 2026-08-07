import assert from "node:assert/strict";
import test from "node:test";

import { generateAppKey, nativeDbCredentialsFromEnv, renderCaddyfile, renderLaravelEnv } from "./windows-app-config.mjs";

test("renderCaddyfile serves plain local HTTP with API and default routes split for local/intranet access", () => {
  const caddyfile = renderCaddyfile({ installRoot: "C:\\App", access: "local" });
  assert.match(caddyfile, /auto_https off/);
  assert.match(caddyfile, /:8443 \{/);
  assert.match(caddyfile, /php_fastcgi 127\.0\.0\.1:9000/);
  assert.match(caddyfile, /reverse_proxy 127\.0\.0\.1:3000/);
  assert.match(caddyfile, /root \* C:\\App\\app\\laravel\\public/);
});

test("renderCaddyfile requires a real domain for public access instead of silently misconfiguring TLS", () => {
  assert.throws(() => renderCaddyfile({ installRoot: "C:\\App", access: "public" }), /ARCHIVE_NATIVE_DOMAIN/);
  const caddyfile = renderCaddyfile({ installRoot: "C:\\App", access: "public", domain: "archive.example.com" });
  assert.match(caddyfile, /^archive\.example\.com \{/);
  assert.doesNotMatch(caddyfile, /auto_https off/);
});

test("generateAppKey produces a fresh base64: key each time, matching Laravel's own format", () => {
  const fakeRandom = (n) => Buffer.alloc(n, 7);
  assert.equal(generateAppKey(fakeRandom), `base64:${Buffer.alloc(32, 7).toString("base64")}`);
  assert.notEqual(generateAppKey(), generateAppKey());
  assert.match(generateAppKey(), /^base64:/);
});

test("renderLaravelEnv wires the resolved external data plan and credentials, omitting redis when disabled", () => {
  const env = renderLaravelEnv({
    appKey: "base64:test",
    appUrl: "http://localhost:8443",
    dataPlan: { postgres: { kind: "external", host: "db.internal", port: 5432, database: "archive" }, queue: "database", cache: "database", redis: { enabled: false } },
    dbUsername: "archive",
    dbPassword: "s3cret",
  });
  assert.match(env, /DB_HOST=db\.internal/);
  assert.match(env, /DB_PORT=5432/);
  assert.match(env, /DB_USERNAME=archive/);
  assert.match(env, /DB_PASSWORD=s3cret/);
  assert.doesNotMatch(env, /REDIS_HOST/);
});

test("renderLaravelEnv adds Redis settings only when the plan enables it", () => {
  const env = renderLaravelEnv({
    appKey: "base64:test",
    appUrl: "http://localhost:8443",
    dataPlan: { postgres: { kind: "external", host: "db.internal", port: 5432, database: "archive" }, queue: "redis", cache: "redis", redis: { enabled: true, host: "cache.internal", port: 6379 } },
    dbUsername: "archive",
    dbPassword: "s3cret",
  });
  assert.match(env, /REDIS_HOST=cache\.internal/);
  assert.match(env, /REDIS_PORT=6379/);
  assert.match(env, /QUEUE_CONNECTION=redis/);
});

test("renderLaravelEnv requires a resolved data plan rather than writing a broken .env", () => {
  assert.throws(() => renderLaravelEnv({ appKey: "base64:test", appUrl: "http://localhost", dbUsername: "a", dbPassword: "b" }), /data plan/i);
});

test("nativeDbCredentialsFromEnv returns null without both username and password, never a half-set pair", () => {
  assert.equal(nativeDbCredentialsFromEnv({}), null);
  assert.equal(nativeDbCredentialsFromEnv({ ARCHIVE_NATIVE_POSTGRES_USERNAME: "archive" }), null);
  assert.deepEqual(
    nativeDbCredentialsFromEnv({ ARCHIVE_NATIVE_POSTGRES_USERNAME: "archive", ARCHIVE_NATIVE_POSTGRES_PASSWORD: "s3cret" }),
    { username: "archive", password: "s3cret" },
  );
});
