import { describe, expect, it } from "vitest";
import { buildSearchPlaybackHref } from "./search";

describe("buildSearchPlaybackHref", () => {
  it("builds a media-player URL with a transcript timestamp", () => {
    expect(buildSearchPlaybackHref({
      id: "oral-history-001",
      title: "مقابلة تاريخ شفهي",
      metadata: { filePath: "video/oral-history.mp4", disk: "archive" }
    }, 83)).toBe("/media/play?path=video%2Foral-history.mp4&recordId=oral-history-001&at=83&disk=archive");
  });

  it("refuses an absent source path or invalid timestamp", () => {
    expect(buildSearchPlaybackHref({ id: "no-file", title: "بدون ملف" }, 83)).toBeNull();
    expect(buildSearchPlaybackHref({ id: "clip-1", title: "مقطع", metadata: { filePath: "video/clip.mp4" } }, -1)).toBeNull();
  });
});
