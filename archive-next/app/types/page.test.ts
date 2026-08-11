import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const editor = readFileSync(new URL("./_components/TypesEditor.tsx", import.meta.url), "utf8");

describe("types studio localization", () => {
  it("uses the shared types dictionary in both the page and editor", () => {
    expect(page).toContain("const copy = t.pages.types");
    expect(editor).toContain("const copy = t.pages.types");
  });
});
