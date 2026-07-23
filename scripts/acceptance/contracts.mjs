import { redactText } from "../observability.mjs";

export const SCENARIO_STATUSES = Object.freeze([
  "passed",
  "failed",
  "blocked-capability",
]);

export const FAILURE_CLASSIFICATIONS = Object.freeze([
  "product",
  "platform",
  "data",
  "environment",
  "flake",
]);

export const FAILURE_REASONS = Object.freeze([
  "scenario-failed",
  "executor-error",
  "provider-failure",
  "scenario-timeout",
  "run-timeout",
  "browser-exit",
  "browser-signal",
  "invalid-data",
  "flake-detected",
]);

export const MAX_DIAGNOSTIC_DETAIL_LENGTH = 512;

export const SCENARIO_TAGS = Object.freeze([
  "smoke",
  "daily",
  "nightly",
  "rc",
  "ga",
  "external",
]);

const SCENARIO_ID = /^V1-IA-[A-Z]+-\d{3}$/;

export function validateScenario(input) {
  if (!SCENARIO_ID.test(input?.id ?? "")) throw new Error("scenario id is invalid");
  if (!input.title?.trim()) throw new Error("scenario title is required");
  if (!Array.isArray(input.tags) || input.tags.length === 0 || input.tags.some((tag) => !SCENARIO_TAGS.includes(tag))) {
    throw new Error("scenario tag is invalid");
  }
  if (!Array.isArray(input.capabilities)) throw new Error("scenario capabilities are required");
  if (!Number.isInteger(input.loginSessions) || input.loginSessions < 0) {
    throw new Error("scenario loginSessions is invalid");
  }
  if (input.refreshSessions !== undefined && (!Number.isInteger(input.refreshSessions) || input.refreshSessions < 0)) {
    throw new Error("scenario refreshSessions is invalid");
  }
  if (!Number.isInteger(input.timeoutMs) || input.timeoutMs <= 0) {
    throw new Error("scenario timeoutMs is invalid");
  }
  return Object.freeze({
    ...input,
    tags: Object.freeze([...input.tags]),
    capabilities: Object.freeze([...input.capabilities]),
  });
}

export function validateResult(input) {
  if (!SCENARIO_STATUSES.includes(input?.status)) throw new Error("result status is invalid");
  if (!SCENARIO_ID.test(input?.scenarioId ?? "")) throw new Error("result scenarioId is invalid");
  if (input.status === "failed" && !FAILURE_CLASSIFICATIONS.includes(input.classification)) {
    throw new Error("result classification is invalid");
  }
  if (input.status === "failed" && !FAILURE_REASONS.includes(input.reason)) {
    throw new Error("result reason is invalid");
  }
  if (input.detail !== undefined && (
    typeof input.detail !== "string"
    || input.detail.length > MAX_DIAGNOSTIC_DETAIL_LENGTH
    || boundedDiagnosticDetail(input.detail) !== input.detail
  )) {
    throw new Error("result detail is invalid");
  }
  return input;
}

export function boundedDiagnosticDetail(value) {
  return redactText(value).replace(/\s+/g, " ").trim().slice(0, MAX_DIAGNOSTIC_DETAIL_LENGTH);
}
