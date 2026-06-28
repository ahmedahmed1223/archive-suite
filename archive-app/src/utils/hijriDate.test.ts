import { describe, it, expect } from "vitest";

import { formatHijriDate, formatGregorianDate, formatDualDate } from "./hijriDate.js";

describe("hijriDate", () => {
  const sample = new Date("2026-06-22T00:00:00Z");

  it("formats a Hijri (Umm al-Qura) date with Arabic-Indic numerals", () => {
    const result = formatHijriDate(sample);
    expect(result).toMatch(/[٠-٩]+/);
    expect(result).toContain("هـ");
  });

  it("formats a Gregorian date with Arabic-Indic numerals", () => {
    const result = formatGregorianDate(sample);
    expect(result).toMatch(/[٠-٩]+/);
    expect(result).toContain("٢٠٢٦");
  });

  it("returns Gregorian · Hijri for the dual format", () => {
    const result = formatDualDate(sample);
    expect(result).toContain("٢٠٢٦");
    expect(result).toContain("هـ");
    expect(result).toContain(" · ");
  });

  it("honors a custom separator", () => {
    const result = formatDualDate(sample, { separator: " / " });
    expect(result).toContain(" / ");
    expect(result).not.toContain(" · ");
  });

  it("returns empty string for invalid input", () => {
    expect(formatHijriDate(new Date(NaN))).toBe("");
    expect(formatGregorianDate("not a date")).toBe("");
    expect(formatDualDate(undefined)).toBe("");
  });

  it("accepts ISO strings and millisecond timestamps", () => {
    expect(formatGregorianDate("2026-06-22").length).toBeGreaterThan(0);
    expect(formatGregorianDate(sample.getTime()).length).toBeGreaterThan(0);
  });
});
