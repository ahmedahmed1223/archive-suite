import { describe, expect, it } from "vitest";
import { encodeDragItems, decodeDragItems, getDragItemIds } from "./dndController.js";

describe("encodeDragItems / decodeDragItems", () => {
  it("round-trips an array of ids", () => {
    const ids = ["a", "b", "c"];
    expect(decodeDragItems(encodeDragItems(ids))).toEqual(ids);
  });

  it("returns empty array for invalid JSON", () => {
    expect(decodeDragItems("not-json")).toEqual([]);
  });

  it("filters falsy values", () => {
    expect(decodeDragItems(JSON.stringify(["a", null, "", "b"]))).toEqual(["a", "b"]);
  });

  it("returns empty array for non-array JSON", () => {
    expect(decodeDragItems(JSON.stringify({ id: "a" }))).toEqual([]);
  });
});

describe("getDragItemIds", () => {
  it("returns ids from a synthetic drop event", () => {
    const ids = ["x", "y"];
    const event = {
      dataTransfer: {
        getData: () => encodeDragItems(ids),
      },
    };
    expect(getDragItemIds(event)).toEqual(ids);
  });

  it("returns empty array when dataTransfer is absent", () => {
    expect(getDragItemIds({})).toEqual([]);
  });

  it("returns empty array when getData returns empty string", () => {
    const event = { dataTransfer: { getData: () => "" } };
    expect(getDragItemIds(event)).toEqual([]);
  });
});
