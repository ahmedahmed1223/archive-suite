import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SETUP_PREFIX = "test -f .env || cp .env.example .env; test -d vendor || composer install --no-interaction";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: "inherit",
      shell: false,
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with ${signal || code}`));
    });
  });
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function dockerArgs(command, extra = []) {
  return [
    "run",
    "--rm",
    ...extra,
    "-v",
    `${ROOT}:/app`,
    "-w",
    "/app/archive-laravel",
    "composer:latest",
    "sh",
    "-lc",
    `${SETUP_PREFIX}; ${command.map(shellQuote).join(" ")}`,
  ];
}

const [mode, ...rest] = process.argv.slice(2);
const servePort = process.env.LARAVEL_PORT || "8950";

const commands = {
  test: ["php", "artisan", "test", ...rest],
  "migrate-fresh-integration": [
    "php",
    "artisan",
    "migrate:fresh",
    "--seed",
    "--seeder=NextIntegrationSeeder",
    "--force",
    ...rest,
  ],
  artisan: ["php", "artisan", ...rest],
  serve: ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000", ...rest],
};

if (!mode || !commands[mode]) {
  console.error("Usage: node scripts/laravel-docker.mjs <test|migrate-fresh-integration|artisan> [args...]");
  process.exit(2);
}

const extraDockerArgs = mode === "serve" ? ["-p", `${servePort}:8000`] : [];

run("docker", dockerArgs(commands[mode], extraDockerArgs)).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
