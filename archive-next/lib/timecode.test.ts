import { describe, expect, test } from "vitest";
import { framesToTimecode, secondsToFrames } from "./timecode";

describe("timecode", () => {
  test("converts seconds to whole frames using a rational frame rate", () => {
    expect(secondsToFrames(10, { numerator: 30000, denominator: 1001 })).toBe(300);
  });

  test("renders non-drop-frame timecode in a stable LTR form", () => {
    expect(framesToTimecode(1800, { numerator: 30000, denominator: 1001 }, "non_drop")).toBe("00:01:00:00");
  });
});
