// V1-208K: uninstall keeps data by default and removes only the services and
// resources the installation manifest records ownership of. Data deletion is
// a separate explicit option gated by a typed confirmation phrase AND a
// recent successful backup. reconnect-data re-attaches an existing data
// directory to a fresh install. Same DI style as createReleaseUpdate/
// createReleaseRollback so everything is unit-testable without Docker.
export const DELETE_DATA_CONFIRMATION_PHRASE = "DELETE ARCHIVE DATA";
const RECENT_BACKUP_MAX_AGE_MS = 24 * 3_600_000;
const URL_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;
const CREDENTIAL_PAIR = /[^\s:/\\]+:[^\s@]+@/;

function fail(code, message, nextActions, details = {}) {
  return { ok: false, code, message, details, nextActions };
}

export function createUninstall({
  manifestPath,
  manifestStore,
  removeServices,
  listBackups,
  deleteDataPaths,
  removeManifest,
  recentBackupMaxAgeMs = RECENT_BACKUP_MAX_AGE_MS,
  now = Date.now,
  // V1-210B: the Windows Native wiring passes ["native"] with its own
  // removeServices; the Docker default keeps the original behaviour.
  supportedModes = ["docker"],
}) {
  return async function uninstall({ confirmed = false, deleteDataRequested = false, deleteConfirmationPhrase = "" } = {}) {
    // 1. Preflight — nothing below this block has a side effect.
    let manifest;
    try { manifest = manifestStore.readInstallationManifest(manifestPath); }
    catch {
      // Never include the filesystem error: it may carry a path or URL.
      return fail("UNINSTALL_MANIFEST_IO_FAILED", "The installation manifest could not be read safely.", ["Correct the local manifest storage issue, then retry the uninstall."]);
    }
    if (!manifest) return fail("RELEASE_NOT_INSTALLED", "No release installation manifest was found; nothing to uninstall.", ["Nothing was changed."]);
    if (!supportedModes.includes(manifest.mode)) return fail("MODE_UNSUPPORTED", `Uninstall is not wired for the "${manifest.mode}" installation mode in this build.`, ["Use the setup build that matches the installed runtime mode."], { mode: manifest.mode });
    if (!confirmed) {
      return fail(
        "UNINSTALL_CONFIRMATION_REQUIRED",
        `Uninstall removes the ${manifest.services.length} services this installation owns; your data is kept by default.`,
        ["Review the services below, then re-run setup uninstall --yes.", ...(deleteDataRequested ? ["Data deletion additionally requires --confirm-delete with the exact confirmation phrase."] : [])],
        { services: manifest.services, keptDataPaths: manifest.dataPaths },
      );
    }
    if (deleteDataRequested) {
      if (deleteConfirmationPhrase !== DELETE_DATA_CONFIRMATION_PHRASE) {
        return fail(
          "UNINSTALL_DELETE_PHRASE_REQUIRED",
          "Deleting data permanently requires typing the exact confirmation phrase.",
          [`Re-run setup uninstall --yes --delete-data --confirm-delete="${DELETE_DATA_CONFIRMATION_PHRASE}".`],
        );
      }
      // A recent successful backup is required BEFORE anything stops, because
      // the backup commands need the running stack to verify against.
      let backups;
      try { backups = await listBackups(manifest); } catch { backups = null; }
      const isRecent = (backup) => backup?.checksum && !Number.isNaN(Date.parse(backup.createdAt)) && now() - Date.parse(backup.createdAt) <= recentBackupMaxAgeMs;
      if (!Array.isArray(backups) || !backups.some(isRecent)) {
        return fail(
          "UNINSTALL_RECENT_BACKUP_REQUIRED",
          "Deleting data requires a recent successful backup (with checksum, taken within the last 24 hours).",
          ["Run setup backup, verify it with setup verify-backup, then retry the uninstall.", "Nothing was changed."],
        );
      }
    }

    // 2. Remove only the services/resources the manifest records ownership
    // of. deleteVolumes stays false on the keep-data default so named Docker
    // volumes (database) survive for reconnect-data.
    let removed;
    try { removed = await removeServices({ manifest, deleteVolumes: deleteDataRequested }); }
    catch { removed = { ok: false }; }
    if (!removed?.ok) {
      return fail("UNINSTALL_SERVICES_FAILED", "Docker Compose did not complete removing the installed services.", [
        "Your data and the installation manifest are unchanged.",
        "Review setup status and Docker output, then retry the uninstall.",
      ]);
    }

    // 3. Data deletion only on the explicit, doubly-confirmed path.
    if (deleteDataRequested) {
      try { await deleteDataPaths(manifest.dataPaths); }
      catch {
        return fail("UNINSTALL_DATA_DELETE_FAILED", "The recorded data directories could not be fully deleted.", [
          "The installation manifest was kept so the deletion can be retried.",
          "Check filesystem permissions on the recorded data paths, then retry.",
        ]);
      }
    }

    // 4. Remove the manifest last — it is the record that services existed.
    try { await removeManifest(); }
    catch {
      return fail("UNINSTALL_MANIFEST_IO_FAILED", "Services were removed but the installation manifest could not be deleted.", ["Delete the installation manifest file manually, or correct the filesystem issue and retry."]);
    }

    const details = { removedServices: manifest.services };
    if (deleteDataRequested) details.deletedDataPaths = manifest.dataPaths;
    else details.keptDataPaths = manifest.dataPaths;
    return {
      ok: true,
      code: "UNINSTALL_COMPLETE",
      message: deleteDataRequested
        ? `Uninstalled version ${manifest.version} and permanently deleted its data.`
        : `Uninstalled version ${manifest.version}; your data was kept.`,
      details,
      nextActions: deleteDataRequested
        ? []
        : ["After a fresh setup install, run setup reconnect-data --storage=<path> to re-attach the kept data."],
    };
  };
}

