// V1-210B: Windows Native runtime adapter implementing the same contract as
// createDockerRuntimeAdapter (runtime-adapter.mjs). Every host effect is
// injected — service control (WinSW/sc), ACLs, firewall, health, logs — so
// the full Setup cycle is unit-testable without a Windows host. The install
// sequence records each step in the installation manifest, and uninstall
// removes only the services and firewall rules the manifest owns.
import { WINDOWS_SERVICES } from "./windows-services.mjs";

// Ordered install steps after host-preflight. Each maps to one injected
// effect; a failure marks the manifest with exactly this step name so repair
// can resume from it.
export const WINDOWS_INSTALL_STEPS = ["data-services-ready", "acl-applied", "firewall-applied", "services-installed", "services-started"];

function completed(result, { includeOutput = false } = {}) {
  const status = result?.status ?? 1;
  const response = { ok: status === 0, supported: true, status };
  if (includeOutput && result?.stdout !== undefined) response.stdout = result.stdout;
  if (includeOutput && result?.stderr !== undefined) response.stderr = result.stderr;
  return response;
}

function unsupported(operation) {
  return { ok: false, supported: false, operation, reason: "unsupported" };
}

export function createWindowsNativeRuntimeAdapter({
  services = WINDOWS_SERVICES,
  serviceControl, // { install(service), remove(id), start(id), stop(id), restart(id), query(id) } -> { status, stdout? }
  applyAcls, // () -> { status } — install-root/log ACLs for the virtual service accounts
  applyFirewallRules, // () -> { status } — inbound rule for archive-http only
  health,
  logs, // ({ follow }) -> { status, stdout? }
  exec, // (args, options) -> { status, stdout?, stderr? }
  manifestStore,
  manifestRequest,
  preflight,
  dataGate, // async (plan) -> result envelope from createWindowsDataGate
  dataPlan,
  updateOperation,
  rollbackOperation,
  uninstallOperation,
} = {}) {
  const forEachService = (action) => {
    for (const service of services) {
      const result = action(service);
      if ((result?.status ?? 1) !== 0) return completed(result);
    }
    return completed({ status: 0 });
  };

  const runStep = (step) => {
    switch (step) {
      case "acl-applied": return applyAcls ? applyAcls() : { status: 0 };
      case "firewall-applied": return applyFirewallRules ? applyFirewallRules() : { status: 0 };
      case "services-installed": {
        for (const service of services) {
          const result = serviceControl.install(service);
          if ((result?.status ?? 1) !== 0) return result;
        }
        return { status: 0 };
      }
      case "services-started": {
        for (const service of services) {
          const result = serviceControl.start(service.id);
          if ((result?.status ?? 1) !== 0) return result;
        }
        return { status: 0 };
      }
      default: return { status: 1 };
    }
  };

  const installOrRepair = async (operation, request = manifestRequest) => {
    if (preflight) {
      const verdict = preflight();
      if (!verdict.ok) {
        if (manifestStore && request) {
          try { manifestStore.markInstallationFailed({ ...request, failedStep: "host-preflight", nextActions: verdict.nextActions }); }
          catch { /* the preflight verdict is the answer; never mask it with a manifest error */ }
        }
        return { ok: false, supported: true, ...verdict };
      }
    }
    const session = manifestStore && request ? manifestStore.beginInstallationOperation({ ...request, operation }) : null;
    const decision = session?.decision;
    if (decision?.action === "resume" && decision.nextStep === null) {
      manifestStore.updateLastSuccessfulStep({ ...request, step: decision.after });
      return completed({ status: 0 });
    }
    // Data services are verified before any Windows resource is created, so a
    // bad endpoint blocks the install with a stable code (V1-210C).
    if (dataGate) {
      const gate = await dataGate(dataPlan);
      if (!gate.ok) {
        if (manifestStore && request) {
          try { manifestStore.markInstallationFailed({ ...request, failedStep: "data-services-ready", nextActions: gate.nextActions }); }
          catch { /* the gate verdict is the answer */ }
        }
        return { ok: false, supported: true, ...gate };
      }
    }
    if (manifestStore && request) manifestStore.updateLastSuccessfulStep({ ...request, step: "data-services-ready" });
    for (const step of WINDOWS_INSTALL_STEPS.slice(1)) {
      let result;
      try { result = runStep(step); }
      catch (error) {
        if (manifestStore && request) {
          try { manifestStore.markInstallationFailed({ ...request, failedStep: step, nextActions: [`Windows step "${step}" terminated unexpectedly. Review the setup log and run repair.`] }); }
          catch { /* never hide the original error */ }
        }
        try { error.controlCenterOperation = step; } catch { /* preserve the original error */ }
        throw error;
      }
      if ((result?.status ?? 1) !== 0) {
        if (manifestStore && request) manifestStore.markInstallationFailed({ ...request, failedStep: step, nextActions: [`Windows step "${step}" failed. Review the setup log and run repair.`] });
        return completed(result);
      }
      if (manifestStore && request) manifestStore.updateLastSuccessfulStep({ ...request, step });
    }
    return completed({ status: 0 });
  };

  return {
    install: (request) => installOrRepair("install", request),
    repair: (request) => installOrRepair("repair", request),
    start: () => forEachService((service) => serviceControl.start(service.id)),
    stop: () => forEachService((service) => serviceControl.stop(service.id)),
    restart: () => forEachService((service) => serviceControl.restart(service.id)),
    status: () => forEachService((service) => serviceControl.query(service.id)),
    health: async () => completed(await health()),
    logs: ({ follow = false } = {}) => completed(logs({ follow })),
    exec: (args, options = {}) => completed(exec(args, options), { includeOutput: true }),
    update: (request) => (updateOperation ? updateOperation(request) : unsupported("update")),
    rollback: (request) => (rollbackOperation ? rollbackOperation(request) : unsupported("rollback")),
    uninstall: (request) => (uninstallOperation ? uninstallOperation(request) : unsupported("uninstall")),
  };
}

// V1-210B uninstall side: removes ONLY what the installation manifest records
// ownership of — its services and their per-service firewall rules. Plugs into
// createUninstall (uninstall.mjs) as the injected removeServices dependency,
// which supplies the confirmation/backup gating.
export function createWindowsServiceRemover({ serviceControl, removeFirewallRules }) {
  return async function removeServices({ manifest }) {
    for (const id of manifest.services) {
      // Stop is best-effort (an already-stopped service is fine); only a
      // failed removal aborts, leaving the manifest intact for a retry.
      serviceControl.stop(id);
      const removed = serviceControl.remove(id);
      if ((removed?.status ?? 1) !== 0) return { ok: false };
    }
    if (removeFirewallRules) {
      const cleared = removeFirewallRules(manifest.services);
      if ((cleared?.status ?? 1) !== 0) return { ok: false };
    }
    return { ok: true };
  };
}
