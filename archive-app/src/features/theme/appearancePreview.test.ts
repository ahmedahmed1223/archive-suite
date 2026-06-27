import { describe, expect, it } from "vitest";

import { getAppearancePreviewModel } from "./appearancePreview.js";

describe("getAppearancePreviewModel", () => {
  it("returns DaisyUI semantic classes for outlined cards", () => {
    const model = getAppearancePreviewModel({
      accentColor: "teal",
      cardStyle: "outlined",
      daisyTheme: "winter",
      fontScale: "large",
      visualDensity: "compact"
    });

    expect(model.densityLabel).toBe("كثيف");
    expect(model.cardClass).toContain("border-base-300");
    expect(model.cardClass).not.toContain("border-white");
    expect(model.summary).toBe("DaisyUI winter، لون teal، خط large.");
  });

  it("labels balanced and comfortable density distinctly", () => {
    expect(getAppearancePreviewModel({ visualDensity: "balanced" }).densityLabel).toBe("متوازن");
    expect(getAppearancePreviewModel({ visualDensity: "comfortable" }).densityLabel).toBe("مريح");
  });

  it("falls back to a filled semantic surface for unknown card styles", () => {
    const model = getAppearancePreviewModel({ cardStyle: "unexpected" });

    expect(model.cardClass).toContain("border-base-300");
    expect(model.cardClass).toContain("bg-base-200");
    expect(model.cardClass).not.toContain("bg-gray");
  });
});
