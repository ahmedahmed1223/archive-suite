import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import { writeAcceptanceEvidence } from "./evidence.mjs";

const SERVICES = ["archive-http", "archive-next", "archive-php-fcgi", "archive-worker", "archive-reverb", "archive-scheduler"];
const delay = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: "pipe", windowsHide: true, ...options });
  return { status: result.status ?? 1, stdout: result.stdout || "", stderr: result.stderr || "" };
}

function requireOk(result, operation) {
  if (result.status !== 0) throw new Error(`Windows Native acceptance failed during ${operation}.`);
  return result;
}

async function waitFor(check, operation, attempts = 90) {
  for (let index = 0; index < attempts; index += 1) {
    if (await check()) return;
    if (index + 1 < attempts) await delay(1_000);
  }
  throw new Error(`Windows Native acceptance timed out during ${operation}.`);
}

function setupConfiguration(storagePath, { postgresPort, redisPort }) {
  return {
    schemaVersion: "1.0",
    mode: "native",
    platform: "windows-native",
    source: "offline",
    intent: "fresh",
    access: "local",
    runtimeProfiles: ["core"],
    capabilities: [],
    dataServices: {
      postgres: { enabled: true, kind: "external", host: "127.0.0.1", port: postgresPort, database: "archive" },
      redis: { enabled: true, kind: "external", host: "127.0.0.1", port: redisPort },
    },
    storage: { driver: "local", path: storagePath },
  };
}

function parsePublishedPort(value) {
  const match = String(value).trim().match(/:(\d+)$/m);
  if (!match) throw new Error("Windows Native acceptance could not resolve a Docker published port.");
  return Number(match[1]);
}

export function defaultWindowsElevationCheck() {
  return run("net.exe", ["session"]).status === 0;
}

export function createWindowsAcceptanceEffects({ bundlePath, repoRoot, runId, progress = () => {} }) {
  const names = {
    network: `archive-native-net-${runId}`,
    postgres: `archive-native-postgres-${runId}`,
    redis: `archive-native-redis-${runId}`,
  };
  const runRoot = join(repoRoot, "artifacts", "native-acceptance", `windows-run-${runId}`);
  const storagePath = join(runRoot, "data");
  const manifestPath = join(runRoot, "installation-manifest.json");
  const configPath = join(runRoot, "setup.json");
  const label = `archive.acceptance.run=${runId}`;

  const serviceExists = (service) => run("sc.exe", ["query", service]).status === 0;
  const docker = (args) => run("docker", args);
  const controlCenter = (action, environment) => run(process.execPath, [join(repoRoot, "scripts", "control-center.mjs"), action, ...(action === "install" ? [`--config=${configPath}`] : ["--yes"]), "--json"], {
    cwd: repoRoot,
    env: { ...process.env, ...environment },
  });

  return {
    async assertServicesAbsent() {
      await waitFor(() => SERVICES.every((service) => !serviceExists(service)), "service-name cleanup", 30);
    },
    async startDependencies({ databasePassword }) {
      mkdirSync(storagePath, { recursive: true });
      requireOk(docker(["network", "create", "--label", label, names.network]), "Docker network creation");
      requireOk(docker(["run", "-d", "--name", names.postgres, "--network", names.network, "--label", label, "-p", "127.0.0.1::5432", "-e", "POSTGRES_DB=archive", "-e", "POSTGRES_USER=archive", "-e", `POSTGRES_PASSWORD=${databasePassword}`, "pgvector/pgvector:0.8.5-pg18@sha256:12a379b47ad65289572ea0756efc11b7c241a6662833e8af7038cd3b73d647e0"]), "PostgreSQL start");
      requireOk(docker(["run", "-d", "--name", names.redis, "--network", names.network, "--label", label, "-p", "127.0.0.1::6379", "redis:8.8.0-alpine@sha256:9d317178eceac8454a2284a9e6df2466b93c745529947f0cd42a0fa9609d7005", "redis-server", "--appendonly", "no"]), "Redis start");
      await waitFor(() => docker(["exec", names.postgres, "pg_isready", "-U", "archive", "-d", "archive"]).status === 0, "PostgreSQL readiness");
      await waitFor(() => docker(["exec", names.redis, "redis-cli", "ping"]).status === 0, "Redis readiness");
      const postgresPort = parsePublishedPort(requireOk(docker(["port", names.postgres, "5432/tcp"]), "PostgreSQL port lookup").stdout);
      const redisPort = parsePublishedPort(requireOk(docker(["port", names.redis, "6379/tcp"]), "Redis port lookup").stdout);
      writeFileSync(configPath, `${JSON.stringify(setupConfiguration(storagePath, { postgresPort, redisPort }), null, 2)}\n`, { mode: 0o600 });
      return { postgresPort, redisPort };
    },
    async install({ environment }) {
      progress("Installing the six Windows services through Control Center.");
      requireOk(controlCenter("install", environment), "Native install");
    },
    async waitForServices() {
      for (const service of SERVICES) {
        await waitFor(() => {
          const result = run("sc.exe", ["query", service]);
          return result.status === 0 && /STATE\s*:\s*4\s+RUNNING/i.test(result.stdout);
        }, `${service} health`);
      }
    },
    async waitForHttp() {
      await waitFor(async () => {
        try {
          const response = await fetch("http://127.0.0.1:8443/", { redirect: "manual" });
          return response.status > 0 && response.status < 500;
        } catch { return false; }
      }, "HTTP health");
    },
    async uninstall() {
      progress("Uninstalling manifest-owned Windows services and application files.");
      requireOk(controlCenter("uninstall", { ARCHIVE_INSTALLATION_MANIFEST_PATH: manifestPath }), "Native uninstall");
    },
    async proveApplicationCleanup() {
      if (existsSync(bundlePath)) throw new Error("Windows Native acceptance left the application root behind.");
      if (existsSync(manifestPath)) throw new Error("Windows Native acceptance left its installation manifest behind.");
      if (!existsSync(storagePath)) throw new Error("Windows Native uninstall did not preserve the configured data path.");
    },
    async stopDependencies() {
      docker(["rm", "-f", names.postgres, names.redis]);
      docker(["network", "rm", names.network]);
    },
    async proveDependenciesAbsent() {
      return [names.postgres, names.redis].every((name) => docker(["inspect", name]).status !== 0)
        && docker(["network", "inspect", names.network]).status !== 0;
    },
    async removeRunData() {
      const acceptanceRoot = resolve(repoRoot, "artifacts", "native-acceptance");
      const target = resolve(runRoot);
      const path = relative(acceptanceRoot, target);
      if (!path || path === ".." || path.startsWith(`..${sep}`)) throw new Error("Refusing to remove an unsafe Windows acceptance path.");
      rmSync(target, { recursive: true, force: true });
    },
  };
}

