import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const containerName = `archive-laravel-e2e-${process.pid}`;
const e2eDatabasePath = `/tmp/archive-laravel-e2e-${process.pid}.sqlite`;
const e2eConfigCachePath = `/tmp/archive-laravel-e2e-${process.pid}-config.php`;
// Built from the same Dockerfile.worker as scripts/laravel-docker.mjs and the
// production images (V1-202) — composer.lock resolves league/flysystem-ftp,
// which requires ext-ftp. Plain `composer:latest` lacks it and fails
// `composer install`, so vendor/autoload.php never gets created (silent
// downstream failure: "Laravel did not become ready").
const LARAVEL_RUNTIME_IMAGE = "archive-laravel-e2e-runtime";
const LARAVEL_VENDOR_VOLUME = "archive-laravel-e2e-vendor";
const children = [];
let startedLaravelContainer = false;

function pnpmInvocation(args) {
  return process.platform === "win32"
    ? { command: "cmd.exe", args: ["/d", "/s", "/c", "pnpm", ...args] }
    : { command: "pnpm", args };
}

function spawnChild(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: false,
    ...options,
  });
  children.push({ name, child });
  child.on("error", (error) => {
    console.error(`${name} failed to start: ${error.message}`);
  });
  return child;
}

function waitForExit(child) {
  return new Promise((resolve) => {
    child.on("exit", (code, signal) => resolve({ code, signal }));
  });
}

async function runStep(name, command, args, options = {}) {
  const child = spawnChild(name, command, args, options);
  const result = await waitForExit(child);
  if (result.code !== 0) {
    throw new Error(`${name} failed with ${result.signal || result.code}`);
  }
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(String(port)));
    });
  });
}

