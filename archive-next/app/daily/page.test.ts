import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("daily workspace localization", () => {
  it("uses its dedicated page dictionary for UI and accessible copy", () => {
    expect(pageSource).toContain("const copy = t.pages.daily");
    expect(pageSource).toContain("aria-label={copy.workListsAriaLabel}");
    expect(pageSource).toContain("copy.contextRecordingEnabled");
  });
});
