import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("RouteProgress localization", () => {
  it("keeps the decorative component free of untranslated Arabic copy", () => {
    const source = readFileSync(new URL("./RouteProgress.tsx", import.meta.url), "utf8");
    expect(source).not.toMatch(/[\u0600-\u06FF]/);
  });
});
