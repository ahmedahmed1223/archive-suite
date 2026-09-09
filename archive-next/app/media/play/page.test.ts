import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("media player localization", () => {
  it("uses its dedicated dictionary for visible, status, and accessible copy", () => {
    expect(pageSource).toContain("const copy = t.pages.mediaPlay");
    expect(pageSource).toContain("aria-label={copy.bookmarksAriaLabel}");
    expect(pageSource).toContain("copy.loadingSavedTranscript");
  });

  it("resolves a timed-description link only from the current probe report", () => {
    expect(pageSource).toContain("resolveTimedDescriptionStartSeconds");
    expect(pageSource).toContain("api.mediaInspections(recordIdParam");
    expect(pageSource).toContain("params.get(\"segmentId\")");
  });
});
