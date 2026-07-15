// V1-208J: real rollback to the previous pinned release recorded by a
// successful V1-208I update (manifest.previousRelease). Same DI style as
// createReleaseUpdate so the sequence is unit-testable without Docker.
//
// Sequence: preflight (reference + compatibility + migration impact +
// explicit confirmation for irreversible migrations) -> switch back to the
// previous pinned images -> restore the pre-update backup only when
// migrations are irreversible and the operator confirmed the data-loss
// impact -> health. A failed switch attempts to restore the current release;
// a failed backup restore or health check never auto-switches forward again,
// because the data state is uncertain at that point.
export const ROLLBACK_STEPS = ["preflight-verified", "switched", "backup-restored", "health-verified"];

function fail(code, message, nextActions, details = {}) {
  return { ok: false, code, message, details, nextActions };
}

function manifestIoFailure(details = {}) {
  // Never leak the filesystem error: it may contain a local path or a
  // credential-bearing URL (same policy as UPDATE_MANIFEST_IO_FAILED).
  return fail(
    "ROLLBACK_MANIFEST_IO_FAILED",
    "Rollback state could not be recorded safely.",
    ["Correct the local manifest storage issue, confirm the running version with setup status, then retry the rollback."],
    details,
  );
}

export function createReleaseRollback({
  manifestPath,
  manifestStore,
  buildAdapter,
  assessRollbackImpact,
  runRestoreBackup,
  checkHealth,
  restoreCurrentRelease = async ({ currentAdapter, previousAdapter }) => {
    const stopped = previousAdapter.stop ? previousAdapter.stop() : { ok: true };
    if (!stopped?.ok) return { ok: false };
    const restored = currentAdapter.start();
    return { ok: restored?.ok === true };
  },
}) {
  return async function rollback({ confirmed = false } = {}) {
    // 1. Preflight — nothing below this block has a side effect.
    let manifest;
    try { manifest = manifestStore.readInstallationManifest(manifestPath); }
    catch { return manifestIoFailure(); }
    if (!manifest) return fail("RELEASE_NOT_INSTALLED", "No release installation manifest was found; nothing to roll back.", ["Run setup install --config=<file> first."]);
    if (manifest.mode !== "docker") return fail("MODE_UNSUPPORTED", "Rollback is currently available for Docker mode only.", ["Native rollback is not implemented yet (separate ticket)."], { mode: manifest.mode });
    const previous = manifest.previousRelease;
    if (!previous || !previous.releaseEnvironment) {
      return fail(
        "ROLLBACK_REFERENCE_MISSING",
        "This installation does not record a previous pinned release to roll back to.",
        ["Rollback is only available after a completed setup update recorded the replaced release.", "Restore a backup instead: setup restore."],
      );
    }
    if (previous.mode !== manifest.mode || previous.platform !== manifest.platform) {
      return fail(
        "ROLLBACK_INCOMPATIBLE",
        "The previous release is not compatible with this installation; the downgrade was refused.",
        ["The previous release targets a different mode or platform.", "Restore a matching backup or reinstall the desired release explicitly."],
        { from: manifest.version, to: previous.version },
      );
    }

    let impact;
    try { impact = await assessRollbackImpact({ manifest, previousRelease: previous }); }
    catch { impact = { ok: false }; }
    if (!impact?.ok) {
      return fail(
        "ROLLBACK_IMPACT_UNKNOWN",
        "The migration impact of rolling back could not be determined; a silent rollback was refused.",
        ["Verify the stack is reachable with setup status and setup health, then retry the rollback."],
      );
    }
    if (impact.compatible === false) {
      return fail(
        "ROLLBACK_INCOMPATIBLE",
        "Database changes since the previous release make this downgrade incompatible; it was refused.",
        ["Restore a matching backup or reinstall the desired release explicitly."],
        { from: manifest.version, to: previous.version },
      );
    }
    const irreversible = impact.reversible === false;
    const dataLossImpact = Array.isArray(impact.dataLossImpact) ? impact.dataLossImpact : [];
    if (irreversible && !confirmed) {
      return fail(
        "ROLLBACK_CONFIRMATION_REQUIRED",
        `Rolling back from ${manifest.version} to ${previous.version} restores the pre-update backup and loses data written since the update.`,
        [...dataLossImpact, `Review the impact, then re-run setup rollback --yes to confirm restoring version ${previous.version}.`],
        { from: manifest.version, to: previous.version, dataLossImpact },
      );
    }

    // 2. Record the rollback as started before any side effect.
    try {
      manifestStore.beginOperation({ path: manifestPath, type: "rollback", target: previous });
      manifestStore.updateLastSuccessfulStep({ path: manifestPath, step: "preflight-verified" });
    } catch { return manifestIoFailure(); }

    const failStep = (step, code, message, nextActions, extra = {}) => {
      try { manifestStore.markInstallationFailed({ path: manifestPath, failedStep: step, nextActions }); }
      catch { return manifestIoFailure(); }
      return fail(code, message, nextActions, { from: manifest.version, to: previous.version, ...extra });
    };
    const recordStep = (step) => {
      try { manifestStore.updateLastSuccessfulStep({ path: manifestPath, step }); return null; }
      catch { return manifestIoFailure(); }
    };

    const currentAdapter = buildAdapter(manifest.releaseEnvironment);
    const previousAdapter = buildAdapter(previous.releaseEnvironment);

    // 3. Switch back to the previous pinned images. The previous images were
    // never pruned by update (V1-208I), so no pull is required.
    const stopped = currentAdapter.stop();
    const switched = stopped.ok ? previousAdapter.start() : stopped;
    if (!switched.ok) {
      let restoration;
      try { restoration = await restoreCurrentRelease({ currentAdapter, previousAdapter, manifest, cause: "switch" }); }
      catch { restoration = { ok: false }; }
      const restoredCurrentRelease = restoration?.ok === true;
      return failStep("switched", "ROLLBACK_SWITCH_FAILED", "Docker Compose did not complete switching back to the previous release.", [
        restoredCurrentRelease
          ? "The current release was restarted automatically."
          : "Automatic restart of the current release did not complete; confirm the running version with setup status before retrying.",
        "Review setup health and setup logs before retrying.",
      ], { restoredCurrentRelease });
    }
    { const failed = recordStep("switched"); if (failed) return failed; }

    // 4. Restore the pre-update backup only for irreversible migrations the
    // operator explicitly confirmed. After this point the data state matches
    // the previous release; never auto-switch forward again on failure.
    if (irreversible) {
      let restored;
      try { restored = await runRestoreBackup(previousAdapter); }
      catch { restored = { ok: false }; }
      if (!restored?.ok) {
        return failStep("backup-restored", "ROLLBACK_RESTORE_FAILED", restored?.message || "The pre-update backup could not be restored.", [
          "The previous release's services are running but the database state is unverified.",
          "Verify the backup with setup verify-backup, restore it manually with setup restore, then run setup health.",
        ]);
      }
      { const failed = recordStep("backup-restored"); if (failed) return failed; }
    }

    // 5. Health gate against the restored release.
    const health = await checkHealth();
    if (!health.ok) {
      return failStep("health-verified", "ROLLBACK_HEALTH_CHECK_FAILED", "The restored previous release did not pass its health check.", [
        "The previous release's services were started; review setup logs to diagnose.",
        "Do not switch forward again until the data state has been verified.",
      ]);
    }
    { const failed = recordStep("health-verified"); if (failed) return failed; }

    // 6. Success — swap the previous release back in as the active release.
    try { manifestStore.completeRollbackOperation({ path: manifestPath, step: "health-verified" }); }
    catch { return manifestIoFailure(); }
    return {
      ok: true,
      code: "ROLLBACK_COMPLETE",
      message: `Rolled back from ${manifest.version} to ${previous.version}.`,
      details: { version: previous.version, rolledBackFrom: manifest.version },
      nextActions: ["Run setup health to reconfirm.", "The newer version's images were kept (nothing was pruned)."],
    };
  };
}
