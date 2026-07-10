import { describe, expect, it } from "vitest";
import { getCopilotStatus } from "./copilot-status";

describe("getCopilotStatus", () => {
  it("keeps the assistant unavailable until the server opt-in and provider name are both present", () => {
    expect(getCopilotStatus({ ARCHIVE_COPILOT_PROVIDER: "openai" })).toEqual({
      configured: false,
      reason: "not_configured"
    });
  });

  it("reports readiness without exposing provider credentials", () => {
    expect(getCopilotStatus({
      ARCHIVE_COPILOT_ENABLED: "true",
      ARCHIVE_COPILOT_PROVIDER: "openai",
      ARCHIVE_COPILOT_API_KEY: "must-not-be-returned"
    })).toEqual({ configured: true, reason: "ready" });
  });
});