async function waitForJson(url, label, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json().catch(() => ({}));
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${label} did not become ready at ${url}: ${lastError}`);
}

async function stopAll() {
  for (const { child } of children) {
    if (child.exitCode !== null || child.pid === undefined) continue;

    // On Windows, killing the cmd.exe wrapper alone leaves its Next.js child
    // alive. End the tree that this harness started so the live gate can
    // return a real pass/fail status instead of hanging after Playwright.
    if (process.platform === "win32") {
      await new Promise((resolve) => {
        const cleanup = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
          cwd: ROOT,
          stdio: "ignore",
          shell: false,
        });
        cleanup.on("exit", resolve);
        cleanup.on("error", resolve);
      });
    } else {
      child.kill("SIGTERM");
    }
  }
  if (!startedLaravelContainer) return;

  await new Promise((resolve) => {
    const cleanup = spawn("docker", ["rm", "-f", containerName], {
      cwd: ROOT,
      stdio: "ignore",
      shell: false,
    });
    cleanup.on("exit", resolve);
    cleanup.on("error", resolve);
  });
}

async function main() {
  const externalLaravelUrl = process.env.ARCHIVE_E2E_LARAVEL_URL?.replace(/\/$/, "");
  const useExistingLaravel =
    Boolean(externalLaravelUrl) || process.env.ARCHIVE_E2E_USE_EXISTING_LARAVEL === "1";
  const laravelPort = process.env.LARAVEL_PORT || (useExistingLaravel ? "8950" : await getFreePort());
  const nextPort = process.env.NEXT_PORT || await getFreePort();
  const laravelUrl = externalLaravelUrl || `http://127.0.0.1:${laravelPort}`;
  const nextUrl = `http://127.0.0.1:${nextPort}`;
  const apiBaseUrl = process.env.ARCHIVE_API_BASE_URL || `${laravelUrl}/api/v1`;

  console.log(`Laravel API: ${laravelUrl}`);
  console.log(`Next.js app: ${nextUrl}`);
  console.log(`Next.js API rewrite: ${apiBaseUrl}`);

  let laravel = null;
  if (useExistingLaravel) {
    console.log("Using existing Laravel server for live verification.");
  } else {
    await runStep("build-laravel-runtime", "docker", [
      "build",
      "--quiet",
      "--tag",
      LARAVEL_RUNTIME_IMAGE,
      "--file",
      "archive-laravel/Dockerfile.worker",
      "archive-laravel",
    ]);

    startedLaravelContainer = true;
    laravel = spawnChild("laravel", "docker", [
      "run",
      "--rm",
      "--name",
      containerName,
      "-v",
      `${ROOT}:/app`,
      "-v",
      `${LARAVEL_VENDOR_VOLUME}:/app/archive-laravel/vendor`,
      "-w",
      "/app/archive-laravel",
      "-p",
      `${laravelPort}:8000`,
      // The live gate generates dense, single-client API traffic that must not
      // be subject to the production-wide API limiter.
      "-e",
      "APP_ENV=testing",
      // Never run migrations or queue traffic against the repository's local
      // database.sqlite. The gate owns this per-container /tmp file and its
      // lifecycle, so a failed test cannot alter a developer's local data.
      "-e",
      `DB_DATABASE=${e2eDatabasePath}`,
      "-e",
      `APP_CONFIG_CACHE=${e2eConfigCachePath}`,
      "-e",
      "DB_CONNECTION=sqlite",
      "-e",
      "DB_QUEUE_CONNECTION=sqlite",
      // Keep HTTP session and scheduler-heartbeat cache state out of both
      // SQLite files. They are infrastructure concerns for this disposable
      // integration environment, not persistence under test.
      "-e",
      "CACHE_STORE=file",
      "-e",
      "SESSION_DRIVER=file",
      "-e",
      "QUEUE_CONNECTION=database",
      // The live gate deliberately runs the HTTP server, scheduler and a
      // database-backed queue worker against one throwaway SQLite file. WAL
      // plus a short busy timeout prevents transient writer contention from
      // stranding a claimed scheduled upload during that integration check.
      "-e",
      "DB_JOURNAL_MODE=WAL",
      "-e",
      "DB_BUSY_TIMEOUT=5000",
      "-e",
      `ARCHIVE_CORS_ORIGINS=http://127.0.0.1:${nextPort},http://localhost:${nextPort}`,
      LARAVEL_RUNTIME_IMAGE,
      "sh",
      "-lc",
      // V1-712: the scheduled-uploads live spec needs a real scheduler tick
      // (uploads:dispatch-scheduled, everyMinute()) and a real queue worker
      // actually draining scheduled-uploads — `php artisan serve` alone only
      // serves HTTP. Both run backgrounded inside this one container so the
      // due-now->completed scenario has something to complete it against.
      // `php artisan serve` strips non-whitelisted environment variables
      // before it starts PHP's built-in server. Run the Laravel router
      // directly so the server inherits this harness's isolated database,
      // cache, and session settings instead of falling back to .env.
      `test -f .env || cp .env.example .env; test -f vendor/autoload.php || composer install --no-interaction; rm -f ${e2eDatabasePath} ${e2eConfigCachePath}; touch ${e2eDatabasePath}; php artisan config:clear && php artisan migrate:fresh --seed --seeder=NextIntegrationSeeder --force && php artisan config:cache && (php artisan reverb:start &) && (php artisan schedule:work &) && (php artisan queue:work --queue=scheduled-uploads,default --tries=3 --sleep=1 &) && cd public && exec php -S 0.0.0.0:8000 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php`,
    ]);
  }

  await waitForJson(`${laravelUrl}/api/v1/health`, "Laravel");

  const nextBuildCommand = pnpmInvocation([
    "--filter",
    "@archive/next",
    "run",
    "build",
  ]);
  await runStep("next-build", nextBuildCommand.command, nextBuildCommand.args, {
    env: {
      ...process.env,
      ARCHIVE_API_BASE_URL: apiBaseUrl,
    },
  });

  const nextCommand = pnpmInvocation([
    "--filter",
    "@archive/next",
    "exec",
    "next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    nextPort,
  ]);
  const next = spawnChild("next", nextCommand.command, nextCommand.args, {
    env: {
      ...process.env,
      ARCHIVE_API_BASE_URL: apiBaseUrl,
    },
  });

  await waitForJson(`${nextUrl}/api/v1/health`, "Next.js rewrite");

  const e2eSpecs = process.env.ARCHIVE_E2E_SPECS
    ? process.env.ARCHIVE_E2E_SPECS.split(",").map((spec) => spec.trim()).filter(Boolean)
    : [
      "e2e/next-laravel-integration.spec.ts",
      "e2e/accessibility.spec.ts",
      "e2e/auth-fixtures.authed.spec.ts",
      "e2e/onboarding-progress.authed.spec.ts",
      "e2e/scheduled-uploads.authed.spec.ts",
      "e2e/screen-reader-sample.authed.spec.ts",
      "e2e/uploads-mobile.authed.spec.ts",
      "e2e/phone-first-screen.authed.spec.ts",
      "e2e/critical-journeys-console.authed.spec.ts",
    ];
  const e2eCommand = pnpmInvocation([
    "--filter",
    "@archive/next",
    "exec",
    "playwright",
    "test",
    ...e2eSpecs,
    ...(process.env.ARCHIVE_E2E_GREP ? ["--grep", process.env.ARCHIVE_E2E_GREP] : []),
  ]);
  const e2e = spawnChild("playwright", e2eCommand.command, e2eCommand.args, {
    env: {
      ...process.env,
      E2E_BASE_URL: nextUrl,
      ARCHIVE_API_BASE_URL: apiBaseUrl,
      // Keep both Playwright's per-test output and its HTML report in the
      // ignored workspace. A successful live gate must not make a later
      // repository-hygiene gate fail merely because it left QA artifacts.
      PLAYWRIGHT_OUTPUT_DIR: process.env.PLAYWRIGHT_OUTPUT_DIR || path.join(ROOT, ".tmp", `playwright-live-${process.pid}`),
      PLAYWRIGHT_HTML_OUTPUT_DIR: process.env.PLAYWRIGHT_HTML_OUTPUT_DIR || path.join(ROOT, ".tmp", `playwright-live-report-${process.pid}`),
    },
  });

  const result = await waitForExit(e2e);
  if (result.code !== 0) {
    throw new Error(`Next/Laravel integration failed with ${result.signal || result.code}`);
  }

  if (laravel) laravel.kill("SIGTERM");
  next.kill("SIGTERM");
  console.log("ok - live Laravel/Next integration");
}

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(stopAll);
