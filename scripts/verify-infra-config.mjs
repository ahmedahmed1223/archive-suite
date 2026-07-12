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

assertIncludes("infra/docker-compose.laravel-next.yml", "archive-ln-laravel");
assertIncludes("infra/docker-compose.laravel-next.yml", "archive-ln-laravel-worker");
assertIncludes("infra/docker-compose.laravel-next.yml", "ARCHIVE_API_BASE_URL: http://laravel:8000/api/v1");
assertIncludes("infra/docker-compose.laravel-next.yml", "QUEUE_CONNECTION: redis");
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

assertIncludes("infra/k8s/network-policy.yaml", "app: server");
assertIncludes("infra/k8s/network-policy.yaml", "app: frontend");
assertIncludes("infra/k8s/network-policy.yaml", "app: postgres");
assertIncludes("infra/k8s/network-policy.yaml", "app: redis");
assertIncludes("infra/k8s/network-policy.yaml", "app: whisper-worker");
assertExcludes("infra/k8s/network-policy.yaml", "app: archive-server");
assertExcludes("infra/k8s/network-policy.yaml", "app: archive-frontend");

for (const file of [
  "infra/k8s/redis-deployment.yaml",
  "infra/k8s/redis-service.yaml",
  "infra/k8s/whisper-worker-deployment.yaml",
]) {
  assert.ok(existsSync(rel(file)), `missing k8s resource: ${file}`);
  assertIncludes("infra/k8s/kustomization.yaml", path.basename(file));
}

assertIncludes("infra/k8s/configmap.yaml", 'REDIS_URL: "redis://redis:6379"');
assertIncludes("infra/k8s/configmap.yaml", 'MEDIA_PROCESSOR: "real"');
assertIncludes("infra/k8s/configmap.yaml", 'WHISPER_MODEL: "large-v3"');
assertIncludes("infra/k8s/secret.yaml", "APP_KEY:");
assertIncludes("infra/k8s/redis-service.yaml", "app: redis");
assertIncludes("infra/k8s/whisper-worker-deployment.yaml", "app: whisper-worker");
assertIncludes("infra/k8s/whisper-worker-deployment.yaml", "nvidia.com/gpu");

for (const variant of composeVariants) {
  const label = variant.map((file) => `infra/${file}`).join(" + ");
  runChecked(
    `docker compose config (${label})`,
    "docker",
    ["compose", "--env-file", "infra/.env.example", ...variant.flatMap((file) => ["-f", `infra/${file}`]), "config"],
    ROOT
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
