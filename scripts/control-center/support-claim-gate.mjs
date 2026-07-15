// V1-212C: support-claim gate. A platform may move from planned/conditional
// to supported ONLY when its complete live acceptance matrix — every unified
// scenario, on a clean host, installed from the final release artifact —
// has passed. This module judges evidence; it never edits the platform
// contract itself (compatibility.v1.json intentionally cannot even express
// "supported" until this gate's verdict is acted on in a release change).
import { ACCEPTANCE_PLATFORMS, ACCEPTANCE_SCENARIOS } from "./acceptance-harness.mjs";

const FINAL_SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+$/; // no prerelease suffix: final artifacts only

function fail(code, message, nextActions, details = {}) {
  return { ok: false, code, message, details, nextActions };
}

export function evaluateSupportClaim({ platform, currentStatus, release, results } = {}) {
  if (!ACCEPTANCE_PLATFORMS.includes(platform)) {
    return fail("SUPPORT_PLATFORM_UNKNOWN", "Support can only be claimed for a contract release platform.", ["Use a platform id from infra/platform/compatibility.v1.json."]);
  }
  if (currentStatus !== "planned" && currentStatus !== "conditional") {
    return fail("SUPPORT_STATUS_INVALID", "Only a planned or conditional platform can transition to supported.", ["Check the platform's current contract status."], { currentStatus });
  }
  if (!FINAL_SEMVER.test(String(release?.version || "")) || release?.signed !== true) {
    return fail("SUPPORT_RELEASE_NOT_FINAL", "Support claims require a signed, final (non-prerelease) release artifact.", ["Run the matrix against the signed final release artifact."], { version: release?.version ?? null });
  }
  const mine = (Array.isArray(results) ? results : []).filter((record) => record?.platform === platform);
  const missing = ACCEPTANCE_SCENARIOS.filter((scenario) => !mine.some((record) => record.scenario === scenario));
  if (missing.length) {
    return fail("SUPPORT_MATRIX_INCOMPLETE", "The live acceptance matrix is missing scenarios for this platform.", ["Run the full unified acceptance matrix and retry."], { missing });
  }
  const failed = mine.filter((record) => record.ok !== true).map((record) => record.scenario);
  if (failed.length) {
    return fail("SUPPORT_MATRIX_FAILED", "The live acceptance matrix has failing scenarios for this platform.", ["Fix the failures and rerun the matrix from the final artifact."], { failed });
  }
  const tainted = mine.filter((record) => record.cleanHost !== true || record.artifactVersion !== release.version).map((record) => record.scenario);
  if (tainted.length) {
    return fail("SUPPORT_EVIDENCE_MISMATCH", "Every scenario must run on a clean host from the final release artifact.", ["Rerun the tainted scenarios on a clean host using the final artifact."], { tainted });
  }
  return {
    ok: true,
    code: "SUPPORT_CLAIM_APPROVED",
    message: `Platform "${platform}" passed its complete live matrix from the final artifact and may be claimed as supported.`,
    details: { platform, version: release.version, scenarios: [...ACCEPTANCE_SCENARIOS] },
    nextActions: ["Record the transition in the platform contract through the release change process."],
  };
}
