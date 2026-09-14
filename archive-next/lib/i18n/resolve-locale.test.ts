import { describe, expect, it } from "vitest";

import { directionFor, resolveRequestLocale } from "./resolve-locale";

describe("resolveRequestLocale", () => {
  it("prefers a supported locale cookie over the browser language", () => {
    expect(
      resolveRequestLocale({
        cookie: "en",
        acceptLanguage: "ar-SA,ar;q=0.9",
        fallback: "ar",
      }),
    ).toBe("en");
  });

  it("keeps Arabic as the product default for a new visitor with an English browser", () => {
    expect(
      resolveRequestLocale({
        cookie: null,
        acceptLanguage: "fr-FR,en-US;q=0.8,ar;q=0.4",
        fallback: "ar",
      }),
    ).toBe("ar");
  });

  it("falls back to Arabic when stored and browser values are unsupported", () => {
    expect(
      resolveRequestLocale({
        cookie: "fr",
        acceptLanguage: "de-DE,fr;q=0.9",
        fallback: "ar",
      }),
    ).toBe("ar");
  });

  it("maps Arabic to RTL and English to LTR", () => {
    expect(directionFor("ar")).toBe("rtl");
    expect(directionFor("en")).toBe("ltr");
  });
});