export async function runWindowsNativeAcceptance({
  bundlePath,
  bundleDigest = "0".repeat(64),
  runId,
  repoRoot,
  commit,
  version,
  evidenceOutputDir,
  isElevated = defaultWindowsElevationCheck,
  effects,
  evidenceWriter = writeAcceptanceEvidence,
  passwordFactory = () => randomBytes(24).toString("base64url"),
  progress = () => {},
} = {}) {
  if (!bundlePath || !runId || !repoRoot) throw new Error("Windows Native acceptance requires bundlePath, runId, and repoRoot.");
  if (!isElevated()) throw new Error("WINDOWS_ELEVATION_REQUIRED");
  const host = effects || createWindowsAcceptanceEffects({ bundlePath, repoRoot, runId, progress });
  const databasePassword = passwordFactory();
  const scenarios = [];
  let installAttempted = false;
  let failure;
  let dependencyCleanup = false;

  try {
    await host.assertServicesAbsent();
    const endpoints = await host.startDependencies({ databasePassword });
    const environment = {
      ARCHIVE_NATIVE_INSTALL_ROOT: bundlePath,
      ARCHIVE_INSTALLATION_MANIFEST_PATH: join(repoRoot, "artifacts", "native-acceptance", `windows-run-${runId}`, "installation-manifest.json"),
      ARCHIVE_NATIVE_POSTGRES_HOST: "127.0.0.1",
      ARCHIVE_NATIVE_POSTGRES_PORT: String(endpoints.postgresPort),
      ARCHIVE_NATIVE_POSTGRES_DATABASE: "archive",
      ARCHIVE_NATIVE_POSTGRES_USERNAME: "archive",
      ARCHIVE_NATIVE_POSTGRES_PASSWORD: databasePassword,
      ARCHIVE_NATIVE_REDIS_HOST: "127.0.0.1",
      ARCHIVE_NATIVE_REDIS_PORT: String(endpoints.redisPort),
    };
    installAttempted = true;
    await host.install({ environment });
    scenarios.push({ name: "install", ok: true });
    await host.waitForServices();
    scenarios.push({ name: "six-services-active", ok: true });
    await host.waitForHttp();
    scenarios.push({ name: "http-health", ok: true });
    await host.uninstall();
    installAttempted = false;
    await host.proveApplicationCleanup();
    await host.assertServicesAbsent();
    scenarios.push({ name: "uninstall", ok: true });
  } catch (error) {
    failure = error;
    if (installAttempted) {
      try { await host.uninstall(); } catch {}
    }
  } finally {
    try {
      await host.stopDependencies();
      dependencyCleanup = await host.proveDependenciesAbsent();
      if (!failure && dependencyCleanup) await host.removeRunData();
    } catch (error) {
      failure ||= error;
    }
  }

  if (failure) throw failure;
  if (!dependencyCleanup) throw new Error("Windows Native acceptance could not prove Docker resource cleanup.");
  const cleanup = { ok: true, dockerResourcesAbsent: true, servicesAbsent: true, applicationRootAbsent: true, acceptanceDataRemoved: true };
  const evidence = {
    platform: "windows-native",
    runId,
    commit,
    version,
    bundleDigest,
    environment: { isolation: "windows-host", elevated: true, dependencies: "docker-loopback" },
    scenarios,
    cleanup,
    createdAt: new Date().toISOString(),
  };
  const evidencePath = evidenceWriter(evidence, { outputDir: evidenceOutputDir });
  return { ok: true, evidencePath, scenarios, cleanup };
}
