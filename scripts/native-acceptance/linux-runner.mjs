import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeAcceptanceEvidence } from "./evidence.mjs";

const SERVICES = ["archive-http", "archive-next", "archive-php-fpm", "archive-worker", "archive-reverb", "archive-scheduler"];
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function defaultDocker(args) {
  const result = spawnSync("docker", args, { encoding: "utf8", stdio: "pipe" });
  return { status: result.status ?? 1, stdout: result.stdout || "", stderr: result.stderr || "" };
}

function requireOk(docker, args, operation) {
  const result = docker(args);
  if (result.status !== 0) throw new Error(`Linux Native acceptance failed during ${operation}.`);
  return result;
}

async function waitFor(check, operation, { attempts = 60, intervalMs = 1_000 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = check();
    if (result.status === 0) return result;
    if (attempt + 1 < attempts) await delay(intervalMs);
  }
  throw new Error(`Linux Native acceptance timed out during ${operation}.`);
}

function execArgs(container, command, env = {}) {
  return ["exec", ...Object.entries(env).flatMap(([key, value]) => ["-e", `${key}=${value}`]), container, ...command];
}

function setupConfiguration() {
  return {
    schemaVersion: "1.0",
    mode: "native",
    platform: "linux-native",
    source: "offline",
    intent: "fresh",
    access: "local",
    runtimeProfiles: ["core"],
    capabilities: [],
    dataServices: { postgres: { enabled: true }, redis: { enabled: true } },
    storage: { driver: "local", path: "/srv/archive" },
  };
}

