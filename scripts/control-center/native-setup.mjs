// V1-210B / V1-211B CLI wiring: assemble a runnable Native runtime adapter
// from a resolved setup configuration by joining the platform host-effects
// (real winsw/icacls/netsh or systemctl/chown commands) to the shared
// lifecycle engine and the shared data gate. Everything the host touches —
// the command runner, file writer, probes, managed-PostgreSQL starter — is
// injected, so this module is unit-testable and the same code path an
// operator runs is the one the tests exercise. Support stays experimental
// (planned) until V1-210D/V1-211D clean-host evidence, per the V1-212C gate.
import { createLinuxHostEffects } from "./linux-host-effects.mjs";
import { createLinuxNativeRuntimeAdapter, createLinuxServiceRemover } from "./linux-runtime-adapter.mjs";
import { LINUX_SERVICES, LINUX_SERVICE_USER } from "./linux-services.mjs";
import { createNativeDataGate, resolveNativeDataPlan } from "./native-data-services.mjs";
import { createManagedDataProvisioner } from "./native-managed-data.mjs";
import { createWindowsHostEffects } from "./windows-host-effects.mjs";
import { createWindowsNativeRuntimeAdapter, createWindowsServiceRemover } from "./windows-runtime-adapter.mjs";
import { WINDOWS_SERVICES } from "./windows-services.mjs";

export function nativePlatformFamily(platformId) {
  if (platformId === "windows-native") return "windows";
  if (platformId === "linux-native") return "linux";
  return null;
}

export function nativeServiceIds(platformId, dataPlan) {
  const family = nativePlatformFamily(platformId);
  const services = (family === "windows" ? WINDOWS_SERVICES : LINUX_SERVICES).map((service) => service.id);
  if (dataPlan?.postgres?.kind === "managed") services.push("archive-postgres");
  if (dataPlan?.redis?.kind === "managed") services.push("archive-redis");
  return services;
}

function withManagedDataLifecycle(adapter, serviceControl, dataPlan) {
  const dataServices = nativeServiceIds("windows-native", dataPlan)
    .filter((id) => id === "archive-postgres" || id === "archive-redis");
  const each = (action, ids = dataServices) => {
    for (const id of ids) {
      const result = serviceControl[action](id);
      if ((result?.status ?? 1) !== 0) return result;
    }
    return { status: 0 };
  };
  return {
    ...adapter,
    start: () => {
      const data = each("start");
      return (data.status ?? 1) === 0 ? adapter.start() : data;
    },
    stop: () => {
      const app = adapter.stop();
      if ((app.status ?? 1) !== 0) return app;
      return each("stop", [...dataServices].reverse());
    },
    restart: () => {
      const data = each("restart");
      return (data.status ?? 1) === 0 ? adapter.restart() : data;
    },
    status: () => {
      const data = each("query");
      return (data.status ?? 1) === 0 ? adapter.status() : data;
    },
  };
}

const DEFAULT_INSTALL_ROOT = { windows: "C:\\Program Files\\ArchiveSuite", linux: LINUX_SERVICE_USER.home };

export function nativeInstallRoot(platformId, override) {
  if (typeof override === "string" && override.trim()) return override;
  return DEFAULT_INSTALL_ROOT[nativePlatformFamily(platformId)];
}

// The installation manifest input for a Native install. `services` are the
// native service ids so uninstall/remove iterate exactly what was created.
export function nativeManifestInput(configuration, { version, installRoot, dataPlan } = {}) {
  return {
    version,
    source: configuration.source,
    mode: "native",
    platform: configuration.platform,
    runtimeProfiles: configuration.runtimeProfiles,
    capabilities: configuration.capabilities,
    artifacts: [],
    services: nativeServiceIds(configuration.platform, dataPlan),
    dataPaths: { storage: configuration.storage.path },
    ...(dataPlan ? { dataPlan } : {}),
    ownedPaths: [nativeInstallRoot(configuration.platform, installRoot)],
  };
}

