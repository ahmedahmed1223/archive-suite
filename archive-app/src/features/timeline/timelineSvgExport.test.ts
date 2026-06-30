import { describe, expect, test } from "vitest";
import { buildTimelineSvg } from "./timelineSvgExport.js";
import type { TimelineLanesResult } from "./timelineSelectors.js";

// Minimal helpers
function makeLanes(overrides: Partial<TimelineLanesResult> = {}): TimelineLanesResult {
  return {
    lanes: [
      {
        key: "video",
        label: "فيديو",
        total: 3,
        maxCount: 2,
        range: { from: "2026-01-01T00:00:00Z", to: "2026-06-01T00:00:00Z" },
        buckets: [
          { key: "2026-01", label: "يناير 2026", count: 1, items: [], byType: { video: 1 } },
          { key: "2026-06", label: "يونيو 2026", count: 2, items: [], byType: { video: 2 } }
        ]
      }
    ],
    total: 3,
    groupBy: "type",
    granularity: "month",
    maxLaneTotal: 3,
    ...overrides
  };
}

describe("buildTimelineSvg", () => {
  test("returns empty string when there are no lanes", () => {
    const result = buildTimelineSvg({ lanes: [], total: 0, groupBy: "all", granularity: "month", maxLaneTotal: 0 });
    expect(result).toBe("");
  });

  test("returns a valid SVG string starting with <svg xmlns", () => {
    const svg = buildTimelineSvg(makeLanes());
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  });

  test("closes the SVG tag", () => {
    const svg = buildTimelineSvg(makeLanes());
    expect(svg).toMatch(/<\/svg>$/);
  });

  test("contains one circle per bucket", () => {
    const svg = buildTimelineSvg(makeLanes());
    const circleMatches = svg.match(/<circle /g);
    // 2 buckets → 2 circles
    expect(circleMatches?.length).toBe(2);
  });

  test("encodes the lane label in the SVG", () => {
    const svg = buildTimelineSvg(makeLanes());
    expect(svg).toContain("فيديو");
  });

  test("escapes XML-unsafe characters in labels", () => {
    const lanes = makeLanes();
    lanes.lanes[0].label = 'A & B <test> "x"';
    const svg = buildTimelineSvg(lanes);
    expect(svg).not.toContain("A & B");
    expect(svg).toContain("A &amp; B &lt;test&gt; &quot;x&quot;");
  });

  test("includes both bucket count texts", () => {
    const svg = buildTimelineSvg(makeLanes());
    // Count labels: "1" and "2"
    expect(svg).toContain(">1<");
    expect(svg).toContain(">2<");
  });

  test("includes bucket key labels in x-axis", () => {
    const svg = buildTimelineSvg(makeLanes());
    expect(svg).toContain("2026-01");
    expect(svg).toContain("2026-06");
  });

  test("width and height are encoded as positive numbers", () => {
    const svg = buildTimelineSvg(makeLanes());
    const match = svg.match(/width="(\d+)" height="(\d+)"/);
    expect(match).toBeTruthy();
    expect(Number(match![1])).toBeGreaterThan(0);
    expect(Number(match![2])).toBeGreaterThan(0);
  });

  test("includes exportedAt date when provided", () => {
    const svg = buildTimelineSvg(makeLanes(), { exportedAt: "2026-06-30T10:00:00Z" });
    expect(svg).toContain("2026-06-30");
  });

  test("multiple lanes produce one row connector each", () => {
    const lanes = makeLanes();
    lanes.lanes.push({
      key: "audio",
      label: "صوتيات",
      total: 1,
      maxCount: 1,
      range: { from: "2026-01-01T00:00:00Z", to: "2026-01-01T00:00:00Z" },
      buckets: [{ key: "2026-01", label: "يناير 2026", count: 1, items: [], byType: { audio: 1 } }]
    });
    const svg = buildTimelineSvg(lanes);
    // 3 circles: 2 for video lane + 1 for audio lane
    const circleMatches = svg.match(/<circle /g);
    expect(circleMatches?.length).toBe(3);
    expect(svg).toContain("صوتيات");
  });
});
