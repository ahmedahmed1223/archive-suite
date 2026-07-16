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
import { createWindowsHostEffects } from "./windows-host-effects.mjs";
import { createWindowsNativeRuntimeAdapter, createWindowsServiceRemover } from "./windows-runtime-adapter.mjs";
import { WINDOWS_SERVICES } from "./windows-services.mjs";

export function nativePlatformFamily(platformId) {
  if (platformId === "windows-native") return "windows";
  if (platformId === "linux-native") return "linux";
  return null;
}

export function nativeServiceIds(platformId) {
  const family = nativePlatformFamily(platformId);
  return (family === "windows" ? WINDOWS_SERVICES : LINUX_SERVICES).map((service) => service.id);
}

const DEFAULT_INSTALL_ROOT = { windows: "C:\\Program Files\\ArchiveSuite", linux: LINUX_SERVICE_USER.home };

export function nativeInstallRoot(platformId, override) {
  if (typeof override === "string" && override.trim()) return override;
  return DEFAULT_INSTALL_ROOT[nativePlatformFamily(platformId)];
}

// The installation manifest input for a Native install. `services` are the
// native service ids so uninstall/remove iterate exactly what was created.
export function nativeManifestInput(configuration, { version }) {
  return {
    version,
    source: configuration.source,
    mode: "native",
    platform: configuration.platform,
    runtimeProfiles: configuration.runtimeProfiles,
    capabilities: configuration.capabilities,
    artifacts: [],
    services: nativeServiceIds(configuration.platform),
    dataPaths: { storage: configuration.storage.path },
  };
}

// The Native data plan. The declarative setup schema does not (yet) carry a
// local/external PostgreSQL choice or an external endpoint, so the default is
// the locally managed instance; an operator overrides via `dataPlanOverride`
// (the same shape resolveNativeDataPlan accepts) until the schema grows the
// field. Redis stays on the database baseline unless an endpoint is given.
export function resolveNativeSetupDataPlan(configuration, dataPlanOverride) {
  return resolveNativeDataPlan(dataPlanOverride || { postgres: { kind: "local-managed" } });
}

// Build the live Native runtime + its manifest-owned service remover. Callers
// inject the host seams (run/writeFile), the manifest store, preflight, the
// resolved data plan, probes, and — when the build bundles it — the managed
// PostgreSQL starter.
export function buildNativeRuntime({
  configuration,
  installRoot,
  run,
  writeFile,
  health,
  manifestStore,
  manifestRequest,
  preflight,
  dataPlan,
  probes,
  startLocalPostgres,
} = {}) {
  const family = nativePlatformFamily(configuration?.platform);
  if (!family) throw new Error(`"${configuration?.platform}" is not a Native platform.`);
  const root = nativeInstallRoot(configuration.platform, installRoot);
  // No probes wired → an honest gate that reports the managed runtime / probe
  // wiring is not present, rather than silently skipping the safety check.
  const dataGate = probes
    ? createNativeDataGate({ probes, startLocalPostgres })
    : async (plan) => (plan?.postgres?.kind === "local-managed"
      ? { ok: false, code: "LOCAL_POSTGRES_UNAVAILABLE", message: "The locally managed PostgreSQL runtime is not bundled in this build.", details: {}, nextActions: ["Point the install at an external PostgreSQL endpoint, or use a build that bundles the managed instance."] }
      : { ok: false, code: "DATA_PROBES_UNAVAILABLE", message: "External data endpoints cannot be verified without probes wired into this build.", details: {}, nextActions: ["Use a build with data probes wired, or run a Docker install."] });

  if (family === "windows") {
    const effects = createWindowsHostEffects({ installRoot: root, run, writeFile });
    const adapter = createWindowsNativeRuntimeAdapter({
      serviceControl: effects.serviceControl,
      applyAcls: effects.applyAcls,
      // Only public access opens the inbound firewall rule; local/intranet
      // installs stay loopback-only.
      applyFirewallRules: configuration.access === "public" ? effects.applyFirewallRules : undefined,
      health,
      logs: effects.logs,
      exec: effects.exec,
      manifestStore,
      manifestRequest,
      preflight,
      dataGate,
      dataPlan,
    });
    return { adapter, removeServices: createWindowsServiceRemover({ serviceControl: effects.serviceControl, removeFirewallRules: effects.removeFirewallRules }) };
  }

  const effects = createLinuxHostEffects({ installRoot: root, run, writeFile });
  const adapter = createLinuxNativeRuntimeAdapter({
    serviceControl: effects.serviceControl,
    applyOwnership: effects.applyOwnership,
    applyLogrotate: effects.applyLogrotate,
    // Linux firewall stays opt-in per the platform contract; the default
    // host-effects layer provides none.
    health,
    logs: effects.logs,
    exec: effects.exec,
    manifestStore,
    manifestRequest,
    preflight,
    dataGate,
    dataPlan,
  });
  return { adapter, removeServices: createLinuxServiceRemover({ serviceControl: effects.serviceControl }) };
}
