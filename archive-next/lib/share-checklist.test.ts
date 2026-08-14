import { describe, expect, test } from "vitest";
import { defaultShareExpiryLocalValue, toDatetimeLocalValue, validateShareExpiry } from "./share-checklist";

describe("share-checklist (V1-836)", () => {
  test("defaultShareExpiryLocalValue is 7 days out", () => {
    const now = new Date("2026-01-01T10:00:00");
    expect(defaultShareExpiryLocalValue(now)).toBe(toDatetimeLocalValue(new Date("2026-01-08T10:00:00")));
  });

  test("rejects an empty value", () => {
    const result = validateShareExpiry("", new Date("2026-01-01T10:00:00"));
    expect(result.valid).toBe(false);
  });

  test("returns English validation text when English is selected", () => {
    expect(validateShareExpiry("", new Date("2026-01-01T10:00:00"), "en")).toEqual({
      valid: false,
      message: "Set an expiry date for the share link."
    });
  });

  test("rejects a value in the past", () => {
    const now = new Date("2026-01-05T10:00:00");
    const result = validateShareExpiry("2026-01-01T10:00", now);
    expect(result.valid).toBe(false);
  });

  test("accepts a future value and returns an ISO string", () => {
    const now = new Date("2026-01-01T10:00:00");
    const result = validateShareExpiry("2026-01-08T10:00", now);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(new Date(result.iso).getTime()).toBeGreaterThan(now.getTime());
    }
  });
});