// The Native data plan is derived from the normalized declarative setup
// configuration. An explicit environment override is retained for unattended
// external-database deployments and takes precedence when present. A release
// bundle without that override uses its verified managed data payload.
export function resolveNativeSetupDataPlan(configuration, dataPlanOverride) {
  const selected = dataPlanOverride
    ? resolveNativeDataPlan(dataPlanOverride)
    : configuration?.dataServices?.postgres?.kind
      ? resolveNativeDataPlan({
        postgres: configuration.dataServices.postgres,
        redis: configuration.dataServices.redis,
      })
      : resolveNativeDataPlan({ postgres: { kind: "local-managed" } });
  if (!selected.ok) return selected;
  return { ...selected, plan: { ...selected.plan, pgAdmin: configuration?.platform === "windows-native" } };
}

// Existing unattended deployments can opt into external PostgreSQL/Redis by
// supplying their endpoints through the environment. Without that override,
// the normalized Native configuration selects the bundled managed services.
export function nativeDataPlanOverrideFromEnv(env = {}) {
  const host = env.ARCHIVE_NATIVE_POSTGRES_HOST;
  if (!host) return undefined;
  const redisHost = env.ARCHIVE_NATIVE_REDIS_HOST;
  return {
    postgres: {
      kind: "external",
      host,
      port: Number(env.ARCHIVE_NATIVE_POSTGRES_PORT || 5432),
      database: env.ARCHIVE_NATIVE_POSTGRES_DATABASE || "archive",
    },
    redis: redisHost ? { enabled: true, host: redisHost, port: Number(env.ARCHIVE_NATIVE_REDIS_PORT || 6379) } : { enabled: false },
  };
}

