import { describe, expect, it } from "vitest";
import {
  DEFAULT_DISPLAY_SETTINGS,
  formatDate,
  formatDateTime,
  formatTime,
  type DisplaySettings
} from "./display-settings";

const instant = "2026-07-21T06:05:09.000Z";

const withSettings = (overrides: Partial<DisplaySettings>): DisplaySettings => ({
  ...DEFAULT_DISPLAY_SETTINGS,
  ...overrides
});

describe("central display settings formatter", () => {
  it.each([
    ["DD/MM/YYYY", "21/07/2026"],
    ["MM/DD/YYYY", "07/21/2026"],
    ["YYYY-MM-DD", "2026-07-21"]
  ] as const)("renders %s date format", (dateFormat, expected) => {
    expect(formatDate(instant, withSettings({ dateFormat }), "ar")).toBe(expected);
  });

  it("renders 24-hour time without seconds by default", () => {
    expect(formatTime(instant, DEFAULT_DISPLAY_SETTINGS, "ar")).toBe("09:05");
  });

  it("uses Arabic day periods while preserving central format and Latin numerals", () => {
    expect(formatTime(instant, withSettings({ timeFormat: "12h", showSeconds: true }), "ar")).toBe("09:05:09 ص");
  });

  it("uses English day periods while preserving central format and Latin numerals", () => {
    expect(formatTime(instant, withSettings({ timeFormat: "12h", showSeconds: true }), "en")).toBe("09:05:09 AM");
  });

  it("combines the configured date and time", () => {
    expect(formatDateTime(instant, withSettings({ dateFormat: "YYYY-MM-DD", showSeconds: true }), "ar")).toBe("2026-07-21 09:05:09");
  });

  it("uses Europe/Istanbul for the default configured zone", () => {
    expect(formatDateTime(instant, DEFAULT_DISPLAY_SETTINGS, "ar")).toBe("21/07/2026 09:05");
  });

  it("uses the selected zone across its daylight-saving transition", () => {
    const berlin = withSettings({ timeZone: "Europe/Berlin" });
    expect(formatTime("2026-03-29T00:30:00.000Z", berlin, "ar")).toBe("01:30");
    expect(formatTime("2026-03-29T01:30:00.000Z", berlin, "ar")).toBe("03:30");
  });

  it("returns the fallback for an invalid date", () => {
    expect(formatDate("not-a-date", DEFAULT_DISPLAY_SETTINGS, "ar", "غير متاح")).toBe("غير متاح");
    expect(formatDateTime("not-a-date", DEFAULT_DISPLAY_SETTINGS, "ar")).toBe("—");
  });
});
