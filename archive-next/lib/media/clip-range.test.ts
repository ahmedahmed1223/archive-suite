import { describe, expect, it } from "vitest";
import { isValidClipRange } from "./clip-range";

describe("isValidClipRange", () => {
  it("accepts an out time after the in time", () => {
    expect(isValidClipRange(0, 1)).toBe(true);
    expect(isValidClipRange(1.5, 4.25)).toBe(true);
  });

  it("rejects an out time before the in time", () => {
    expect(isValidClipRange(10, 4)).toBe(false);
  });

  it("rejects an out time equal to the in time", () => {
    expect(isValidClipRange(5, 5)).toBe(false);
  });

  it("rejects a negative in time", () => {
    expect(isValidClipRange(-1, 5)).toBe(false);
  });

  it("rejects non-finite input", () => {
    expect(isValidClipRange(Number.NaN, 5)).toBe(false);
    expect(isValidClipRange(0, Number.POSITIVE_INFINITY)).toBe(false);
  });
});