export function createReconnectData({ manifestPath, manifestStore, inspectDataPath }) {
  return async function reconnectData({ storagePath } = {}) {
    if (typeof storagePath !== "string" || !storagePath.trim()) {
      return fail("RECONNECT_DATA_PATH_REQUIRED", "reconnect-data requires the existing data directory.", ["Run setup reconnect-data --storage=<path-to-existing-data>."]);
    }
    const path = storagePath.trim();
    if (URL_PATTERN.test(path) || CREDENTIAL_PAIR.test(path)) {
      return fail("RECONNECT_DATA_PATH_INVALID", "The storage path must be a local directory without credentials.", ["Provide a plain local directory path and retry."]);
    }
    let inspection;
    try { inspection = await inspectDataPath(path); } catch { inspection = { exists: false }; }
    if (!inspection?.exists) {
      return fail("RECONNECT_DATA_NOT_FOUND", "The storage path does not exist or is not accessible.", ["Verify the directory exists and is readable, then retry."]);
    }
    let manifest;
    try { manifest = manifestStore.readInstallationManifest(manifestPath); }
    catch { return fail("RECONNECT_MANIFEST_IO_FAILED", "The installation manifest could not be read safely.", ["Correct the local manifest storage issue, then retry."]); }
    if (!manifest) return fail("RELEASE_NOT_INSTALLED", "No installation was found to attach the data to.", ["Run setup install --config=<file> first, then re-run reconnect-data."]);
    try {
      manifestStore.updateDataPaths({ path: manifestPath, dataPaths: { ...manifest.dataPaths, storage: path } });
    } catch {
      return fail("RECONNECT_MANIFEST_IO_FAILED", "The reconnected data path could not be recorded safely.", ["Correct the local manifest storage issue, then retry."]);
    }
    return {
      ok: true,
      code: "RECONNECT_COMPLETE",
      message: "The existing data directory was re-attached to this installation.",
      details: { dataPaths: { ...manifest.dataPaths, storage: path } },
      nextActions: ["Run setup restart so services pick up the reconnected data, then setup health to verify."],
    };
  };
}
