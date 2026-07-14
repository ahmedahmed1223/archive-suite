// V1-208I: atomic update from artifacts (Docker only — native update is a
// separate, unimplemented ticket). Sequence: preflight -> full backup ->
// pull the new version's images alongside the still-running old ones ->
// archive:migrate-safe against the old container -> switch -> health +
// role-based smoke. Every dependency is injected (same DI style as
// createDockerRuntimeAdapter/createControlOperations) so the sequence is
// unit-testable without Docker or a real release descriptor.
//
// Resumability model: unlike install/repair (which resume from a specific
// INSTALLATION_STEPS index), a failed update is recovered by simply
// re-running `setup update`. Every step here is independently safe to
// repeat (a fresh backup, a re-pull of already-cached images, migrate-safe's
// own idempotent pending-check, an idempotent `compose up -d`, a re-probed
// health check) — so no step-skip logic is built. Each step is still
// recorded via updateLastSuccessfulStep/markInstallationFailed so a stuck
// update is diagnosable (which step it reached, whether images were
// switched) even though recovery is "run it again," not "resume mid-way."
export const UPDATE_STEPS = ["preflight-verified", "backup-created", "new-version-pulled", "migrated", "switched", "health-verified", "role-smoke-verified"];

function fail(code, message, nextActions, details = {}) {
  return { ok: false, code, message, details, nextActions };
}

function success(code, message, details, nextActions = []) {
  return { ok: true, code, message, details, nextActions };
}

function manifestIoFailure(details = {}) {
  // Do not include a filesystem error string here: it may contain a local
  // path or a credential-bearing URL. The CLI's JSON contract must never
  // turn a manifest exception into an unstructured rejection or leak it.
  return fail(
    "UPDATE_MANIFEST_IO_FAILED",
    "Update state could not be recorded safely.",
    ["Correct the local manifest storage issue, confirm the running version with setup status, then retry the update."],
    details,
  );
}

