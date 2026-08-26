import { describe, expect, it } from "vitest";
import { buildStudioHref, describeClipResult, isMontageSearchKind } from "./montage-search";

describe("montage search helpers (Task 9)", () => {
  it("builds a studio href from a known project id plus finite timestamp", () => {
    expect(buildStudioHref("p1", 12)).toBe("/media/studio?projectId=p1&at=12");
  });

  it("strips anything that is not a safe id character", () => {
    const href = buildStudioHref("../../etc/passwd");
    expect(href).not.toContain("..");
    expect(href).toContain("/media/studio");
  });

  it("drops non-finite and negative timestamps", () => {
    expect(buildStudioHref("p1", Number.NaN)).toBe("/media/studio?projectId=p1");
    expect(buildStudioHref("p1", -5)).toBe("/media/studio?projectId=p1");
  });

  it("validates the search kind union", () => {
    expect(isMontageSearchKind("clip")).toBe(true);
    expect(isMontageSearchKind("anything")).toBe(false);
  });

  it("describes a clip result for the accessible preview", () => {
    const text = describeClipResult({
      name: "مقابلة",
      durationSeconds: 91.4,
      hasDerivative: true,
    });
    expect(text).toContain("مقابلة");
    expect(text).toContain("91");
    expect(text).toContain("مشتقة");
  });
});
