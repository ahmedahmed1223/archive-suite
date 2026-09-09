import { describe, expect, it } from "vitest";
import { resolveTimedDescriptionStartSeconds } from "./timed-description-playback";

describe("resolveTimedDescriptionStartSeconds", () => {
  it("converts a segment frame boundary using the current probe's rational frame rate", () => {
    expect(resolveTimedDescriptionStartSeconds(3000, [
      {
        inspectionType: "probe",
        isCurrentVersion: true,
        report: {
          formatNames: ["mov"],
          durationSeconds: 120,
          sizeBytes: 1,
          bitRate: 1,
          streams: [{ index: 0, type: "video", codec: "h264", frameRate: { numerator: 30000, denominator: 1001 } }],
        },
      },
    ])).toBeCloseTo(100.1, 6);
  });

  it("refuses to derive a playback time from a stale or missing frame rate", () => {
    expect(resolveTimedDescriptionStartSeconds(250, [
      {
        inspectionType: "probe",
        isCurrentVersion: false,
        report: { formatNames: [], durationSeconds: null, sizeBytes: null, bitRate: null, streams: [] },
      },
    ])).toBeNull();
  });
});
