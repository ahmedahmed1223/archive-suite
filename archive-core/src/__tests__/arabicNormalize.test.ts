import { describe, it, expect } from "vitest";
import { normalizeArabic } from "../utils/arabicNormalize.js";

describe("normalizeArabic", () => {
  it("removes tashkeel (diacritics)", () => {
    expect(normalizeArabic("مُحَمَّد")).toBe("محمد");
  });

  it("normalizes alef with hamza above (أ) to bare alef", () => {
    expect(normalizeArabic("أحمد")).toBe("احمد");
  });

  it("normalizes alef with hamza below (إ) to bare alef", () => {
    expect(normalizeArabic("إبراهيم")).toBe("ابراهيم");
  });

  it("normalizes alef with madda above (آ) to bare alef", () => {
    expect(normalizeArabic("آمنة")).toBe("امنه");
  });

  it("normalizes ya with no dots (ى) to ya with dots (ي)", () => {
    expect(normalizeArabic("موسى")).toBe("موسي");
  });

  it("normalizes ta marbuta (ة) to ha (ه)", () => {
    expect(normalizeArabic("فاطمة")).toBe("فاطمه");
  });

  it("handles empty string", () => {
    expect(normalizeArabic("")).toBe("");
  });

  it("handles null input", () => {
    expect(normalizeArabic(null)).toBe("");
  });

  it("handles undefined input", () => {
    expect(normalizeArabic(undefined)).toBe("");
  });

  it("handles non-Arabic ASCII input unchanged", () => {
    expect(normalizeArabic("hello")).toBe("hello");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeArabic("  محمد  ")).toBe("محمد");
  });

  it("lowercases ASCII characters", () => {
    expect(normalizeArabic("ABC")).toBe("abc");
  });

  it("handles mixed Arabic and ASCII text", () => {
    const result = normalizeArabic("مُحَمَّد2024");
    expect(result).toBe("محمد2024");
  });
});
