// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { nextReadinessKeyForStudio, readinessItemsForStudio } from "./StudioReadinessStrip";

describe("studio readiness strip", () => {
  test("prioritizes the first unresolved archival step as the next action", () => {
    const items = readinessItemsForStudio({
      hasSource: true,
      hasTranscript: false,
      hasTechnicalSpec: true
    });

    expect(items).toEqual([
      { key: "source", status: "ready" },
      { key: "technical", status: "ready" },
      { key: "description", status: "needs-attention" }
    ]);
  });

  test("uses the earliest incomplete step as the actionable task", () => {
    expect(nextReadinessKeyForStudio({ hasSource: true, hasTranscript: false, hasTechnicalSpec: false })).toBe("technical");
  });
});