export async function runLinuxNativeAcceptance({
  bundlePath,
  bundleDigest = "0".repeat(64),
  runId,
  docker = defaultDocker,
  evidenceWriter = writeAcceptanceEvidence,
  evidenceOutputDir,
  repoRoot,
  commit,
  version,
  passwordFactory = () => randomBytes(24).toString("base64url"),
  systemdImage = "archive-native-systemd-acceptance:bookworm",
  postgresImage = "archive-suite/postgres:1.0.0-bundletest",
  redisImage = "archive-suite/redis:1.0.0-bundletest",
  progress = () => {},
} = {}) {
  if (!bundlePath || !runId || !repoRoot) throw new Error("Linux Native acceptance requires bundlePath, runId, and repoRoot.");
  const names = {
    network: `archive-native-net-${runId}`,
    postgres: `archive-native-postgres-${runId}`,
    redis: `archive-native-redis-${runId}`,
    systemd: `archive-native-systemd-${runId}`,
  };
  const scratch = mkdtempSync(join(tmpdir(), `archive-native-${runId}-`));
  const configPath = join(scratch, "setup.json");
  writeFileSync(configPath, `${JSON.stringify(setupConfiguration(), null, 2)}\n`, { mode: 0o600 });
  const dbPassword = passwordFactory();
  const label = `archive.acceptance.run=${runId}`;
  const scenarios = [];
  let failure;

  try {
    progress("Building the isolated systemd acceptance image.");
    const imageContext = join(repoRoot, "scripts", "native-acceptance");
    requireOk(docker, ["build", "-f", join(imageContext, "Dockerfile.systemd"), "-t", systemdImage, imageContext], "systemd image build");
    requireOk(docker, ["network", "create", "--label", label, names.network], "network creation");
    requireOk(docker, ["run", "-d", "--name", names.postgres, "--network", names.network, "--label", label, "-e", "POSTGRES_DB=archive", "-e", "POSTGRES_USER=archive", "-e", `POSTGRES_PASSWORD=${dbPassword}`, postgresImage], "PostgreSQL start");
    requireOk(docker, ["run", "-d", "--name", names.redis, "--network", names.network, "--label", label, redisImage, "redis-server", "--appendonly", "no"], "Redis start");
    await waitFor(() => docker(["exec", names.postgres, "pg_isready", "-U", "archive", "-d", "archive"]), "PostgreSQL readiness");
    await waitFor(() => docker(["exec", names.redis, "redis-cli", "ping"]), "Redis readiness");

    requireOk(docker, ["run", "-d", "--name", names.systemd, "--network", names.network, "--label", label, "--privileged", "--cgroupns=host", "--tmpfs", "/run", "--tmpfs", "/run/lock", "--mount", "type=bind,source=/sys/fs/cgroup,target=/sys/fs/cgroup", systemdImage], "systemd container start");
    await waitFor(() => docker(["exec", names.systemd, "systemctl", "show", "--property=Version"]), "systemd readiness");
    requireOk(docker, ["exec", names.systemd, "mkdir", "-p", "/opt/archive-suite", "/opt/archive-control", "/srv/archive/private", "/srv/archive/public"], "target directory creation");
    progress("Copying the verified self-contained bundle into the systemd target.");
    requireOk(docker, ["cp", `${bundlePath}/.`, `${names.systemd}:/opt/archive-suite`], "bundle copy");
    requireOk(docker, ["cp", join(repoRoot, "scripts"), `${names.systemd}:/opt/archive-control/scripts`], "Control Center copy");
    requireOk(docker, ["cp", join(repoRoot, "infra"), `${names.systemd}:/opt/archive-control/infra`], "platform contract copy");
    requireOk(docker, ["cp", join(repoRoot, "package.json"), `${names.systemd}:/opt/archive-control/package.json`], "version metadata copy");
    requireOk(docker, ["cp", configPath, `${names.systemd}:/tmp/setup.json`], "setup configuration copy");
    requireOk(docker, ["exec", names.systemd, "chmod", "+x", "/opt/archive-suite/runtime/node/bin/node", "/opt/archive-suite/runtime/caddy/caddy", "/opt/archive-suite/runtime/php/bin/php", "/opt/archive-suite/runtime/php/sbin/php-fpm"], "runtime permissions");
    requireOk(docker, ["exec", names.systemd, "/opt/archive-suite/runtime/node/bin/node", "/opt/archive-control/scripts/control-center/linux-bundle/stage-service-user.mjs"], "service user creation");
    requireOk(docker, ["exec", names.systemd, "chown", "-R", "archive:archive", "/srv/archive"], "storage ownership");

    const installEnv = {
      ARCHIVE_NATIVE_INSTALL_ROOT: "/opt/archive-suite",
      ARCHIVE_INSTALLATION_MANIFEST_PATH: "/opt/archive-control/installation-manifest.json",
      ARCHIVE_NATIVE_POSTGRES_HOST: names.postgres,
      ARCHIVE_NATIVE_POSTGRES_DATABASE: "archive",
      ARCHIVE_NATIVE_POSTGRES_USERNAME: "archive",
      ARCHIVE_NATIVE_POSTGRES_PASSWORD: dbPassword,
      ARCHIVE_NATIVE_REDIS_HOST: names.redis,
    };
    progress("Installing the six Native services through the production Control Center path.");
    requireOk(docker, execArgs(names.systemd, ["/opt/archive-suite/runtime/node/bin/node", "/opt/archive-control/scripts/control-center.mjs", "install", "--config=/tmp/setup.json", "--json"], installEnv), "Native install");
    scenarios.push({ name: "install", ok: true });

    const systemdState = docker(["exec", names.systemd, "systemctl", "is-system-running", "--wait"]);
    if (systemdState.status !== 0 && !["running", "degraded"].includes(systemdState.stdout.trim())) throw new Error("Linux Native acceptance did not reach a stable systemd state.");
    scenarios.push({ name: "systemd-pid1", ok: true });
    for (const service of SERVICES) {
      await waitFor(() => docker(["exec", names.systemd, "systemctl", "is-active", service]), `${service} health`, { attempts: 90 });
    }
    scenarios.push({ name: "six-services-active", ok: true });
    await waitFor(() => docker(["exec", names.systemd, "curl", "-fsS", "http://127.0.0.1:8443/"]), "HTTP health", { attempts: 90 });
    scenarios.push({ name: "http-health", ok: true });

    progress("Uninstalling manifest-owned Native services and application files.");
    requireOk(docker, execArgs(names.systemd, ["/opt/archive-suite/runtime/node/bin/node", "/opt/archive-control/scripts/control-center.mjs", "uninstall", "--yes", "--json"], {
      ARCHIVE_INSTALLATION_MANIFEST_PATH: "/opt/archive-control/installation-manifest.json",
    }), "Native uninstall");
    requireOk(docker, ["exec", names.systemd, "test", "!", "-e", "/opt/archive-suite"], "application cleanup proof");
    requireOk(docker, ["exec", names.systemd, "test", "!", "-e", "/opt/archive-control/installation-manifest.json"], "manifest cleanup proof");
    for (const service of SERVICES) requireOk(docker, ["exec", names.systemd, "test", "!", "-e", `/etc/systemd/system/${service}.service`], `${service} unit cleanup proof`);
    scenarios.push({ name: "uninstall", ok: true });
  } catch (error) {
    failure = error;
    // Best-effort uninstall still uses the manifest-owned path; the outer
    // Docker cleanup below is the final isolation boundary on failed runs.
    docker(execArgs(names.systemd, ["/opt/archive-suite/runtime/node/bin/node", "/opt/archive-control/scripts/control-center.mjs", "uninstall", "--yes", "--json"], {
      ARCHIVE_INSTALLATION_MANIFEST_PATH: "/opt/archive-control/installation-manifest.json",
    }));
  } finally {
    // PID 1 systemd honors a long graceful shutdown. Acceptance cleanup is
    // disposable by definition, so stop it with a zero-second timeout before
    // removing the three run-scoped containers.
    docker(["stop", "--timeout", "0", names.systemd]);
    docker(["rm", "-f", names.systemd, names.postgres, names.redis]);
    docker(["network", "rm", names.network]);
    rmSync(scratch, { recursive: true, force: true });
  }

  const resourcesAbsent = [names.systemd, names.postgres, names.redis].every((name) => docker(["inspect", name]).status !== 0)
    && docker(["network", "inspect", names.network]).status !== 0;
  const cleanup = { ok: resourcesAbsent, dockerResourcesAbsent: resourcesAbsent };
  if (failure) throw failure;
  if (!cleanup.ok) throw new Error("Linux Native acceptance could not prove Docker resource cleanup.");

  const evidence = {
    platform: "linux-native",
    runId,
    commit,
    version,
    bundleDigest,
    environment: { isolation: "docker", init: "systemd-pid1", cgroupNamespace: "host", privileged: true },
    scenarios,
    cleanup,
    createdAt: new Date().toISOString(),
  };
  const evidencePath = evidenceWriter(evidence, { outputDir: evidenceOutputDir });
  return { ok: true, evidencePath, scenarios, cleanup };
}
