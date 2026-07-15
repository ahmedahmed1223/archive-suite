// V1-208L: host preconditions checked before an install writes anything —
// free disk space and required dependencies. Probes are injected so callers
// (and tests) decide how the host is measured; this module only decides the
// verdict and the stable code/nextActions contract that goes with it.

function result(ok, code, message, details = {}, nextActions = []) {
  return { ok, code, message, details, nextActions };
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
    async run({ requiredBytes = 0 } = {}) {
      // Both probes always run, so one report lists every blocker instead of
      // making the operator fix them one retry at a time.
      const disk = readDisk(diskProbe);
      const missing = missingDependencies(dependencyProbe, requiredDependencies);
      const details = missing.length ? { missing } : {};

      if (disk === null) {
        return result(
          false,
          "DISK_PROBE_FAILED",
          "Free disk space could not be measured, so the install stopped before writing.",
          details,
          ["Verify the data path exists and is readable by the installer, then retry."],
        );
      }
      if (disk.free <= 0) {
        return result(
          false,
          "DISK_FULL",
          "The target disk has no free space.",
          { ...details, freeBytes: disk.free, totalBytes: disk.total, requiredBytes },
          ["Free space on the target disk, then run install again."],
        );
      }
      if (disk.free < requiredBytes) {
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
      return result(true, "PREFLIGHT_PASSED", "Host preconditions are satisfied.", {
        freeBytes: disk.free,
        totalBytes: disk.total,
        requiredBytes,
      });
    },
  };
}
