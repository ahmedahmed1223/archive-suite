// V1-210B / V1-211B: shared Native runtime adapter implementing the same
// contract as createDockerRuntimeAdapter (runtime-adapter.mjs). The platform
// modules (windows-runtime-adapter.mjs, linux-runtime-adapter.mjs) supply
// their install steps and service topology; every host effect is injected so
// the full Setup cycle is unit-testable without a real host. The install
// sequence records each step in the installation manifest so repair can
// resume from the exact failed step.

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

export function createNativeRuntimeAdapter({
  services,
  serviceControl, // { install(service), remove(id), start(id), stop(id), restart(id), query(id) } -> { status, stdout? }
  installSteps = [], // ordered [{ step, run }] executed after data-services-ready; run() -> { status }
  health,
  logs, // ({ follow }) -> { status, stdout? }
  exec, // (args, options) -> { status, stdout?, stderr? }
  manifestStore,
  manifestRequest,
  preflight,
  dataGate, // async (plan) -> result envelope from createNativeDataGate
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
    // Data services are verified before any host resource is created, so a
    // bad endpoint blocks the install with a stable code (V1-210C/V1-211C).
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
    for (const { step, run } of installSteps) {
      let result;
      try { result = run(); }
      catch (error) {
        if (manifestStore && request) {
          try { manifestStore.markInstallationFailed({ ...request, failedStep: step, nextActions: [`Native step "${step}" terminated unexpectedly. Review the setup log and run repair.`] }); }
          catch { /* never hide the original error */ }
        }
        try { error.controlCenterOperation = step; } catch { /* preserve the original error */ }
        throw error;
      }
      if ((result?.status ?? 1) !== 0) {
        if (manifestStore && request) manifestStore.markInstallationFailed({ ...request, failedStep: step, nextActions: [`Native step "${step}" failed. Review the setup log and run repair.`] });
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

// Shared install-step builders every Native platform ends with: register each
// service with the host service manager, then start them in topology order.
export function serviceInstallSteps({ services, serviceControl }) {
  const fanOut = (action) => () => {
    for (const service of services) {
      const result = action(service);
      if ((result?.status ?? 1) !== 0) return result;
    }
    return { status: 0 };
  };
  return [
    { step: "services-installed", run: fanOut((service) => serviceControl.install(service)) },
    { step: "services-started", run: fanOut((service) => serviceControl.start(service.id)) },
  ];
}

// V1-210B/V1-211B uninstall side: removes ONLY what the installation manifest
// records ownership of — its services and their per-service firewall rules.
// Plugs into createUninstall (uninstall.mjs) as the injected removeServices
// dependency, which supplies the confirmation/backup gating.
export function createNativeServiceRemover({ serviceControl, removeFirewallRules }) {
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
