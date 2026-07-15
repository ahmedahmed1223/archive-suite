// V1-212B: unified acceptance harness. The SAME scenario IDs run on every
// release platform (Windows/Linux x Docker/Native); each run's outcome is
// persisted as an artifact through the injected saver — a result that could
// not be saved does not count, because unsaved evidence is no evidence.
// Scenario execution itself is injected: live runners plug in per platform,
// and unit tests plug in fakes.
export const ACCEPTANCE_SCENARIOS = Object.freeze(["install", "reconfigure", "operate", "data", "release", "uninstall", "security"]);

// Platform ids mirror infra/platform/compatibility.v1.json.
export const ACCEPTANCE_PLATFORMS = Object.freeze(["windows-10-11-docker", "windows-native", "linux-docker", "linux-native"]);

export function createAcceptanceHarness({ runScenario, saveArtifact } = {}) {
  if (typeof runScenario !== "function" || typeof saveArtifact !== "function") throw new Error("Acceptance harness requires runScenario and saveArtifact.");
  return async function runMatrix({ platforms = ACCEPTANCE_PLATFORMS, release } = {}) {
    const unknown = platforms.filter((platform) => !ACCEPTANCE_PLATFORMS.includes(platform));
    if (unknown.length) {
      return { ok: false, code: "ACCEPTANCE_PLATFORM_UNKNOWN", message: "The acceptance matrix only covers the contract's release platforms.", details: { unknown }, nextActions: ["Use platform ids from infra/platform/compatibility.v1.json."] };
    }
    const results = [];
    for (const platform of platforms) {
      for (const scenario of ACCEPTANCE_SCENARIOS) {
        let outcome;
        try { outcome = await runScenario({ platform, scenario, release }); }
        catch { outcome = { ok: false, code: "SCENARIO_CRASHED" }; }
        const record = {
          platform,
          scenario,
          ok: outcome?.ok === true,
          code: outcome?.code ?? (outcome?.ok === true ? "SCENARIO_PASSED" : "SCENARIO_FAILED"),
          cleanHost: outcome?.cleanHost === true,
          artifactVersion: outcome?.artifactVersion ?? null,
          evidence: outcome?.evidence ?? null,
        };
        try { await saveArtifact(record); }
        catch {
          return { ok: false, code: "ACCEPTANCE_ARTIFACT_SAVE_FAILED", message: "An acceptance result could not be persisted; the matrix run is invalid without its artifacts.", details: { platform, scenario }, nextActions: ["Fix the artifact storage and rerun the acceptance matrix."] };
        }
        results.push(record);
      }
    }
    const failed = results.filter((record) => !record.ok);
    return {
      ok: failed.length === 0,
      code: failed.length === 0 ? "ACCEPTANCE_MATRIX_PASSED" : "ACCEPTANCE_MATRIX_FAILED",
      message: failed.length === 0 ? "Every scenario passed on every requested platform." : `${failed.length} scenario run(s) failed.`,
      details: { platforms, scenarios: [...ACCEPTANCE_SCENARIOS], failed: failed.map(({ platform, scenario, code }) => ({ platform, scenario, code })) },
      results,
      nextActions: failed.length === 0 ? [] : ["Review the failed scenario artifacts, fix, and rerun the matrix."],
    };
  };
}
