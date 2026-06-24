/**
 * Unit tests for broadcastIngest.js
 * Covers isBroadcastFile, extractBroadcastMetadata, and broadcastPlan edge cases.
 * Uses vitest (the project test runner).
 */

import { describe, it, expect } from "vitest";
import { isBroadcastFile, extractBroadcastMetadata } from "../media/broadcastIngest.js";
import { buildProResArgs, buildDnxhrArgs, PRORES_PROFILES, DNXHR_PROFILES } from "../media/broadcastPlan.js";

// ── isBroadcastFile ──────────────────────────────────────────────────────────

describe("isBroadcastFile", () => {
  it("returns true for .mxf", () => {
    expect(isBroadcastFile("/media/reel01.mxf")).toBe(true);
  });

  it("returns true for .xdcam", () => {
    expect(isBroadcastFile("/media/clip.xdcam")).toBe(true);
  });

  it("returns true for .mts", () => {
    expect(isBroadcastFile("/camera/0001.mts")).toBe(true);
  });

  it("returns true for .m2ts", () => {
    expect(isBroadcastFile("/camera/0001.m2ts")).toBe(true);
  });

  it("returns true for .op1a", () => {
    expect(isBroadcastFile("/archive/reel.op1a")).toBe(true);
  });

  it("returns true for uppercase .MXF extension", () => {
    expect(isBroadcastFile("/media/REEL01.MXF")).toBe(true);
  });

  it("returns false for .mp4", () => {
    expect(isBroadcastFile("/media/clip.mp4")).toBe(false);
  });

  it("returns false for .jpg", () => {
    expect(isBroadcastFile("/photos/image.jpg")).toBe(false);
  });

  it("returns false for .mov", () => {
    expect(isBroadcastFile("/media/clip.mov")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isBroadcastFile("")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isBroadcastFile(null)).toBe(false);
  });
});

// ── extractBroadcastMetadata ─────────────────────────────────────────────────

describe("extractBroadcastMetadata", () => {
  it("returns null for a non-broadcast file (.mp4)", async () => {
    const result = await extractBroadcastMetadata("/media/clip.mp4");
    expect(result).toBeNull();
  });

  it("returns null for a non-broadcast file (.jpg)", async () => {
    const result = await extractBroadcastMetadata("/photos/image.jpg");
    expect(result).toBeNull();
  });

  it("calls the injected runner and returns probe result for .mxf", async () => {
    const fakeProbe = {
      format: {
        duration: "1800.0",
        tags: { timecode: "01:00:00:00", reel_name: "REEL_A001" },
      },
      streams: [
        {
          codec_type: "video",
          width: 1920,
          height: 1080,
          codec_name: "mpeg2video",
          r_frame_rate: "25/1",
        },
      ],
    };
    const mockRunner = async () => ({ stdout: JSON.stringify(fakeProbe), stderr: "" });

    const result = await extractBroadcastMetadata("/media/reel.mxf", { runFfprobe: mockRunner });

    expect(result).not.toBeNull();
    expect(result.timecode).toBe("01:00:00:00");
    expect(result.reelName).toBe("REEL_A001");
    expect(result.durationSec).toBe(1800);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.codec).toBe("mpeg2video");
    expect(typeof result.extractedAt).toBe("string");
  });

  it("includes an extractedAt ISO timestamp in the result", async () => {
    const mockRunner = async () => ({
      stdout: JSON.stringify({
        format: { duration: "60.0", tags: {} },
        streams: [{ codec_type: "video", codec_name: "xdcam", r_frame_rate: "25/1" }],
      }),
      stderr: "",
    });
    const before = Date.now();
    const result = await extractBroadcastMetadata("/media/clip.mxf", { runFfprobe: mockRunner });
    const after = Date.now();

    expect(result).not.toBeNull();
    const ts = new Date(result.extractedAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("returns null when the injected runner throws (graceful failure)", async () => {
    const failingRunner = async () => { throw new Error("ffprobe not found"); };
    const result = await extractBroadcastMetadata("/media/reel.mxf", { runFfprobe: failingRunner });
    expect(result).toBeNull();
  });

  it("returns null when ffprobe returns empty JSON (no metadata)", async () => {
    const emptyRunner = async () => ({ stdout: "{}", stderr: "" });
    const result = await extractBroadcastMetadata("/media/reel.mxf", { runFfprobe: emptyRunner });
    // parseBroadcastProbe returns an object with all-null fields; probeBroadcastMetadata returns it
    // extractBroadcastMetadata returns null only if meta itself is null — here meta is an object
    // with null fields, so result should be non-null with null fields.
    expect(result).not.toBeNull();
    expect(result.timecode).toBeNull();
    expect(result.reelName).toBeNull();
    expect(result.codec).toBeNull();
  });
});

// ── buildProResArgs edge cases (supplement existing verify-broadcast-codecs) ─

describe("buildProResArgs edge cases", () => {
  it("throws when inputPath is empty string", () => {
    expect(() => buildProResArgs("", "/out/clip.mov")).toThrow();
  });

  it("throws when outputPath is empty string", () => {
    expect(() => buildProResArgs("/in/clip.mov", "")).toThrow();
  });

  it("uses profile 3 (HQ) as the default when no profile is supplied", () => {
    const args = buildProResArgs("/in/clip.mov", "/out/hq.mov");
    expect(args.join(" ")).toMatch(/-profile:v 3/);
  });

  it("throws for a decimal profile value (must be integer 0-3)", () => {
    expect(() => buildProResArgs("/in/clip.mov", "/out/clip.mov", 1.5)).toThrow(/profile/i);
  });
});

// ── buildDnxhrArgs edge cases ────────────────────────────────────────────────

describe("buildDnxhrArgs edge cases", () => {
  it("throws when inputPath is empty string", () => {
    expect(() => buildDnxhrArgs("", "/out/clip.mxf")).toThrow();
  });

  it("throws when outputPath is empty string", () => {
    expect(() => buildDnxhrArgs("/in/clip.mxf", "")).toThrow();
  });

  it("uses dnxhr_hq as the default profile", () => {
    const args = buildDnxhrArgs("/in/clip.mxf", "/out/hq.mxf");
    expect(args.join(" ")).toMatch(/-profile:v dnxhr_hq/);
  });

  it("throws for an unrecognised profile string", () => {
    expect(() => buildDnxhrArgs("/in/clip.mxf", "/out/clip.mxf", "dnxhr_ultra")).toThrow(/profile/i);
  });
});
