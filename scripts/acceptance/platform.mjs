/**
 * V1-806 provider contract.  Adapters are deliberately thin: a provider owns
 * its host and only advertises capabilities it can prove for this run.
 */
export const PROVIDER_KINDS = Object.freeze([
  "docker", "windows-native", "linux-native", "hyperv-windows", "hyperv-linux", "wsl2-linux", "external",
]);

export const LIFECYCLE_SCENARIOS = Object.freeze([
  { id: "V1-IA-LIFE-001", title: "First install and first run", tags: ["nightly", "rc", "ga"], capabilities: ["install"], destructive: false },
  { id: "V1-IA-LIFE-002", title: "Offline bundle installation", tags: ["nightly", "rc", "ga"], capabilities: ["offline-install"], destructive: false },
  { id: "V1-IA-LIFE-003", title: "Reboot and service reconnect", tags: ["nightly", "rc", "ga"], capabilities: ["reboot"], destructive: false },
  { id: "V1-IA-LIFE-004", title: "Reconnect after service restart", tags: ["nightly", "rc", "ga"], capabilities: ["service-restart"], destructive: false },
  { id: "V1-IA-LIFE-005", title: "Update and rollback retains data", tags: ["rc", "ga"], capabilities: ["update", "rollback"], destructive: true },
  { id: "V1-IA-LIFE-006", title: "Uninstall and keep data reconnect", tags: ["rc", "ga"], capabilities: ["uninstall", "keep-data"], destructive: true },
  { id: "V1-IA-LIFE-007", title: "Port failure is diagnosable and recoverable", tags: ["nightly", "rc", "ga"], capabilities: ["fault-port"], destructive: false },
  { id: "V1-IA-LIFE-008", title: "DNS failure is diagnosable and recoverable", tags: ["nightly", "rc", "ga"], capabilities: ["fault-dns"], destructive: false },
  { id: "V1-IA-LIFE-009", title: "TLS failure is diagnosable and recoverable", tags: ["nightly", "rc", "ga"], capabilities: ["fault-tls"], destructive: false },
  { id: "V1-IA-LIFE-010", title: "Disk pressure is diagnosable and recoverable", tags: ["nightly", "rc", "ga"], capabilities: ["fault-disk"], destructive: false },
  { id: "V1-IA-LIFE-011", title: "Dependent service failure is diagnosable and recoverable", tags: ["nightly", "rc", "ga"], capabilities: ["fault-service"], destructive: false },
]);

export function isDestructiveScenario(scenario) {
  return scenario?.destructive === true;
}

export function assertProviderContract(provider) {
  if (!provider || typeof provider !== "object") throw new Error("acceptance provider is required");
  if (!PROVIDER_KINDS.includes(provider.name)) throw new Error("provider name is not supported");
  if (!provider.target || typeof provider.target !== "object" || !PROVIDER_KINDS.includes(provider.target.kind)) {
    throw new Error("provider target is required");
  }
  if (!Array.isArray(provider.capabilities) || provider.capabilities.some((value) => typeof value !== "string" || !value)) {
    throw new Error("provider capabilities are invalid");
  }
  if (provider.target.kind === "wsl2-linux" && provider.target.cleanHost === true) {
    throw new Error("WSL2 cannot claim clean-host Linux acceptance");
  }
  return provider;
}

/**
 * Adapter constructor shared by Windows Native, Linux Native, Hyper-V, WSL2
 * and externally-produced evidence.  It intentionally does not invent host
 * commands: the caller supplies only operations it owns and can audit.
 */
export function createCapabilityProvider({ name, target, capabilities = [], operations = {} }) {
  const provider = { name, target, capabilities: Object.freeze([...capabilities]), ...operations };
  return Object.freeze(assertProviderContract(provider));
}

export const createWindowsNativeProvider = (options) => createCapabilityProvider({ ...options, name: "windows-native", target: { kind: "windows-native", ...(options?.target ?? {}) } });
export const createLinuxNativeProvider = (options) => createCapabilityProvider({ ...options, name: "linux-native", target: { kind: "linux-native", ...(options?.target ?? {}) } });
export const createHyperVWindowsProvider = (options) => createCapabilityProvider({ ...options, name: "hyperv-windows", target: { kind: "hyperv-windows", ...(options?.target ?? {}) } });
export const createHyperVLinuxProvider = (options) => createCapabilityProvider({ ...options, name: "hyperv-linux", target: { kind: "hyperv-linux", ...(options?.target ?? {}) } });
export const createWsl2LinuxProvider = (options) => createCapabilityProvider({ ...options, name: "wsl2-linux", target: { kind: "wsl2-linux", ...(options?.target ?? {}) } });
export const createExternalEvidenceProvider = (options) => createCapabilityProvider({ ...options, name: "external", target: { kind: "external", ...(options?.target ?? {}) } });

/** Returns immutable evidence required before a destructive acceptance step. */
export async function snapshotForScenario(provider, scenario, context = {}) {
  if (!isDestructiveScenario(scenario)) return undefined;
  assertProviderContract(provider);
  if (typeof provider.snapshot !== "function") throw new Error(`provider snapshot is required before destructive scenario ${scenario.id}`);
  const snapshot = await provider.snapshot({ scenario, ...context });
  if (!snapshot || typeof snapshot.id !== "string" || !snapshot.id.trim()) {
    throw new Error(`provider snapshot must return an immutable snapshot id for ${scenario.id}`);
  }
  return Object.freeze({ ...snapshot, id: snapshot.id.trim() });
}
