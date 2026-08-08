import { describe, expect, it } from "vitest";

import { dictionaries, getDictionary } from "./dictionaries";

function leafPaths(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "object" && child !== null ? leafPaths(child, path) : [path];
  });
}

describe("localized dictionaries", () => {
  it("keeps Arabic and English feature keys in parity", () => {
    expect(leafPaths(dictionaries.ar).sort()).toEqual([
      "shared.actions.cancel",
      "shared.actions.retry",
      "shared.actions.save",
      "shared.appName",
      "shared.feedback.genericError",
      "shared.feedback.loading",
      "shared.languages.ar",
      "shared.languages.en",
    ]);
    expect(leafPaths(dictionaries.en).sort()).toEqual(leafPaths(dictionaries.ar).sort());
  });

  it("returns natural locale-specific interface copy", () => {
    expect(getDictionary("ar").shared.feedback.loading).toBe("جارٍ التحميل…");
    expect(getDictionary("en").shared.feedback.loading).toBe("Loading…");
    expect(getDictionary("ar").shared.languages.en).toBe("الإنجليزية");
  });
});
