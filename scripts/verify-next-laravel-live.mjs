import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const containerName = `archive-laravel-e2e-${process.pid}`;
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
    if (!child.killed) child.kill("SIGTERM");
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
    startedLaravelContainer = true;
    laravel = spawnChild("laravel", "docker", [
      "run",
      "--rm",
      "--name",
      containerName,
      "-v",
      `${ROOT}:/app`,
      "-w",
      "/app/archive-laravel",
      "-p",
      `${laravelPort}:8000`,
      "composer:latest",
      "sh",
      "-lc",
      "test -f .env || cp .env.example .env; test -d vendor || composer install --no-interaction; php artisan config:clear && php artisan migrate:fresh --seed --seeder=NextIntegrationSeeder --force && php artisan serve --host=0.0.0.0 --port=8000",
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

  const e2eCommand = pnpmInvocation([
    "--filter",
    "@archive/app",
    "exec",
    "playwright",
    "test",
    "tests/next-laravel-integration.spec.ts",
  ]);
  const e2e = spawnChild("playwright", e2eCommand.command, e2eCommand.args, {
    env: {
      ...process.env,
      E2E_BASE_URL: nextUrl,
      ARCHIVE_API_BASE_URL: apiBaseUrl,
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
