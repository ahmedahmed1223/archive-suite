// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { getTypeIcon, setTypeIcon } from "./type-icons";

afterEach(() => {
  window.localStorage.clear();
});

describe("type-icons (V1-794 wiring)", () => {
  test("returns undefined for a type with no assigned icon", () => {
    expect(getTypeIcon("document")).toBeUndefined();
  });

  test("persists and retrieves an icon by type id", () => {
    setTypeIcon("document", "FileText");
    expect(getTypeIcon("document")).toBe("FileText");
  });

  test("keeps icons for different type ids independent", () => {
    setTypeIcon("document", "FileText");
    setTypeIcon("photo", "Image");
    expect(getTypeIcon("document")).toBe("FileText");
    expect(getTypeIcon("photo")).toBe("Image");
  });

  test("ignores an empty type id", () => {
    setTypeIcon("", "Star");
    expect(getTypeIcon("")).toBeUndefined();
  });
});
