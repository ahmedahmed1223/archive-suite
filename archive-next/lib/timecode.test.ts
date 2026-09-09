import { describe, expect, test } from "vitest";
import { framesToTimecode, secondsToFrames, timecodeToFrames } from "./timecode";

describe("timecode", () => {
  test("converts seconds to whole frames using a rational frame rate", () => {
    expect(secondsToFrames(10, { numerator: 30000, denominator: 1001 })).toBe(300);
  });

  test("renders non-drop-frame timecode in a stable LTR form", () => {
    expect(framesToTimecode(1800, { numerator: 30000, denominator: 1001 }, "non_drop")).toBe("00:01:00:00");
  });

  test("parses a non-drop timecode back to its frame boundary", () => {
    expect(timecodeToFrames("00:01:00:00", { numerator: 30000, denominator: 1001 }, "non_drop")).toBe(1800);
  });

  test("parses drop-frame timecode and rejects skipped frame labels", () => {
    const rate = { numerator: 30000, denominator: 1001 };
    expect(timecodeToFrames("00:01:00;02", rate, "drop_frame")).toBe(1800);
    expect(timecodeToFrames("00:01:00;00", rate, "drop_frame")).toBeNull();
  });
});
