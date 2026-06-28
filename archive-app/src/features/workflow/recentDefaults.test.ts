// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  getRecentDefaults,
  recordRecentCollection,
  recordRecentFolder,
  recordRecentTags,
  recordRecentType
} from "./recentDefaults.js";

const KEY = "videoArchive:recentDefaults";

beforeEach(() => {
  window.localStorage.clear();
});

describe("getRecentDefaults", () => {
  it("returns empty defaults when nothing stored", () => {
    const d = getRecentDefaults();
    expect(d.typeId).toBe("");
    expect(d.tags).toEqual([]);
    expect(d.folderId).toBeNull();
    expect(d.collectionId).toBeNull();
  });

  it("returns stored values", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ typeId: "video", tags: ["news"], folderId: "f1", collectionId: null }));
    const d = getRecentDefaults();
    expect(d.typeId).toBe("video");
    expect(d.tags).toEqual(["news"]);
    expect(d.folderId).toBe("f1");
  });

  it("handles corrupt storage gracefully", () => {
    window.localStorage.setItem(KEY, "not-json");
    const d = getRecentDefaults();
    expect(d.typeId).toBe("");
  });
});

describe("recordRecentType", () => {
  it("saves the type id", () => {
    recordRecentType("documentary");
    expect(getRecentDefaults().typeId).toBe("documentary");
  });

  it("ignores empty string", () => {
    recordRecentType("documentary");
    recordRecentType("");
    expect(getRecentDefaults().typeId).toBe("documentary");
  });
});

describe("recordRecentTags", () => {
  it("saves tags and merges with existing", () => {
    recordRecentTags(["news"]);
    recordRecentTags(["sports", "news"]);
    const { tags } = getRecentDefaults();
    expect(tags).toContain("sports");
    expect(tags).toContain("news");
    expect(tags.filter((t) => t === "news").length).toBe(1);
  });

  it("ignores empty arrays", () => {
    recordRecentTags([]);
    expect(getRecentDefaults().tags).toEqual([]);
  });

  it("caps at 20 tags", () => {
    const many = Array.from({ length: 25 }, (_, i) => `tag${i}`);
    recordRecentTags(many);
    expect(getRecentDefaults().tags.length).toBeLessThanOrEqual(20);
  });
});

describe("recordRecentFolder", () => {
  it("saves folder id", () => {
    recordRecentFolder("folder-abc");
    expect(getRecentDefaults().folderId).toBe("folder-abc");
  });

  it("stores null for falsy value", () => {
    recordRecentFolder("folder-abc");
    recordRecentFolder(null);
    expect(getRecentDefaults().folderId).toBeNull();
  });
});

describe("recordRecentCollection", () => {
  it("saves collection id", () => {
    recordRecentCollection("col-xyz");
    expect(getRecentDefaults().collectionId).toBe("col-xyz");
  });
});
