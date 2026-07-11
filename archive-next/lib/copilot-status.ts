import { resolveCopilotProvider } from "./copilot-provider";

export type CopilotStatus = {
  configured: boolean;
  reason: "ready" | "not_configured";
};

/**
 * This is deliberately an opt-in: a provider name alone must never enable a
 * feature that could send archive content outside the application boundary.
 * The result is safe to return to the browser and contains no provider name,
 * endpoint, or credential.
 */
export function getCopilotStatus(environment: Record<string, string | undefined>): CopilotStatus {
  const configured = environment.ARCHIVE_COPILOT_ENABLED === "true"
    && resolveCopilotProvider(environment).ready;

  return configured
    ? { configured: true, reason: "ready" }
    : { configured: false, reason: "not_configured" };
}
