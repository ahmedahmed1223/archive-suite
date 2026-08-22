import { describe, expect, test } from "vitest";
import { getReleaseNotes, listReleaseVersions } from "./release-notes";

describe("release notes", () => {
  test("loads the Arabic and English notes for v1.3.1", () => {
    expect(getReleaseNotes("1.3.1")).toMatchObject({ version: "1.3.1" });
    expect(getReleaseNotes("1.3.1")?.ar).toContain("اتجاه");
    expect(getReleaseNotes("1.3.1")?.en).toContain("direction");
  });

  test("loads the Arabic and English notes for v1.4.0", () => {
    expect(getReleaseNotes("1.4.0")).toMatchObject({ version: "1.4.0" });
    // V14-REL-001 (Task 10): the notes must name the headline UX changes.
    expect(getReleaseNotes("1.4.0")?.ar).toContain("صندوق العمل");
    expect(getReleaseNotes("1.4.0")?.ar).toContain("التنقل");
    expect(getReleaseNotes("1.4.0")?.en).toContain("daily navigation");
    expect(getReleaseNotes("1.4.0")?.en).toContain("work inbox");
  });

  test("loads the Arabic and English notes for an available release", () => {
    expect(getReleaseNotes("1.2.1")).toMatchObject({
      version: "1.2.1",
      ar: expect.stringContaining("الإصدار 1.2.1"),
      en: expect.stringContaining("Archive Suite v1.2.1"),
    });
    expect(getReleaseNotes("1.2.1")?.ar).toMatch(/دعم كامل للغتين/);
    expect(getReleaseNotes("1.2.1")?.en).toMatch(/Full bilingual interface support/);
  });

  test("does not resolve an unavailable release", () => {
    expect(getReleaseNotes("9.9.9")).toBeNull();
  });

  test("lists each release only once regardless of language", () => {
    expect(listReleaseVersions()).toContain("1.2.1");
    expect(listReleaseVersions().filter((version) => version === "1.2.1")).toHaveLength(1);
  });
});
