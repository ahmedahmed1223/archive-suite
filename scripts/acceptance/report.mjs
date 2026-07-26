import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

function outcome(result) { return result.status === "passed" ? "passed" : result.status === "blocked-capability" ? "blocked" : "failed"; }

function normalizeRun(run) {
  const results = Array.isArray(run?.results) ? run.results : [];
  const blockers = results.filter((item) => item.status !== "passed");
  return {
    runId: String(run?.runId ?? "unknown"), status: String(run?.status ?? "failed"), provider: run?.provider ?? {}, budget: run?.budget ?? {},
    results: results.map((item) => ({ scenarioId: item.scenarioId, status: item.status, attempts: item.attempts ?? 0, evidence: item.evidence?.refs ?? [], blockedCapabilities: item.blockedCapabilities ?? [] })),
    releaseBlocking: blockers.length > 0,
  };
}

export function buildAcceptanceReport(manifests) {
  const runs = (Array.isArray(manifests) ? manifests : []).map(normalizeRun);
  const current = runs.at(-1) ?? { results: [] };
  // A missing previously-green result is a regression; a new non-passing
  // scenario is also reported, because it blocks the declared RC/GA matrix.
  const regressions = current.results.filter((item) => item.status !== "passed");
  const blockers = current.results.filter((item) => item.status !== "passed");
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), runs, currentRun: current.runId, comparison: { regressions, blockers }, totals: { runs: runs.length, passed: current.results.filter((item) => outcome(item) === "passed").length, blocked: current.results.filter((item) => outcome(item) === "blocked").length, failed: current.results.filter((item) => outcome(item) === "failed").length } };
}

export function renderAcceptanceMarkdown(report) {
  const lines = ["# Acceptance evidence report", "", `Current run: \`${report.currentRun}\``, "", "| Scenario | Status | Attempts | Evidence |", "| --- | --- | ---: | --- |"];
  const current = report.runs.at(-1);
  for (const item of current?.results ?? []) lines.push(`| ${item.scenarioId} | ${item.status} | ${item.attempts} | ${(item.evidence ?? []).join(", ") || "—"} |`);
  lines.push("", "## Release blockers", "");
  if (!report.comparison.blockers.length) lines.push("None.");
  else for (const item of report.comparison.blockers) lines.push(`- ${item.scenarioId}: ${item.status}${item.blockedCapabilities?.length ? ` (${item.blockedCapabilities.join(", ")})` : ""}`);
  return `${lines.join("\n")}\n`;
}

export function readAcceptanceManifests(paths) {
  return paths.map((path) => JSON.parse(readFileSync(resolve(path), "utf8")));
}

/** Export a small, portable package for Product/Security/Ops/Support reviewers. */
export function exportAcceptanceReport({ manifests, outputDirectory }) {
  const report = buildAcceptanceReport(manifests);
  const directory = resolve(outputDirectory);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(join(directory, "acceptance-report.json"), JSON.stringify(report, null, 2), { mode: 0o600 });
  writeFileSync(join(directory, "acceptance-report.md"), renderAcceptanceMarkdown(report), { mode: 0o600 });
  writeFileSync(join(directory, "manifest-index.json"), JSON.stringify((manifests ?? []).map((manifest) => ({ runId: manifest.runId, source: basename(manifest.source ?? "manifest.json") })), null, 2), { mode: 0o600 });
  return { directory, report };
}
