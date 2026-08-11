import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("incoming shares localization", () => {
  it("uses its dedicated dictionary", () => {
    expect(readFileSync(new URL("./page.tsx", import.meta.url), "utf8")).toContain("const copy = t.pages.sharesWithMe");
  });
});
