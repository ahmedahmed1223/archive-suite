import { describe, expect, test } from "vitest";
import { parseSubtitles, serializeSrt, serializeVtt, validateCueOrder, type Cue } from "@/lib/media/subtitles";

const cues: Cue[] = [
  { index: 1, start: 1.5, end: 3.25, text: "مرحبا بالعالم" },
  { index: 2, start: 4, end: 5.75, text: "Second line" },
];

describe("subtitle cue serialization (V3-MEDIA-005)", () => {
  test("SRT round-trips through serialize and parse, preserving Arabic text", () => {
    const srt = serializeSrt(cues);
    expect(srt).toContain("00:00:01,500 --> 00:00:03,250");
    expect(srt).toContain("مرحبا بالعالم");

    const parsed = parseSubtitles(srt);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].text).toBe("مرحبا بالعالم");
    expect(parsed[0].start).toBeCloseTo(1.5);
    expect(parsed[0].end).toBeCloseTo(3.25);
    expect(parsed[1].text).toBe("Second line");
  });

  test("VTT round-trips through serialize and parse, preserving Arabic text", () => {
    const vtt = serializeVtt(cues);
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    expect(vtt).toContain("00:00:01.500 --> 00:00:03.250");
    expect(vtt).toContain("مرحبا بالعالم");

    const parsed = parseSubtitles(vtt);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].text).toBe("مرحبا بالعالم");
    expect(parsed[1].text).toBe("Second line");
  });

  test("validateCueOrder accepts chronological, non-overlapping cues", () => {
    expect(validateCueOrder(cues)).toEqual([]);
  });

  test("validateCueOrder flags out-of-order cues", () => {
    const outOfOrder: Cue[] = [
      { index: 1, start: 5, end: 6, text: "second" },
      { index: 2, start: 1, end: 2, text: "first" },
    ];
    const errors = validateCueOrder(outOfOrder);
    expect(errors).toContainEqual({ cueIndex: 2, otherCueIndex: 1, kind: "out-of-order" });
  });

  test("validateCueOrder flags overlapping cues", () => {
    const overlapping: Cue[] = [
      { index: 1, start: 0, end: 3, text: "a" },
      { index: 2, start: 2, end: 5, text: "b" },
    ];
    const errors = validateCueOrder(overlapping);
    expect(errors).toContainEqual({ cueIndex: 2, otherCueIndex: 1, kind: "overlap" });
  });

  test("validateCueOrder flags a cue that ends before it starts", () => {
    const inverted: Cue[] = [{ index: 1, start: 3, end: 1, text: "a" }];
    expect(validateCueOrder(inverted)).toContainEqual({ cueIndex: 1, kind: "inverted" });
  });

  test("validateCueOrder allows adjacent cues that touch but do not overlap", () => {
    const adjacent: Cue[] = [
      { index: 1, start: 0, end: 2, text: "a" },
      { index: 2, start: 2, end: 4, text: "b" },
    ];
    expect(validateCueOrder(adjacent)).toEqual([]);
  });
});