export function createReleaseUpdate({
  manifestPath,
  manifestStore,
  resolveRelease,
  loadOfflineReleaseImages,
  configurationFromManifest,
  buildAdapter,
  runBackup,
  runMigration,
  checkHealth,
  runRoleSmoke = async () => ({ ok: true, checkedRoles: [] }),
  restorePreviousRelease = async ({ oldAdapter, newAdapter }) => {
    // Stop any partially-created target containers before recreating the old
    // release. This keeps a failed switch from leaving mixed-version workers.
    const stopped = newAdapter.stop ? newAdapter.stop() : { ok: true };
    if (!stopped?.ok) return { ok: false, stopped: false };
    const restored = oldAdapter.start();
    return { ok: restored?.ok === true, stopped: true };
  },
}) {
  return async function update() {
    // No output.titleLine/log here: like setupInstallOrRepair, the only
    // thing that prints is the final renderSetupResult() call at the CLI
    // layer — printing mid-sequence would leak extra lines ahead of the
    // single JSON envelope --json mode promises.

    // 1. Preflight. Nothing below this block has a side effect, so a bad
    // descriptor/signature/digest (resolveRelease throws ReleaseDescriptorError)
    // or an already-current install fails closed with zero writes.
    let manifest;
    try { manifest = manifestStore.readInstallationManifest(manifestPath); }
    catch { return manifestIoFailure(); }
    if (!manifest) return fail("RELEASE_NOT_INSTALLED", "No release installation manifest was found; nothing to update.", ["Run setup install --config=<file> first."]);
    if (manifest.mode !== "docker") return fail("MODE_UNSUPPORTED", "Update is currently available for Docker mode only.", ["Native update is not implemented yet (separate ticket)."], { mode: manifest.mode });
    if (!manifest.releaseEnvironment) return fail(
      "UPDATE_ROLLBACK_REFERENCE_MISSING",
      "This installation does not contain the pinned previous-release reference required for an automatic safe restore.",
      ["Run setup repair from the currently installed signed release to record its pinned images before updating."],
    );

    const configuration = configurationFromManifest(manifest);
    let release;
    try { release = resolveRelease({ configuration }); }
    catch (error) {
      return fail(error?.code || "RELEASE_DESCRIPTOR_INVALID", error?.message || "Release descriptor validation failed.", error?.nextActions || ["Correct the release configuration and try again."]);
    }

    const previousVersion = manifest.version;
    if (release.descriptor.version === previousVersion) {
      return success("ALREADY_UP_TO_DATE", `Already on version ${previousVersion}; nothing to update.`, { version: previousVersion });
    }

    const input = {
      version: release.descriptor.version,
      source: configuration.source,
      mode: configuration.mode,
      platform: configuration.platform,
      runtimeProfiles: configuration.runtimeProfiles,
      capabilities: configuration.capabilities,
      artifacts: release.artifacts,
      releaseEnvironment: release.environment,
      services: release.images.map((image) => image.service),
      dataPaths: manifest.dataPaths,
    };

    // Record the update as started, atomically, before any side effect —
    // same discipline beginInstallationOperation uses for install/repair.
    try {
      manifestStore.beginOperation({ path: manifestPath, type: "update", target: input });
      manifestStore.updateLastSuccessfulStep({ path: manifestPath, step: "preflight-verified" });
    } catch { return manifestIoFailure(); }

    const failStep = (step, code, message, nextActions, extra = {}) => {
      try { manifestStore.markInstallationFailed({ path: manifestPath, failedStep: step, nextActions }); }
      catch { return manifestIoFailure(); }
      return fail(code, message, nextActions, { previousVersion, ...extra });
    };
    const recordStep = (step) => {
      try { manifestStore.updateLastSuccessfulStep({ path: manifestPath, step }); return null; }
      catch { return manifestIoFailure(); }
    };

    // The old adapter targets whatever is currently running by service name
    // (docker compose exec/logs resolve the running container, not an image
    // env var), so it deliberately carries no release image environment —
    // it must keep working against the OLD containers even though this
    // checkout's release descriptor now only describes the NEW version.
    const oldAdapter = buildAdapter(manifest.releaseEnvironment);

    // 2. Full backup of the currently running (old) version, before anything changes.
    const backup = runBackup(oldAdapter);
    if (!backup.ok) {
      return failStep("backup-created", "BACKUP_FAILED", backup.message || "Backup failed before the update could proceed.", [
        "The running stack is unchanged — still on the previous version.",
        "Resolve the backup failure, then re-run setup update.",
      ], { runningVersion: previousVersion, imagesSwitched: false, backup: backup.details });
    }
    { const failed = recordStep("backup-created"); if (failed) return failed; }

    // 3. Install the new version's images alongside the current ones. Pulling
    // (online) or loading+tagging+inspecting a verified bundle (offline)
    // never touches the running containers, so a failure here still leaves
    // the old stack fully intact.
    const newAdapter = buildAdapter(release.environment);
    try {
      if (configuration.source === "offline") {
        loadOfflineReleaseImages(release);
      } else {
        const pulled = newAdapter.pull();
        if (!pulled.ok) throw Object.assign(new Error("Docker could not pull or verify the new release images."), { code: "IMAGE_PULL_FAILED" });
      }
    } catch (error) {
      return failStep("new-version-pulled", error?.code || "IMAGE_PULL_FAILED", error?.message || "Could not pull or verify the new release images.", [
        "The running stack is unchanged — still on the previous version.",
        "Correct the image or signature issue, then re-run setup update.",
      ], { runningVersion: previousVersion, imagesSwitched: false });
    }
    { const failed = recordStep("new-version-pulled"); if (failed) return failed; }

    // 4. archive:migrate-safe against the still-running OLD container. Its
    // own preflight/backup-skip-if-empty/maintenance-window/lock/rollback
    // safety net lives in the artisan command itself — this only invokes it
    // and surfaces its verdict, it does not duplicate that logic.
    const migration = runMigration(oldAdapter);
    if (!migration.ok) {
      return failStep("migrated", "MIGRATION_FAILED", "Migration failed — application was left in maintenance mode.", [
        "The running stack is unchanged — still on the previous version; new images were pulled but not switched in.",
        "Review the migrate-safe output below for rollback steps, then re-run setup update.",
        ...(migration.output ? [migration.output] : []),
      ], { runningVersion: previousVersion, imagesSwitched: false });
    }
    { const failed = recordStep("migrated"); if (failed) return failed; }

    // 5. Switch — bring the new images live.
    const restore = async (step, code, message, cause) => {
      let restoration;
      try { restoration = await restorePreviousRelease({ oldAdapter, newAdapter, manifest, target: input, cause }); }
      catch { restoration = { ok: false }; }
      const restoredPreviousRelease = restoration?.ok === true;
      return failStep(step, code, message, [
        restoredPreviousRelease
          ? "The previous release and its configuration were restored automatically."
          : "Automatic restoration of the previous release did not complete; do not retry until setup status confirms the running version.",
        "Review setup health and setup logs before retrying.",
      ], { runningVersion: restoredPreviousRelease ? previousVersion : "unknown", imagesSwitched: !restoredPreviousRelease, restoredPreviousRelease });
    };
    const restoreAfterManifestIo = async (cause) => {
      let restoration;
      try { restoration = await restorePreviousRelease({ oldAdapter, newAdapter, manifest, target: input, cause }); }
      catch { restoration = { ok: false }; }
      return manifestIoFailure({
        previousVersion,
        runningVersion: restoration?.ok ? previousVersion : "unknown",
        restoredPreviousRelease: restoration?.ok === true,
      });
    };

    const switched = newAdapter.start();
    if (!switched.ok) {
      return restore("switched", "SWITCH_FAILED", "Docker Compose did not complete switching to the new release.", "switch");
    }
    { const failed = recordStep("switched"); if (failed) return restoreAfterManifestIo("manifest-switched"); }

    // 6. Health + role-based smoke. Scope limit (documented, not silent): the
    // full multi-role smoke harness is V1-303/V1-307 territory. This reuses
    // the existing /api/v1/health deep check (db/redis/storage), which
    // already gates HTTP 200 vs 503 on the same checks a role-based smoke
    // would start from.
    const health = await checkHealth();
    if (!health.ok) {
      return restore("health-verified", "HEALTH_CHECK_FAILED", "The new version did not pass its health check.", "health");
    }
    { const failed = recordStep("health-verified"); if (failed) return restoreAfterManifestIo("manifest-health"); }

    // Role smoke is deliberately injected: deployments may have different
    // role matrices, while this lifecycle must always gate the switch on the
    // same explicit, testable contract. It only runs after deep health.
    const smoke = await runRoleSmoke({ adapter: newAdapter, manifest, release });
    if (!smoke.ok) return restore("role-smoke-verified", "ROLE_SMOKE_FAILED", smoke.message || "The new version did not pass role-based smoke checks.", "role-smoke");
    { const failed = recordStep("role-smoke-verified"); if (failed) return restoreAfterManifestIo("manifest-role-smoke"); }

    // 7. Success — record the new version, keep previousVersion for a future
    // rollback (V1-208J). Nothing here prunes or removes the previous
    // version's images; Docker's own layer cache keeps them untouched.
    try { manifestStore.completeUpdateOperation({ path: manifestPath, input, previousVersion, step: "role-smoke-verified" }); }
    catch { return restoreAfterManifestIo("manifest-complete"); }
    return success(
      "UPDATE_COMPLETE",
      `Updated from ${previousVersion} to ${release.descriptor.version}.`,
      { version: release.descriptor.version, previousVersion },
      ["Run setup health to reconfirm.", "The previous version's images were kept (nothing was pruned)."],
    );
  };
}
