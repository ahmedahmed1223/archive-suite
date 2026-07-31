import { describe, expect, it } from "vitest";
import { checkFilename } from "./naming-rules-check";

describe("naming rule check (V1-858)", () => {
  it("with no rule, every filename matches", () => {
    expect(checkFilename("clip.mov", null)).toEqual({ matches: true, suggestion: null });
  });

  it("flags a filename that doesn't start with the required prefix and suggests a fix", () => {
    const rule = { key: "project-a", prefix: "PRJA-", updatedAt: "2026-01-01T00:00:00Z" };
    const result = checkFilename("clip.mov", rule);
    expect(result.matches).toBe(false);
    expect(result.suggestion).toBe("PRJA-clip.mov");
  });

  it("a filename already matching the prefix has no suggestion", () => {
    const rule = { key: "project-a", prefix: "PRJA-", updatedAt: "2026-01-01T00:00:00Z" };
    expect(checkFilename("PRJA-clip.mov", rule)).toEqual({ matches: true, suggestion: null });
  });
});
