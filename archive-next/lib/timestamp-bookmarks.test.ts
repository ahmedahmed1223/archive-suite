import { describe, expect, it } from "vitest";
import { bookmarkNotes, formatBookmarkTime } from "./timestamp-bookmarks";

describe("timestamp bookmarks", () => {
  it("keeps timed notes only and orders them by playback time", () => {
    expect(bookmarkNotes([{ id: "b", timestampSeconds: 20 }, { id: "x", timestampSeconds: null }, { id: "a", timestampSeconds: 5 }]).map((note) => note.id)).toEqual(["a", "b"]);
  });

  it("formats playback time", () => expect(formatBookmarkTime(83)).toBe("01:23"));
});
