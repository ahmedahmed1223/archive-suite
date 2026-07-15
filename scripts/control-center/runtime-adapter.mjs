// Runtime adapter contract used by the Control Center. Native adapters may
// implement it later; this release only supplies the Docker Compose adapter.
export const RUNTIME_OPERATIONS = [
  "install", "repair", "start", "stop", "restart", "status", "health", "logs", "exec", "update", "rollback", "uninstall",
];

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

export function createDockerRuntimeAdapter({ compose, health, manifestStore, manifestRequest, buildLocal = false, updateOperation, rollbackOperation, uninstallOperation, preflight } = {}) {
  const installOrRepair = (operation, request = manifestRequest) => {
    // V1-208L: host preconditions are checked before anything is written or
    // started, so a host that cannot hold the install fails with a stable code
    // instead of a half-created stack. Preflight is sync like compose(), and
    // opt-in: adapters that inject none behave exactly as before.
    if (preflight) {
      const verdict = preflight();
      if (!verdict.ok) {
        if (manifestStore && request) {
          try {
            manifestStore.markInstallationFailed({ ...request, failedStep: "host-preflight", nextActions: verdict.nextActions });
          } catch { /* the preflight verdict is the answer; never mask it with a manifest error */ }
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
    let result;
    try {
      result = completed(compose(["up", "-d", ...(buildLocal ? ["--build"] : [])]));
    } catch (error) {
      if (manifestStore && request) {
        try {
          manifestStore.markInstallationFailed({ ...request, failedStep: "services-start", nextActions: ["Docker Compose terminated unexpectedly. Review its output and run repair."] });
        } catch { /* never hide the original Compose error */ }
      }
      try { error.controlCenterOperation = "compose"; } catch { /* preserve the original error */ }
      throw error;
    }
    if (manifestStore && request) {
      if (result.ok) manifestStore.updateLastSuccessfulStep({ ...request, step: "services-started" });
      else manifestStore.markInstallationFailed({ ...request, failedStep: "services-start", nextActions: ["Check Docker Compose output and run repair."] });
    }
    return result;
  };
  return {
    install: (request) => installOrRepair("install", request),
    repair: (request) => installOrRepair("repair", request),
    start: () => completed(compose(["up", "-d"])),
    stop: () => completed(compose(["down"])),
    restart: () => completed(compose(["restart"])),
    status: () => completed(compose(["ps"])),
    health: async () => completed(await health()),
    logs: ({ follow = false } = {}) => completed(compose(["logs", "--tail=200", ...(follow ? ["-f"] : [])])),
    exec: (args, options = {}) => {
      const { service = "laravel-fpm", ...composeOptions } = options;
      return completed(
        compose(["exec", "-T", service, ...args], Object.keys(composeOptions).length ? composeOptions : undefined),
        { includeOutput: true }
      );
    },
    // V1-208I: Docker's update is the only real implementation so far; a
    // future Native adapter supplies its own updateOperation to the same
    // constructor param and gets the identical request-in/result-out shape.
    update: (request) => (updateOperation ? updateOperation(request) : unsupported("update")),
    // V1-208J/V1-208K: like update, rollback and uninstall are injected
    // operations — a future Native adapter supplies its own to the same
    // constructor params and gets the identical request-in/result-out shape.
    rollback: (request) => (rollbackOperation ? rollbackOperation(request) : unsupported("rollback")),
    uninstall: (request) => (uninstallOperation ? uninstallOperation(request) : unsupported("uninstall")),
  };
}
