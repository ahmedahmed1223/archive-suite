import { describe, expect, it } from "vitest";
import { shouldShowWhatsNew } from "./whats-new";

describe("shouldShowWhatsNew", () => {
  it("shows release notes when the current release has not been acknowledged", () => {
    expect(shouldShowWhatsNew(null, "2026.07.18")).toBe(true);
    expect(shouldShowWhatsNew("2026.07.17", "2026.07.18")).toBe(true);
  });

  it("does not repeat release notes after acknowledging the current release", () => {
    expect(shouldShowWhatsNew("2026.07.18", "2026.07.18")).toBe(false);
  });
});
