import { readFileSync } from "node:fs";

const [, , pnpmPath, composerPath, policyPath = "config/release-license-policy.json"] = process.argv;
if (!pnpmPath || !composerPath) throw new Error("usage: verify-release-licenses.mjs <pnpm.json> <composer.json> [policy.json]");

const load = (path) => JSON.parse(readFileSync(path, "utf8"));
const policy = load(policyPath);
const allowed = new Set(policy.allowed);
const forbidden = new Set(policy.forbidden);
const exceptions = new Set(policy.exceptions.map(({ package: name, license }) => `${name}:${license}`));
const failures = [];

function check(name, expression) {
  const alternatives = String(expression ?? "UNKNOWN").replaceAll(/[()]/g, "").split(/\s+OR\s+/i);
  const acceptable = alternatives.some((alternative) =>
    alternative.split(/\s+AND\s+/i).map((id) => id.trim()).every((license) => allowed.has(license) || exceptions.has(`${name}:${license}`)),
  );
  if (acceptable) return;
  const ids = alternatives.flatMap((alternative) => alternative.split(/\s+AND\s+/i).map((id) => id.trim()));
  const blocked = ids.filter((license) => forbidden.has(license));
  failures.push(blocked.length ? `${name}: forbidden license ${blocked.join(", ")}` : `${name}: unknown/unapproved license ${ids.join(", ")}`);
}

const pnpm = load(pnpmPath);
for (const [license, packages] of Object.entries(pnpm)) {
  for (const entry of Array.isArray(packages) ? packages : []) check(entry.name ?? entry, license);
}

const composer = load(composerPath);
for (const dependency of composer.dependencies ?? []) {
  const licenses = dependency.license ?? [];
  if (licenses.length === 0) check(dependency.name, "UNKNOWN");
  else check(dependency.name, licenses.join(" OR "));
}

if (failures.length) throw new Error(`Release license policy failed:\n${failures.join("\n")}`);
console.log("ok - release dependency licenses satisfy policy");
