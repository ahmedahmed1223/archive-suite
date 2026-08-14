import { describe, expect, test } from "vitest";
import { getReleaseNotes, listReleaseVersions } from "./release-notes";

describe("release notes", () => {
  test("loads the Arabic and English notes for an available release", () => {
    expect(getReleaseNotes("1.2.0")).toMatchObject({
      version: "1.2.0",
      ar: expect.stringContaining("الإصدار 1.2.0"),
      en: expect.stringContaining("Archive Suite v1.2.0"),
    });
    expect(getReleaseNotes("1.2.0")?.ar).toMatch(/دعم الإنجليزية جزئي/);
    expect(getReleaseNotes("1.2.0")?.en).toMatch(/full\s+English support is not complete/);
  });

  test("does not resolve an unavailable release", () => {
    expect(getReleaseNotes("9.9.9")).toBeNull();
  });

  test("lists each release only once regardless of language", () => {
    expect(listReleaseVersions()).toContain("1.2.0");
    expect(listReleaseVersions().filter((version) => version === "1.2.0")).toHaveLength(1);
  });
});
