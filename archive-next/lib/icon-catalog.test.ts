import { describe, expect, test } from "vitest";
import { ICON_NAMES, searchIcons } from "@/lib/icon-catalog";

describe("icon-catalog searchIcons (V1-794)", () => {
  test("empty query returns all icons", () => {
    expect(searchIcons("")).toEqual([...ICON_NAMES]);
  });

  test("substring query filters matches", () => {
    expect(searchIcons("Vid")).toEqual(["Video"]);
  });

  test("query is case-insensitive", () => {
    expect(searchIcons("folder")).toEqual(["Folder"]);
  });

  test("no-match query returns empty array", () => {
    expect(searchIcons("zzzznotanicon")).toEqual([]);
  });
});
