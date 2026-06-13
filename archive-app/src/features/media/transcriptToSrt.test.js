import { describe, it, expect } from "vitest";
import {
  formatSrtTimecode,
  formatVttTimecode,
  transcriptToSrt,
  transcriptToVtt,
} from "./transcriptToSrt.js";
import { parseSubtitles } from "./subtitleParser.js";

describe("formatSrtTimecode / formatVttTimecode", () => {
  it("formats SRT with comma + 3-digit ms", () => {
    expect(formatSrtTimecode(62.5)).toBe("00:01:02,500");
  });

  it("formats VTT with dot", () => {
    expect(formatVttTimecode(3661.25)).toBe("01:01:01.250");
  });

  it("carries a millisecond rounding spill into the next second", () => {
    expect(formatSrtTimecode(1.9999)).toBe("00:00:02,000");
  });

  it("clamps negatives to zero", () => {
    expect(formatSrtTimecode(-5)).toBe("00:00:00,000");
  });
});

const transcript = {
  segments: [
    { start: 0, end: 2, text: " hello " },
    { start: 2, end: 4.5, text: "world" },
  ],
};

describe("transcriptToSrt", () => {
  it("emits numbered cues with arrow timecodes", () => {
    const srt = transcriptToSrt(transcript);
    expect(srt).toContain("1\n00:00:00,000 --> 00:00:02,000\nhello");
    expect(srt).toContain("2\n00:00:02,000 --> 00:00:04,500\nworld");
  });

  it("round-trips through the parser", () => {
    const cues = parseSubtitles(transcriptToSrt(transcript));
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ start: 0, end: 2, text: "hello" });
  });

  it("returns empty string with no segments", () => {
    expect(transcriptToSrt({})).toBe("");
  });

  it("infers a missing end from the next segment start", () => {
    const srt = transcriptToSrt({ segments: [{ start: 0, text: "a" }, { start: 10, text: "b" }] });
    expect(srt).toContain("00:00:00,000 --> 00:00:10,000");
  });
});

describe("transcriptToVtt", () => {
  it("starts with the WEBVTT header", () => {
    expect(transcriptToVtt(transcript).startsWith("WEBVTT\n\n")).toBe(true);
  });

  it("returns just the header when empty", () => {
    expect(transcriptToVtt({})).toBe("WEBVTT");
  });
});
