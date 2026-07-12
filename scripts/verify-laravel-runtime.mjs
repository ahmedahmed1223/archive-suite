import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNTIME_IMAGE = "archive-laravel-runtime-test";

function read(relativePath) {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function run(label, command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.error || result.status !== 0) {
    const details = [result.error?.message, result.stderr, result.stdout]
      .filter(Boolean)
      .join("\n")
      .trim();
    throw new Error(`${label} failed${details ? `: ${details}` : ""}`);
  }
}

const runtimeDockerfile = read("archive-laravel/Dockerfile.worker");
const harness = read("scripts/laravel-docker.mjs");
const infraVerifier = read("scripts/verify-infra-config.mjs");
const releaseVerifier = read("scripts/verify-release-readiness.mjs");
const requiredWorkerExtensions = ["curl", "mbstring", "zip", "pdo", "pdo_pgsql", "ftp"];
const workerExtensionContract = /for \(const extension of \["curl", "mbstring", "zip", "pdo", "pdo_pgsql", "ftp"\]\) \{\s+assertWorkerInstallsExtension\("archive-laravel\/Dockerfile\.worker", extension\);\s+\}/;

assert.match(
  runtimeDockerfile,
  /docker-php-ext-install[\s\\\S]*\bftp\b/,
  "the Laravel runtime image must install ext-ftp required by composer.lock"
);
assert.match(
  harness,
  /const LARAVEL_RUNTIME_IMAGE = "archive-laravel-runtime-test"/,
  "the Laravel harness must run the Laravel runtime image rather than composer:latest"
);
assert.match(
  harness,
  /"archive-laravel\/Dockerfile\.worker"/,
  "the Laravel harness must build the canonical runtime Dockerfile"
);
assert.match(
  harness,
  /test -f vendor\/autoload\.php \|\| composer install --no-interaction/,
  "the Laravel harness must repair incomplete Composer installs before running tests"
);
for (const [name, verifier] of [
  ["infrastructure", infraVerifier],
  ["release", releaseVerifier],
]) {
  assert.match(
    verifier,
    workerExtensionContract,
    `the ${name} verifier must require PHP extensions ${requiredWorkerExtensions.join(", ")}`
  );
}
assert.match(
  infraVerifier,
  /assertWorkerInstallsExtension\("archive-laravel\/Dockerfile\.worker", "ftp"\)/,
  "the infrastructure verifier must require ext-ftp in the Laravel runtime"
);
assert.match(
  releaseVerifier,
  /assertWorkerInstallsExtension\("archive-laravel\/Dockerfile\.worker", "ftp"\)/,
  "the release verifier must require ext-ftp in the Laravel runtime"
);

run("Laravel runtime image build", "docker", [
  "build",
  "--tag",
  RUNTIME_IMAGE,
  "--file",
  "archive-laravel/Dockerfile.worker",
  "archive-laravel",
]);
run("Laravel runtime ext-ftp check", "docker", [
  "run",
  "--rm",
  RUNTIME_IMAGE,
  "php",
  "-r",
  "exit(extension_loaded('ftp') ? 0 : 1);",
]);

console.log("ok - Laravel runtime image provides ext-ftp and is selected by the test harness");
