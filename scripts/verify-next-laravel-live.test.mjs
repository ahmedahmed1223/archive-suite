import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./verify-next-laravel-live.mjs", import.meta.url), "utf8");

test("live integration mounts a container-native vendor volume", () => {
  assert.match(source, /LARAVEL_VENDOR_VOLUME = "archive-laravel-e2e-vendor"/);
  assert.match(source, /LARAVEL_VENDOR_VOLUME\}:\/app\/archive-laravel\/vendor/);
});

test("live integration repairs an incomplete vendor directory", () => {
  assert.match(source, /test -f vendor\/autoload\.php \|\| composer install/);
  assert.doesNotMatch(source, /test -d vendor \|\| composer install/);
});

test("live integration includes the authenticated visual regression gate", () => {
  assert.match(source, /"e2e\/visual-regression-authenticated\.authed\.spec\.ts"/);
});

test("live integration starts Reverb for realtime events", () => {
  assert.match(source, /php artisan reverb:start/);
});
