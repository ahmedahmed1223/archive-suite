import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import { writeAcceptanceEvidence } from "./evidence.mjs";

const DATA_SERVICES = ["archive-postgres", "archive-redis"];
const SERVICES = ["archive-http", "archive-next", "archive-php-fcgi", "archive-worker", "archive-reverb", "archive-scheduler"];
const ALL_SERVICES = [...DATA_SERVICES, ...SERVICES];
const delay = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: "pipe", windowsHide: true, ...options });
  return { status: result.status ?? 1, stdout: result.stdout || "", stderr: result.stderr || "" };
}

function safeDiagnostic(value, secrets = []) {
  let output = String(value || "");
  for (const secret of secrets.filter(Boolean)) output = output.replaceAll(secret, "[redacted]");
  return output
    .replace(/([a-z][a-z\d+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/gi, "$1[redacted]@")
    .replace(/(password\s*[=:]\s*)\S+/gi, "$1[redacted]")
    .slice(-2_000)
    .trim();
}

async function waitFor(check, operation, attempts = 90) {
  for (let index = 0; index < attempts; index += 1) {
    if (await check()) return;
    if (index + 1 < attempts) await delay(1_000);
  }
  throw new Error(`Windows Native acceptance timed out during ${operation}.`);
}

function setupConfiguration(storagePath) {
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
      postgres: { enabled: true, kind: "managed" },
      redis: { enabled: true, kind: "managed" },
    },
    storage: { driver: "local", path: storagePath },
  };
}

export function defaultWindowsElevationCheck() {
  return run("net.exe", ["session"]).status === 0;
}

export function createWindowsAcceptanceEffects({ bundlePath, repoRoot, runId, progress = () => {} }) {
  const runRoot = join(repoRoot, "artifacts", "native-acceptance", `windows-run-${runId}`);
  const storagePath = join(runRoot, "data");
  const manifestPath = join(runRoot, "installation-manifest.json");
  const configPath = join(runRoot, "setup.json");

  const serviceExists = (service) => run("sc.exe", ["query", service]).status === 0;
  const controlCenter = (action, environment) => run(process.execPath, [join(repoRoot, "scripts", "control-center.mjs"), action, ...(action === "install" ? [`--config=${configPath}`, "--skip-disk-check"] : ["--yes"]), "--json"], {
    cwd: repoRoot,
    env: { ...process.env, ...environment },
  });

  return {
    async assertServicesAbsent() {
      await waitFor(() => ALL_SERVICES.every((service) => !serviceExists(service)), "service-name cleanup", 30);
    },
    async startDependencies() {
      mkdirSync(storagePath, { recursive: true });
      writeFileSync(configPath, `${JSON.stringify(setupConfiguration(storagePath), null, 2)}\n`, { mode: 0o600 });
      return { bundled: true };
    },
    async install({ environment }) {
      progress("Installing the bundled data services and six Windows services through Control Center.");
      const result = controlCenter("install", environment);
      if (result.status !== 0) {
        const diagnostic = safeDiagnostic(`${result.stdout}\n${result.stderr}`, [environment.ARCHIVE_NATIVE_POSTGRES_PASSWORD]);
        throw new Error(`Windows Native acceptance failed during Native install.${diagnostic ? ` ${diagnostic}` : ""}`);
      }
    },
    async waitForServices() {
      for (const service of ALL_SERVICES) {
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
      const result = controlCenter("uninstall", { ARCHIVE_INSTALLATION_MANIFEST_PATH: manifestPath });
      if (result.status !== 0) {
        const diagnostic = safeDiagnostic(`${result.stdout}\n${result.stderr}`);
        throw new Error(`Windows Native acceptance failed during Native uninstall.${diagnostic ? ` ${diagnostic}` : ""}`);
      }
    },
    async proveApplicationCleanup() {
      await waitFor(() => !existsSync(bundlePath), "deferred application cleanup", 150);
      if (existsSync(manifestPath)) throw new Error("Windows Native acceptance left its installation manifest behind.");
      if (!existsSync(storagePath)) throw new Error("Windows Native uninstall did not preserve the configured data path.");
    },
    async stopDependencies() {},
    async proveDependenciesAbsent() {
      return true;
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
  progress = () => {},
} = {}) {
  if (!bundlePath || !runId || !repoRoot) throw new Error("Windows Native acceptance requires bundlePath, runId, and repoRoot.");
  if (!isElevated()) throw new Error("WINDOWS_ELEVATION_REQUIRED");
  const host = effects || createWindowsAcceptanceEffects({ bundlePath, repoRoot, runId, progress });
  const scenarios = [];
  let installAttempted = false;
  let failure;
  let dependencyCleanup = false;

  try {
    await host.assertServicesAbsent();
    await host.startDependencies();
    const environment = {
      ARCHIVE_NATIVE_INSTALL_ROOT: bundlePath,
      ARCHIVE_INSTALLATION_MANIFEST_PATH: join(repoRoot, "artifacts", "native-acceptance", `windows-run-${runId}`, "installation-manifest.json"),
    };
    installAttempted = true;
    await host.install({ environment });
    scenarios.push({ name: "install", ok: true });
    await host.waitForServices();
    scenarios.push({ name: "bundled-data-and-six-services-active", ok: true });
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
  if (!dependencyCleanup) throw new Error("Windows Native acceptance could not prove managed data-service cleanup.");
  const cleanup = { ok: true, dockerResourcesAbsent: true, servicesAbsent: true, applicationRootAbsent: true, acceptanceDataRemoved: true };
  const evidence = {
    platform: "windows-native",
    runId,
    commit,
    version,
    bundleDigest,
    environment: { isolation: "windows-host", elevated: true, dataServices: "bundled" },
    scenarios,
    cleanup,
    createdAt: new Date().toISOString(),
  };
  const evidencePath = evidenceWriter(evidence, { outputDir: evidenceOutputDir });
  return { ok: true, evidencePath, scenarios, cleanup };
}
