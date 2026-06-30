import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

const laravelPort = process.env.LARAVEL_PORT || "8950";
const nextPort = process.env.NEXT_PORT || "8951";
const laravelUrl = `http://127.0.0.1:${laravelPort}`;
const apiBaseUrl = process.env.ARCHIVE_API_BASE_URL || `${laravelUrl}/api/v1`;
const containerName = `archive-laravel-dev-${process.pid}`;
const children = [];

function pnpmInvocation(args) {
  return process.platform === "win32"
    ? { command: "cmd.exe", args: ["/d", "/s", "/c", "pnpm", ...args] }
    : { command: "pnpm", args };
}

function spawnLogged(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: false,
    ...options,
  });
  children.push({ name, child });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`${name} exited with ${signal || code}`);
    shutdown(code || 1);
  });
  return child;
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const { child } of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  spawn("docker", ["rm", "-f", containerName], {
    cwd: ROOT,
    stdio: "ignore",
    shell: false,
  }).on("exit", () => process.exit(code));
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log(`Laravel API: ${laravelUrl}`);
console.log(`Next.js app: http://127.0.0.1:${nextPort}`);
console.log(`Next.js API rewrite: ${apiBaseUrl}`);

spawnLogged("laravel", "docker", [
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
  // Seeder: NextIntegrationSeeder (matches verify-next-laravel-live.mjs for consistency).
  // DatabaseSeeder only creates a bare test user and does NOT delegate to NextIntegrationSeeder.
  "test -f .env || cp .env.example .env; test -d vendor || composer install --no-interaction; php artisan config:clear && php artisan migrate --force && php artisan db:seed --class=NextIntegrationSeeder --force && php artisan serve --host=0.0.0.0 --port=8000",
]);

// Wait for Laravel to finish migrate+seed before booting Next — early API calls
// during Next startup would fail otherwise. Mirrors verify-next-laravel-live.mjs.
await waitForJson(`${laravelUrl}/api/v1/health`, "Laravel");

const nextCommand = pnpmInvocation([
  "--filter",
  "@archive/next",
  "exec",
  "next",
  "dev",
  "--hostname",
  "127.0.0.1",
  "--port",
  nextPort,
]);
spawnLogged("next", nextCommand.command, nextCommand.args, {
  env: {
    ...process.env,
    ARCHIVE_API_BASE_URL: apiBaseUrl,
  },
});
