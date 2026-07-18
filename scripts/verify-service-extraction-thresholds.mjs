import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT_PATH = path.join(ROOT, "docs/architecture/service-extraction-thresholds.v1.json");
const positive = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;

function percent(value, field, errors) {
  if (typeof value !== "number" || value < 0 || value > 100) errors.push(`${field} must be between 0 and 100.`);
}

export function validateThresholdContract(contract) {
  const errors = [];
  if (contract?.schemaVersion !== 1) errors.push("schemaVersion must equal 1.");
  if (!positive(contract?.measurement?.minimumWindowDays) || contract.measurement.minimumWindowDays < 14) errors.push("measurement.minimumWindowDays must be at least 14.");
  if (!positive(contract?.measurement?.minimumSampleSize)) errors.push("measurement.minimumSampleSize must be positive.");
  if (!Array.isArray(contract?.measurement?.acceptedEvidence) || !contract.measurement.acceptedEvidence.length) errors.push("measurement.acceptedEvidence must not be empty.");
  const indicators = contract?.mediaWorker?.indicators;
  const indicatorCount = indicators && typeof indicators === "object" ? Object.keys(indicators).length : 0;
  const required = contract?.mediaWorker?.minimumIndicatorsRequired;
  if (!Number.isInteger(required) || required < 2 || required > indicatorCount) errors.push("mediaWorker.minimumIndicatorsRequired must be between 2 and the indicator count.");
  percent(indicators?.resourceUtilization?.thresholdPercent, "mediaWorker.indicators.resourceUtilization.thresholdPercent", errors);
  percent(indicators?.retryableFailureRate?.thresholdPercent, "mediaWorker.indicators.retryableFailureRate.thresholdPercent", errors);
  for (const field of ["queueLatency", "dailyThroughput"]) if (!positive(indicators?.[field]?.threshold)) errors.push(`mediaWorker.indicators.${field}.threshold must be positive.`);
  const triggers = contract?.outbox?.triggers;
  const triggerCount = triggers && typeof triggers === "object" ? Object.keys(triggers).length : 0;
  if (!triggerCount) errors.push("outbox.triggers must contain at least one qualifying trigger.");
  if (!Number.isInteger(contract?.outbox?.minimumTriggersRequired) || contract.outbox.minimumTriggersRequired < 1 || contract.outbox.minimumTriggersRequired > triggerCount) errors.push("outbox.minimumTriggersRequired must fit the trigger count.");
  if (!Array.isArray(contract?.outbox?.requiredControls) || contract.outbox.requiredControls.length < 5) errors.push("outbox.requiredControls must define reliability controls.");
  if (contract?.outbox?.eventBusIsDefault !== false) errors.push("outbox.eventBusIsDefault must remain false.");
  if (!Array.isArray(contract?.review?.requiredRoles) || !["architecture", "operations", "product"].every((role) => contract.review.requiredRoles.includes(role))) errors.push("review.requiredRoles must include architecture, operations, and product.");
  if (!positive(contract?.review?.rollbackReviewWithinDays) || contract.review.rollbackReviewWithinDays > 14) errors.push("review.rollbackReviewWithinDays must be between 1 and 14.");
  return errors;
}

async function main() {
  const contract = JSON.parse(await readFile(CONTRACT_PATH, "utf8"));
  const errors = validateThresholdContract(contract);
  if (errors.length) { errors.forEach((error) => console.error(`- ${error}`)); process.exitCode = 1; return; }
  console.log("ok - service extraction thresholds");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
