import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INFRA_DIR = path.join(ROOT, "infra");
const K8S_DIR = path.join(INFRA_DIR, "k8s");

const composeVariants = [
  ["docker-compose.yml"],
  ["docker-compose.yml", "docker-compose.dev.yml"],
  ["docker-compose.laravel-next.yml"],
];

function rel(...segments) {
  return path.join(ROOT, ...segments);
}

function read(relativePath) {
  return readFileSync(rel(relativePath), "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertIncludes(file, expected) {
  assert.match(read(file), new RegExp(escapeRegExp(expected)), `${file} should include ${expected}`);
}

function assertExcludes(file, forbidden) {
  assert.doesNotMatch(read(file), new RegExp(escapeRegExp(forbidden)), `${file} should not include ${forbidden}`);
}

// Regression guard (2026-07-14): an unquoted dotenv value containing
// whitespace ("ADMIN_NAME=Archive Admin") makes Laravel's strict phpdotenv
// parser throw "Encountered unexpected whitespace" the moment composer's
// package:discover hook boots the framework — breaking every Docker-based
// Laravel test/deploy that copies this file to .env. See
// docs/ci/regression-ledger.md.
function assertEnvValuesAreDotenvSafe(file) {
  for (const line of read(file).split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    const value = rawValue.trim();
    if (value === "" || value.startsWith('"') || value.startsWith("'")) continue;
    const beforeComment = value.split(/\s+#/)[0].trim();
    assert.ok(
      !/\s/.test(beforeComment),
      `${file}: ${key} has an unquoted value containing whitespace ("${value}") — wrap it in quotes.`
    );
  }
}

function assertWorkerInstallsExtension(file, extension) {
  assert.match(
    read(file),
    new RegExp(`docker-php-ext-install[^\\r\\n]*\\b${escapeRegExp(extension)}\\b`),
    `${file} should install PHP ext-${extension}`
  );
}

function shortOutput(value) {
  const text = (value ?? "").trim();
  if (!text) return "";
  const lines = text.split(/\r?\n/);
  return lines.slice(0, 8).join("\n");
}

function runChecked(label, command, args, cwd = ROOT, input) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    input,
    windowsHide: true,
  });

  if (result.error) {
    throw new Error(`${label} failed to start: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = shortOutput(result.stderr);
    const stdout = shortOutput(result.stdout);
    const details = [stderr, stdout].filter(Boolean).join("\n");
    throw new Error(
      `${label} exited with code ${result.status}${details ? `\n${details}` : ""}`
    );
  }

  return result;
}

for (const variant of composeVariants) {
  for (const file of variant) {
    assert.ok(existsSync(rel("infra", file)), `missing compose file: infra/${file}`);
  }
}

for (const file of [
  "archive-next/Dockerfile",
  "archive-laravel/Dockerfile.worker",
]) {
  assert.ok(existsSync(rel(file)), `missing deployment Dockerfile: ${file}`);
}

assertIncludes("infra/docker-compose.laravel-next.yml", "  laravel:");
assertIncludes("infra/docker-compose.laravel-next.yml", "  laravel-fpm:");
assertIncludes("infra/docker-compose.laravel-next.yml", "  laravel-worker:");
assertIncludes("infra/docker-compose.laravel-next.yml", "  laravel-reverb:");
assertIncludes("infra/docker-compose.laravel-next.yml", "  next:");
assertIncludes("infra/docker-compose.laravel-next.yml", "ARCHIVE_API_BASE_URL: http://laravel:8000/api/v1");
assertIncludes("infra/docker-compose.laravel-next.yml", "QUEUE_CONNECTION: redis");
assertExcludes("infra/docker-compose.laravel-next.yml", "container_name:");
assertIncludes("infra/docker-compose.yml", "archive-ln-laravel");
assertIncludes("infra/docker-compose.yml", "archive-ln-next");
assertIncludes("infra/docker-compose.yml", "dockerfile: archive-next/Dockerfile");
assertIncludes("infra/docker-compose.yml", "ARCHIVE_API_BASE_URL: http://laravel:8000/api/v1");
assertIncludes("infra/docker-compose.yml", "CADDY_UPSTREAM: next:3000");
assertExcludes("infra/docker-compose.yml", "Dockerfile.frontend");
assertExcludes("infra/docker-compose.yml", "archive-app");
assertIncludes("archive-next/next.config.mjs", 'output: "standalone"');
assertIncludes("archive-next/Dockerfile", "COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./");
assertIncludes("archive-next/Dockerfile", "ARG ARCHIVE_API_BASE_URL=http://laravel:8000/api/v1");
assertIncludes("archive-next/Dockerfile", "COPY --from=builder /app/archive-next/public ./archive-next/public");
assertIncludes("archive-laravel/Dockerfile.worker", "docker-php-ext-enable redis");
for (const extension of ["curl", "mbstring", "zip", "pdo", "pdo_pgsql", "ftp"]) {
  assertWorkerInstallsExtension("archive-laravel/Dockerfile.worker", extension);
}
assertIncludes("infra/deploy/Caddyfile", 'reverse_proxy {$CADDY_UPSTREAM:frontend:80}');

assertEnvValuesAreDotenvSafe("archive-laravel/.env.example");
assertEnvValuesAreDotenvSafe("infra/.env.example");

// Regression guard (2026-07-14): a plain `composer:latest` image lacks
// ext-ftp, which composer.lock requires (league/flysystem-ftp) — composer
// install fails silently and the live-integration job never boots Laravel.
assertExcludes("scripts/verify-next-laravel-live.mjs", '"composer:latest"');
assertIncludes("scripts/verify-next-laravel-live.mjs", "Dockerfile.worker");

// Regression guard (2026-07-14): V1-202 split "laravel" into nginx (no app
// env vars) + "laravel-fpm" (carries APP_KEY/DB_*/REDIS_*, can run artisan).
// Any `exec ... laravel php artisan ...` targeting the bare nginx service
// fails for lack of environment — this silently broke change-admin-password,
// migrate-status, migrate, and seed-demo until fixed. See
// docs/ci/regression-ledger.md.
assertExcludes("scripts/control-center.mjs", '"exec", "-T", "laravel", "php"');

assertIncludes("infra/k8s/network-policy.yaml", "app: server");
assertIncludes("infra/k8s/network-policy.yaml", "app: frontend");
assertIncludes("infra/k8s/network-policy.yaml", "app: postgres");
assertIncludes("infra/k8s/network-policy.yaml", "app: redis");
assertIncludes("infra/k8s/network-policy.yaml", "app: whisper-worker");
assertExcludes("infra/k8s/network-policy.yaml", "app: archive-server");
assertExcludes("infra/k8s/network-policy.yaml", "app: archive-frontend");

for (const file of [
  "infra/k8s/postgres-statefulset.yaml",
  "infra/k8s/postgres-service.yaml",
  "infra/k8s/redis-deployment.yaml",
  "infra/k8s/redis-service.yaml",
]) {
  assert.ok(existsSync(rel(file)), `missing k8s resource: ${file}`);
  assertIncludes("infra/k8s/kustomization.yaml", path.basename(file));
}
for (const legacyResource of [
  "server-deployment.yaml",
  "whisper-worker-deployment.yaml",
  "frontend-deployment.yaml",
]) {
  assertExcludes("infra/k8s/kustomization.yaml", legacyResource);
  assert.ok(!existsSync(rel("infra", "k8s", legacyResource)), `legacy deployable should be removed: ${legacyResource}`);
}

assertIncludes("infra/k8s/configmap.yaml", 'REDIS_URL: "redis://redis:6379"');
assertIncludes("infra/k8s/configmap.yaml", 'MEDIA_PROCESSOR: "real"');
assertIncludes("infra/k8s/configmap.yaml", 'WHISPER_MODEL: "large-v3"');
assertIncludes("infra/k8s/secret.yaml", "APP_KEY:");
assertIncludes("infra/k8s/redis-service.yaml", "app: redis");

for (const variant of composeVariants) {
  const label = variant.map((file) => `infra/${file}`).join(" + ");
  const rendered = runChecked(
    `docker compose config (${label})`,
    "docker",
    ["compose", "--env-file", "infra/.env.example", ...variant.flatMap((file) => ["-f", `infra/${file}`]), "config", "--format", "json"],
    ROOT
  );

  const config = JSON.parse(rendered.stdout);
  const worker = config.services?.["laravel-worker"];
  const reverb = config.services?.["laravel-reverb"];

  assert.deepEqual(
    worker?.healthcheck?.test,
    ["CMD-SHELL", "tr '\\0' ' ' </proc/1/cmdline | grep -q '[q]ueue:work'"],
    `${label}: worker healthcheck must inspect PID 1 without matching its own probe`
  );
  assert.equal(
    worker?.depends_on?.["laravel-fpm"]?.condition,
    "service_healthy",
    `${label}: worker must wait for migrations/seed and healthy PHP-FPM`
  );
  assert.equal(
    reverb?.depends_on?.["laravel-fpm"]?.condition,
    "service_healthy",
    `${label}: Reverb must wait for migrations/seed and healthy PHP-FPM`
  );
}

const kubectlCheck = spawnSync("kubectl", ["version", "--client"], {
  cwd: ROOT,
  encoding: "utf8",
  windowsHide: true,
});

if (kubectlCheck.error || kubectlCheck.status !== 0) {
  const reason = kubectlCheck.error?.message || shortOutput(kubectlCheck.stderr) || "kubectl unavailable";
  console.log(`Skipping kubectl kustomize dry-run: ${reason}`);
} else {
  const rendered = runChecked(
    "kubectl kustomize infra/k8s",
    "kubectl",
    ["kustomize", path.relative(ROOT, K8S_DIR) || "infra/k8s"],
    ROOT
  );

  const clusterCheck = spawnSync("kubectl", ["config", "view", "--raw", "--minify", "-o", "jsonpath={.clusters[0].cluster.server}"], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
  });

  if (clusterCheck.error || clusterCheck.status !== 0) {
    const stderr = shortOutput(clusterCheck.stderr);
    const reason = clusterCheck.error?.message || stderr || "kubectl cluster API unavailable";
    console.log(
      /current-context must exist/i.test(stderr)
        ? "Skipping kubectl dry-run: kubectl has no current context configured."
        : `Skipping kubectl dry-run: ${reason}`
    );
  } else {
    const serverUrl = (clusterCheck.stdout ?? "").trim();
    if (!serverUrl || /(?:^|\/\/)(?:localhost|127\.0\.0\.1):8080(?:\/|$)/.test(serverUrl)) {
      console.log(`Skipping kubectl dry-run: no reachable API server configured${serverUrl ? ` (${serverUrl})` : ""}.`);
    } else {
      runChecked(
        "kubectl apply --dry-run=client --validate=false -f -",
        "kubectl",
        ["apply", "--dry-run=client", "--validate=false", "-f", "-"],
        ROOT,
        rendered.stdout
      );
    }
  }
}

console.log("Infra config verification complete.");
