import { describe, expect, test } from "vitest";
import { formatArabicDate, formatArabicDateTime, formatArabicNumber } from "@/lib/arabic-format";

describe("Arabic operational formatting (V1-306B)", () => {
  test("uses Gregorian Arabic numerals for a date", () => {
    expect(formatArabicDate("2026-07-26T12:30:00.000Z", "غير متاح")).toMatch(/٢٠٢٦/);
  });

  test("formats a timestamp and rejects malformed values", () => {
    expect(formatArabicDateTime("2026-07-26T12:30:00.000Z", "غير متاح")).toMatch(/٢٠٢٦/);
    expect(formatArabicDate("not-a-date", "غير متاح")).toBe("غير متاح");
  });

  test("uses Arabic numerals for quantities", () => {
    expect(formatArabicNumber(12345)).toMatch(/١٢٬٣٤٥/);
  });
});