// Build the live Native runtime + its manifest-owned service remover. Callers
// inject the host seams (run/writeFile), the manifest store, preflight, the
// resolved data plan, probes, and — for a release bundle — its managed-data
// secrets and verified payload reader.
export function buildNativeRuntime({
  configuration,
  installRoot,
  run,
  writeFile,
  ensureDirectory,
  copyFile,
  readDataPackage,
  health,
  manifestStore,
  manifestRequest,
  preflight,
  dataPlan,
  probes,
  startLocalPostgres,
  startManagedData,
  managedDataSecrets,
  appConfig,
} = {}) {
  const family = nativePlatformFamily(configuration?.platform);
  if (!family) throw new Error(`"${configuration?.platform}" is not a Native platform.`);
  const root = nativeInstallRoot(configuration.platform, installRoot);
  // No probes wired → an honest gate that reports the managed runtime / probe
  // wiring is not present, rather than silently skipping the safety check.
  const dataGate = probes
    ? createNativeDataGate({ probes, startLocalPostgres, startManagedData })
    : async (plan) => ((plan?.postgres?.kind === "managed" || plan?.redis?.kind === "managed")
      ? { ok: false, code: "MANAGED_DATA_UNAVAILABLE", message: "The managed PostgreSQL and Redis-compatible services are not wired into this installer.", details: {}, nextActions: ["Choose external data services, or use a build that bundles the managed data services."] }
      : plan?.postgres?.kind === "local-managed"
      ? { ok: false, code: "LOCAL_POSTGRES_UNAVAILABLE", message: "The locally managed PostgreSQL runtime is not bundled in this build.", details: {}, nextActions: ["Point the install at an external PostgreSQL endpoint, or use a build that bundles the managed instance."] }
      : { ok: false, code: "DATA_PROBES_UNAVAILABLE", message: "External data endpoints cannot be verified without probes wired into this build.", details: {}, nextActions: ["Use a build with data probes wired, or run a Docker install."] });

  if (family === "windows") {
    const managedServiceIds = nativeServiceIds(configuration.platform, dataPlan).filter((id) => id === "archive-postgres" || id === "archive-redis");
    const effects = createWindowsHostEffects({ installRoot: root, storagePath: configuration.storage.path, run, writeFile, ensureDirectory, copyFile, readDataPackage, managedServiceIds });
    const managedProvisioner = managedDataSecrets && probes?.pgvector
      ? createManagedDataProvisioner({ platform: configuration.platform, effects, probes, secrets: managedDataSecrets })
      : startManagedData;
    const windowsDataGate = probes
      ? createNativeDataGate({ probes, startLocalPostgres, startManagedData: managedProvisioner })
      : dataGate;
    const adapter = createWindowsNativeRuntimeAdapter({
      serviceControl: effects.serviceControl,
      applyAcls: effects.applyAcls,
      // Only public access opens the inbound firewall rule; local/intranet
      // installs stay loopback-only.
      applyFirewallRules: configuration.access === "public" ? effects.applyFirewallRules : undefined,
      // appConfig is undefined in tests that don't supply it; writeAppConfig
      // then no-ops (see createWindowsNativeRuntimeAdapter), same pattern as
      // applyFirewallRules above.
      writeAppConfig: appConfig
        ? () => effects.writeAppConfig({ access: configuration.access, domain: appConfig.domain, dataPlan, storagePath: configuration.storage.path, appKey: appConfig.appKey, appUrl: appConfig.appUrl, dbUsername: appConfig.dbUsername, dbPassword: appConfig.dbPassword, redisPassword: appConfig.redisPassword })
        : undefined,
      migrateDatabase: () => effects.exec(["migrate", "--force"]),
      health,
      logs: effects.logs,
      exec: effects.exec,
      manifestStore,
      manifestRequest,
      preflight,
      dataGate: windowsDataGate,
      dataPlan,
    });
    return { adapter: withManagedDataLifecycle(adapter, effects.serviceControl, dataPlan), removeServices: createWindowsServiceRemover({ serviceControl: effects.serviceControl, removeFirewallRules: effects.removeFirewallRules }) };
  }

  const effects = createLinuxHostEffects({ installRoot: root, storagePath: configuration.storage.path, run, writeFile, ensureDirectory, copyFile, readDataPackage });
  const managedProvisioner = managedDataSecrets && probes?.pgvector
    ? createManagedDataProvisioner({ platform: configuration.platform, effects, probes, secrets: managedDataSecrets })
    : startManagedData;
  const linuxDataGate = probes
    ? createNativeDataGate({ probes, startLocalPostgres, startManagedData: managedProvisioner })
    : dataGate;
  const adapter = createLinuxNativeRuntimeAdapter({
    serviceControl: effects.serviceControl,
    applyOwnership: effects.applyOwnership,
    applyLogrotate: effects.applyLogrotate,
    writeAppConfig: appConfig
      ? () => effects.writeAppConfig({ access: configuration.access, domain: appConfig.domain, dataPlan, storagePath: configuration.storage.path, appKey: appConfig.appKey, appUrl: appConfig.appUrl, dbUsername: appConfig.dbUsername, dbPassword: appConfig.dbPassword, redisPassword: appConfig.redisPassword })
      : undefined,
    migrateDatabase: () => effects.exec(["migrate", "--force"]),
    // Linux firewall stays opt-in per the platform contract; the default
    // host-effects layer provides none.
    health,
    logs: effects.logs,
    exec: effects.exec,
    manifestStore,
    manifestRequest,
    preflight,
    dataGate: linuxDataGate,
    dataPlan,
  });
  return { adapter: withManagedDataLifecycle(adapter, effects.serviceControl, dataPlan), removeServices: createLinuxServiceRemover({ serviceControl: effects.serviceControl }) };
}

export function buildNativeServiceRemover({ platform, installRoot, run, writeFile } = {}) {
  const family = nativePlatformFamily(platform);
  if (!family) throw new Error(`"${platform}" is not a Native platform.`);
  const root = nativeInstallRoot(platform, installRoot);
  if (family === "windows") {
    const effects = createWindowsHostEffects({ installRoot: root, run, writeFile });
    return createWindowsServiceRemover({ serviceControl: effects.serviceControl, removeFirewallRules: effects.removeFirewallRules });
  }
  const effects = createLinuxHostEffects({ installRoot: root, run, writeFile });
  return createLinuxServiceRemover({ serviceControl: effects.serviceControl });
}
