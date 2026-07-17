import { existsSync, statfsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";

// V1-208L: host preconditions checked before an install writes anything —
// free disk space and required dependencies. Probes are injected so callers
// (and tests) decide how the host is measured; this module only decides the
// verdict and the stable code/nextActions contract that goes with it.

function result(ok, code, message, details = {}, nextActions = []) {
  return { ok, code, message, details, nextActions };
}

/**
 * Real host probes for the live install path. `statfs` and `run` are injected
 * so tests never touch the real disk or spawn a real process; production
 * callers get the node:fs / node:child_process defaults.
 */
export function createHostProbes({ dataPath, statfs = statfsSync, exists = existsSync, parentPath = dirname, run = defaultRun } = {}) {
  if (!dataPath) throw new Error("host probes require a dataPath to measure.");
  return {
    diskProbe() {
      // bavail, not bfree: bfree counts root-reserved blocks the installer
      // cannot write to, which would overstate free space on Linux.
      // A first-run storage directory is intentionally absent until Docker
      // creates it. Measure its nearest existing ancestor instead; it is on
      // the same filesystem but keeps the preflight read-only.
      let probePath = dataPath;
      while (!exists(probePath)) {
        const parent = parentPath(probePath);
        if (parent === probePath) throw new Error("no existing ancestor for data path");
        probePath = parent;
      }
      const { bsize, bavail, blocks } = statfs(probePath);
      return { free: bsize * bavail, total: bsize * blocks };
    },
    dependencyProbe(name) {
      try {
        return { installed: run(name, ["--version"]).status === 0 };
      } catch {
        // A spawn failure (ENOENT, blocked by policy) means we could not prove
        // it is present — never fall through to "installed".
        return { installed: false };
      }
    },
  };
}

function defaultRun(command, args) {
  // shell:false — the command name is ours, never operator input, and this
  // keeps a hostile PATH entry from being interpreted by a shell.
  return spawnSync(command, args, { stdio: "ignore", shell: false });
}

function readDisk(diskProbe) {
  try {
    const { free, total } = diskProbe();
    if (!Number.isFinite(free) || free < 0) throw new Error("probe returned no usable free-space value");
    return { free, total };
  } catch {
    // Swallow the probe error deliberately: its message carries real host
    // paths. The operator gets a stable code, the raw cause stays out.
    return null;
  }
}

function missingDependencies(dependencyProbe, required) {
  return required.filter((name) => {
    try {
      return dependencyProbe(name)?.installed !== true;
    } catch {
      return true; // an unreadable dependency probe counts as missing, never as present
    }
  });
}

export function createInstallPreflight({ diskProbe, dependencyProbe, requiredDependencies = [] } = {}) {
  if (typeof diskProbe !== "function" || typeof dependencyProbe !== "function") {
    throw new Error("install preflight requires diskProbe and dependencyProbe functions.");
  }
  return {
    // Sync on purpose: every probe is a sync syscall and the whole install
    // path (compose(), the manifest store) is sync, so the adapter can gate on
    // this without turning install() into a promise its callers do not await.
    run({ requiredBytes = 0, skipDiskCheck = false } = {}) {
      // Both probes always run, so one report lists every blocker instead of
      // making the operator fix them one retry at a time.
      const disk = skipDiskCheck ? null : readDisk(diskProbe);
      const missing = missingDependencies(dependencyProbe, requiredDependencies);
      const details = {
        ...(skipDiskCheck ? { diskCheck: "skipped-by-operator" } : {}),
        ...(missing.length ? { missing } : {}),
      };

      if (!skipDiskCheck && disk === null) {
        return result(
          false,
          "DISK_PROBE_FAILED",
          "Free disk space could not be measured, so the install stopped before writing.",
          details,
          ["Verify the data path exists and is readable by the installer, then retry."],
        );
      }
      if (!skipDiskCheck && disk.free <= 0) {
        return result(
          false,
          "DISK_FULL",
          "The target disk has no free space.",
          { ...details, freeBytes: disk.free, totalBytes: disk.total, requiredBytes },
          ["Free space on the target disk, then run install again."],
        );
      }
      if (!skipDiskCheck && disk.free < requiredBytes) {
        return result(
          false,
          "INSUFFICIENT_DISK_SPACE",
          "The target disk does not have enough free space for this install.",
          { ...details, freeBytes: disk.free, totalBytes: disk.total, requiredBytes },
          [
            `Free at least ${requiredBytes - disk.free} more bytes on the target disk, then run install again.`,
            "Or choose a data path on a larger disk.",
          ],
        );
      }
      if (missing.length) {
        return result(
          false,
          "DEPENDENCY_MISSING",
          `A required dependency is not installed: ${missing.join(", ")}.`,
          details,
          [`Install ${missing.join(" and ")} on this host, then run install again.`],
        );
      }
      return result(
        true,
        "PREFLIGHT_PASSED",
        skipDiskCheck ? "Host preconditions are satisfied; disk capacity check was skipped by explicit operator request." : "Host preconditions are satisfied.",
        skipDiskCheck ? details : { freeBytes: disk.free, totalBytes: disk.total, requiredBytes, ...details },
      );
    },
  };
}
