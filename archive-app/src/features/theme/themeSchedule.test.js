import { describe, it, expect } from "vitest";
import {
  THEME_MODE,
  DEFAULT_SCHEDULE,
  relativeLuminance,
  isDarkHex,
  getDaisyThemeTone,
  normalizeSchedule,
  resolveScheduledTheme,
  getStoredSchedule,
  storeSchedule,
  THEME_SCHEDULE_STORAGE_KEY,
} from "./themeSchedule.js";

describe("relativeLuminance", () => {
  it("returns 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("expands 3-digit hex", () => {
    expect(relativeLuminance("#fff")).toBeCloseTo(1, 5);
  });

  it("treats unparseable input as light (1)", () => {
    expect(relativeLuminance("not-a-color")).toBe(1);
    expect(relativeLuminance(undefined)).toBe(1);
  });
});

describe("isDarkHex / getDaisyThemeTone", () => {
  it("classifies colors by luminance", () => {
    expect(isDarkHex("#1c1c1c")).toBe(true);
    expect(isDarkHex("#ffffff")).toBe(false);
  });

  it("derives tone from the DaisyUI catalogue background", () => {
    expect(getDaisyThemeTone("business")).toBe("dark"); // bg #1c1c1c
    expect(getDaisyThemeTone("corporate")).toBe("light"); // bg #ffffff
  });

  it("falls back for unknown ids to the default theme tone", () => {
    expect(getDaisyThemeTone("does-not-exist")).toBe("dark"); // default business
  });
});

describe("normalizeSchedule", () => {
  it("returns defaults for nullish/garbage input", () => {
    expect(normalizeSchedule(null)).toEqual(DEFAULT_SCHEDULE);
    expect(normalizeSchedule("x")).toEqual(DEFAULT_SCHEDULE);
  });

  it("coerces invalid mode to manual and invalid theme ids to defaults", () => {
    const result = normalizeSchedule({ mode: "weird", theme: "nope", lightTheme: "emerald" });
    expect(result.mode).toBe(THEME_MODE.MANUAL);
    expect(result.theme).toBe(DEFAULT_SCHEDULE.theme);
    expect(result.lightTheme).toBe("emerald");
  });
});

describe("resolveScheduledTheme", () => {
  it("returns the picked theme in manual mode regardless of system state", () => {
    const schedule = { mode: THEME_MODE.MANUAL, theme: "nord" };
    expect(resolveScheduledTheme(schedule, true)).toBe("nord");
    expect(resolveScheduledTheme(schedule, false)).toBe("nord");
  });

  it("follows prefers-color-scheme in auto mode", () => {
    const schedule = { mode: THEME_MODE.AUTO, lightTheme: "corporate", darkTheme: "night" };
    expect(resolveScheduledTheme(schedule, false)).toBe("corporate");
    expect(resolveScheduledTheme(schedule, true)).toBe("night");
  });
});

describe("getStoredSchedule / storeSchedule", () => {
  const makeStorage = () => {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, v),
    };
  };

  it("round-trips a normalized schedule", () => {
    const storage = makeStorage();
    storeSchedule({ mode: THEME_MODE.AUTO, lightTheme: "winter", darkTheme: "dim" }, storage);
    expect(JSON.parse(storage.getItem(THEME_SCHEDULE_STORAGE_KEY)).mode).toBe(THEME_MODE.AUTO);
    expect(getStoredSchedule(storage)).toEqual({
      mode: THEME_MODE.AUTO,
      theme: DEFAULT_SCHEDULE.theme,
      lightTheme: "winter",
      darkTheme: "dim",
    });
  });

  it("returns defaults when nothing is stored or JSON is corrupt", () => {
    expect(getStoredSchedule(makeStorage())).toEqual(DEFAULT_SCHEDULE);
    const corrupt = { getItem: () => "{not json", setItem: () => {} };
    expect(getStoredSchedule(corrupt)).toEqual(DEFAULT_SCHEDULE);
  });
});
