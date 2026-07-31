import { describe, expect, it } from "vitest";
import { deviatesFromSuggestion, suggestFilename } from "./filename-normalization";

describe("filename normalization (V1-846)", () => {
  it("builds type-date-title with the original extension", () => {
    const name = suggestFilename({
      originalName: "IMG_0001.mp4",
      type: "video",
      title: "افتتاح المهرجان",
      createdAt: "2026-07-15T10:00:00Z"
    });
    expect(name).toBe("video-2026-07-15-افتتاح-المهرجان.mp4");
  });

  it("drops missing parts without leaving stray separators", () => {
    expect(suggestFilename({ originalName: "clip.mov", type: "video" })).toBe("video.mov");
  });

  it("falls back to the original name when nothing is known", () => {
    expect(suggestFilename({ originalName: "clip.mov" })).toBe("clip.mov");
  });

  it("ignores an unparsable createdAt instead of crashing", () => {
    expect(suggestFilename({ originalName: "clip.mov", type: "video", createdAt: "not-a-date" })).toBe("video.mov");
  });

  it("flags deviation only when the suggestion differs from the original", () => {
    expect(deviatesFromSuggestion({ originalName: "clip.mov", type: "video" })).toBe(true);
    expect(deviatesFromSuggestion({ originalName: "clip.mov" })).toBe(false);
  });
});
