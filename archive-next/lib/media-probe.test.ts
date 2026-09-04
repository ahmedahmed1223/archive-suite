import { describe, expect, it } from "vitest";
import { mediaProbeReportFromJobResult } from "./media-probe";

describe("mediaProbeReportFromJobResult", () => {
  it("extracts a valid probe artifact from an untyped media job result", () => {
    const report = mediaProbeReportFromJobResult({
      artifacts: [{
        kind: "media_probe_report",
        report: {
          formatNames: ["mov", "mp4"],
          durationSeconds: 62.52,
          sizeBytes: 1048576,
          bitRate: 134174,
          streams: [{ index: 0, type: "video", codec: "h264" }]
        }
      }]
    });

    expect(report?.formatNames).toEqual(["mov", "mp4"]);
    expect(report?.streams[0]).toMatchObject({ type: "video", codec: "h264" });
  });

  it("returns null for malformed or unrelated results", () => {
    expect(mediaProbeReportFromJobResult(null)).toBeNull();
    expect(mediaProbeReportFromJobResult({ artifacts: [{ kind: "thumbnail" }] })).toBeNull();
    expect(mediaProbeReportFromJobResult({ artifacts: [{ kind: "media_probe_report", report: { streams: "bad" } }] })).toBeNull();
  });
});
