import { describe, expect, it } from "vitest";

import {
  addFolderEntityRef,
  createFolderValue,
  folderHasEntity,
  getFolderEntityCount,
  getFolderEntityIds,
  removeFolderEntityRef
} from "./viewModel.js";

describe("folder entity references", () => {
  it("keeps legacy archive itemIds compatible with entity references", () => {
    const folder = createFolderValue({ id: "f1", name: "أرشيف", itemIds: ["a", "b"] });

    expect(getFolderEntityIds(folder, "archive-item")).toEqual(["a", "b"]);
    expect(getFolderEntityCount(folder, "archive-item")).toBe(2);
    expect(folderHasEntity(folder, "archive-item", "a")).toBe(true);
  });

  it("adds generic entity references without duplicating values", () => {
    const folder = createFolderValue({ id: "f1", name: "أنواع", scope: "types" });
    const withType = addFolderEntityRef(folder, "content-type", "interview");
    const duplicate = addFolderEntityRef(withType, "content-type", "interview");

    expect(getFolderEntityIds(withType, "content-type")).toEqual(["interview"]);
    expect(getFolderEntityIds(duplicate, "content-type")).toEqual(["interview"]);
  });

  it("removes generic entity references", () => {
    const folder = createFolderValue({
      id: "f1",
      name: "قاموس",
      scope: "vocabulary",
      entityRefs: [
        { type: "vocabulary", id: "term-a" },
        { type: "vocabulary", id: "term-b" }
      ]
    });
    const updated = removeFolderEntityRef(folder, "vocabulary", "term-a");

    expect(getFolderEntityIds(updated, "vocabulary")).toEqual(["term-b"]);
  });

  it("mirrors archive entity refs into itemIds for old archive folders", () => {
    const folder = createFolderValue({ id: "f1", name: "مواد" });
    const withItem = addFolderEntityRef(folder, "archive-item", "video-1");
    const removed = removeFolderEntityRef(withItem, "archive-item", "video-1");

    expect(withItem.itemIds).toEqual(["video-1"]);
    expect(getFolderEntityIds(withItem, "archive-item")).toEqual(["video-1"]);
    expect(removed.itemIds).toEqual([]);
  });
});
