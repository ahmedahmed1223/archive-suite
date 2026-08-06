import { readFileSync } from "node:fs";
import { evaluateLicenseExpression } from "./release-license-policy.mjs";

const [, , pnpmPath, composerPath, policyPath = "config/release-license-policy.json"] = process.argv;
if (!pnpmPath || !composerPath) throw new Error("usage: verify-release-licenses.mjs <pnpm.json> <composer.json> [policy.json]");

const load = (path) => JSON.parse(readFileSync(path, "utf8"));
const policy = load(policyPath);
const allowed = new Set(policy.allowed);
const forbidden = new Set(policy.forbidden);
const exceptions = new Set(policy.exceptions.map(({ package: name, license }) => `${name}:${license}`));
const failures = [];

function check(name, expression) {
  const result = evaluateLicenseExpression(name, expression, { allowed, forbidden, exceptions });
  if (result.accepted) return;
  const details = result.rejected.map(({ kind, license }) => `${kind} license ${license}`).join(", ");
  failures.push(`${name}: ${details}`);
}

const pnpm = load(pnpmPath);
for (const [license, packages] of Object.entries(pnpm)) {
  for (const entry of Array.isArray(packages) ? packages : []) check(entry.name ?? entry, license);
}

const composer = load(composerPath);
// `composer licenses --format=json` emits "dependencies" as an object keyed
// by package name (each value carrying its own "license" array), not a list.
for (const [name, info] of Object.entries(composer.dependencies ?? {})) {
  const licenses = info.license ?? [];
  if (licenses.length === 0) check(name, "UNKNOWN");
  else check(name, licenses.join(" OR "));
}

if (failures.length) throw new Error(`Release license policy failed:\n${failures.join("\n")}`);
console.log("ok - release dependency licenses satisfy policy");
