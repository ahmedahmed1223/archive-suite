import { describe, it, expect } from "vitest";
import {
  parseTimecode,
  parseSubtitles,
  segmentsToCues,
  getActiveCue,
  type Cue,
} from "./subtitleParser.js";

describe("parseTimecode", () => {
  it("parses SRT comma milliseconds", () => {
    expect(parseTimecode("00:01:02,500")).toBe(62.5);
  });

  it("parses VTT dot milliseconds with hours", () => {
    expect(parseTimecode("01:00:00.000")).toBe(3600);
  });

  it("parses VTT mm:ss.mmm without hours", () => {
    expect(parseTimecode("02:05.250")).toBe(125.25);
  });

  it("returns NaN for garbage", () => {
    expect(Number.isNaN(parseTimecode("not-a-time"))).toBe(true);
  });
});

describe("parseSubtitles", () => {
  it("parses a basic SRT document", () => {
    const srt = [
      "1",
      "00:00:01,000 --> 00:00:03,000",
      "مرحبا",
      "",
      "2",
      "00:00:03,000 --> 00:00:05,000",
      "بك",
    ].join("\n");
    const cues = parseSubtitles(srt);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ start: 1, end: 3, text: "مرحبا" });
    expect(cues[1]).toMatchObject({ start: 3, end: 5, text: "بك" });
  });

  it("parses a WebVTT document and skips the header/NOTE", () => {
    const vtt = [
      "WEBVTT",
      "",
      "NOTE this is a comment",
      "",
      "00:00:00.000 --> 00:00:02.000",
      "hello",
      "world",
    ].join("\n");
    const cues = parseSubtitles(vtt);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("hello\nworld");
  });

  it("handles CRLF line endings and sorts by start", () => {
    const srt =
      "2\r\n00:00:05,000 --> 00:00:06,000\r\nsecond\r\n\r\n1\r\n00:00:01,000 --> 00:00:02,000\r\nfirst";
    const cues = parseSubtitles(srt);
    expect(cues.map((c) => c.text)).toEqual(["first", "second"]);
    expect(cues.map((c) => c.index)).toEqual([1, 2]);
  });

  it("returns [] for empty input", () => {
    expect(parseSubtitles("")).toEqual([]);
    expect(parseSubtitles(null)).toEqual([]);
  });
});

describe("segmentsToCues", () => {
  it("maps transcript segments and fills missing ends", () => {
    const cues = segmentsToCues([
      { start: 0, end: 2, text: "a" },
      { start: 2, text: "b" },
      { start: 5, text: "" },
    ]);
    expect(cues).toHaveLength(2);
    expect(cues[1]).toMatchObject({ start: 2, end: 5, text: "b" });
  });
});

describe("getActiveCue", () => {
  const cues: Cue[] = [
    { index: 1, start: 0, end: 2, text: "a" },
    { index: 2, start: 2, end: 4, text: "b" },
  ];

  it("finds the cue covering the time", () => {
    expect(getActiveCue(cues, 2.5)?.text).toBe("b");
  });

  it("is exclusive on the end boundary", () => {
    expect(getActiveCue(cues, 2)?.text).toBe("b");
    expect(getActiveCue(cues, 4)).toBeNull();
  });

  it("returns null before the first cue", () => {
    expect(getActiveCue(cues, -1)).toBeNull();
  });
});
