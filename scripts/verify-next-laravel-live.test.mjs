import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./verify-next-laravel-live.mjs", import.meta.url), "utf8");
const screenReaderSource = readFileSync(new URL("../archive-next/e2e/screen-reader-sample.authed.spec.ts", import.meta.url), "utf8");

test("live integration mounts a container-native vendor volume", () => {
  assert.match(source, /LARAVEL_VENDOR_VOLUME = "archive-laravel-e2e-vendor"/);
  assert.match(source, /LARAVEL_VENDOR_VOLUME\}:\/app\/archive-laravel\/vendor/);
});

test("live integration repairs an incomplete vendor directory", () => {
  assert.match(source, /test -f vendor\/autoload\.php \|\| composer install/);
  assert.doesNotMatch(source, /test -d vendor \|\| composer install/);
});

test("live integration includes its authenticated visual and release acceptance gates", () => {
  assert.match(source, /"e2e\/uploads-mobile\.authed\.spec\.ts"/);
  assert.match(source, /"e2e\/phone-first-screen\.authed\.spec\.ts"/);
  assert.match(source, /"e2e\/critical-journeys-console\.authed\.spec\.ts"/);
});

test("live integration starts Reverb for realtime events", () => {
  assert.match(source, /php artisan reverb:start/);
});

test("live integration uses Laravel's testing environment to avoid test traffic throttling", () => {
  assert.match(source, /"-e",\s*"APP_ENV=testing"/);
});

test("live integration confines Playwright artifacts to the ignored temporary workspace", () => {
  assert.match(
    source,
    /PLAYWRIGHT_OUTPUT_DIR: process\.env\.PLAYWRIGHT_OUTPUT_DIR \|\| path\.join\(ROOT, "\.tmp", `playwright-live-\$\{process\.pid\}`\)/,
  );
  assert.match(
    source,
    /PLAYWRIGHT_HTML_OUTPUT_DIR: process\.env\.PLAYWRIGHT_HTML_OUTPUT_DIR \|\| path\.join\(ROOT, "\.tmp", `playwright-live-report-\$\{process\.pid\}`\)/,
  );
});

test("screen-reader evidence follows the configured Playwright output directory", () => {
  assert.match(
    screenReaderSource,
    /process\.env\.PLAYWRIGHT_OUTPUT_DIR \?\? path\.resolve\(process\.cwd\(\), 'test-results'\)/,
  );
});
