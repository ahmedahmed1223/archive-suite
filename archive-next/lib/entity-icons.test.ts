// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { getEntityIcon, setEntityIcon } from "./entity-icons";

afterEach(() => {
  window.localStorage.clear();
});

describe("entity-icons (V1-794 tag/category rollout)", () => {
  test("returns undefined for an id with no assigned icon", () => {
    expect(getEntityIcon("tag", "urgent")).toBeUndefined();
  });

  test("persists and retrieves an icon by namespace and id", () => {
    setEntityIcon("tag", "urgent", "Flag");
    expect(getEntityIcon("tag", "urgent")).toBe("Flag");
  });

  test("keeps different namespaces independent even with the same id", () => {
    setEntityIcon("type", "document", "FileText");
    setEntityIcon("tag", "document", "Tag");
    expect(getEntityIcon("type", "document")).toBe("FileText");
    expect(getEntityIcon("tag", "document")).toBe("Tag");
  });

  test("ignores an empty id", () => {
    setEntityIcon("tag", "", "Star");
    expect(getEntityIcon("tag", "")).toBeUndefined();
  });
});
