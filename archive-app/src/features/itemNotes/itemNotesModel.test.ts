// @ts-nocheck
import { describe, it, expect } from "vitest";
import {
  createItemNote,
  sortNotes,
  filterNotesForItem,
  describeNoteAnchor,
  formatNoteTime
} from "./itemNotesModel.js";

describe("createItemNote", () => {
  it("applies sane defaults for an empty partial", () => {
    const note = createItemNote();
    expect(note.id).toMatch(/^note_/);
    expect(note.itemId).toBe("");
    expect(note.body).toBe("");
    expect(note.timestamp).toBeNull();
    expect(note.region).toBeNull();
    expect(note.authorName).toBe("مجهول");
    expect(typeof note.createdAt).toBe("string");
    expect(note.updatedAt).toBe(note.createdAt);
  });

  it("preserves provided id, trims body and keeps a valid timestamp", () => {
    const note = createItemNote({ id: "n1", itemId: 42, body: "  hi  ", timestamp: 83 });
    expect(note.id).toBe("n1");
    expect(note.itemId).toBe("42");
    expect(note.body).toBe("hi");
    expect(note.timestamp).toBe(83);
  });

  it("rejects invalid timestamps and regions to null", () => {
    expect(createItemNote({ timestamp: -5 }).timestamp).toBeNull();
    expect(createItemNote({ timestamp: "abc" }).timestamp).toBeNull();
    expect(createItemNote({ region: { x: 1, y: 2 } }).region).toBeNull();
    expect(createItemNote({ region: { x: 0, y: 0, w: 0, h: 5 } }).region).toBeNull();
  });

  it("normalizes a complete region", () => {
    const note = createItemNote({ region: { x: "0.1", y: "0.2", w: "0.3", h: "0.4" } });
    expect(note.region).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
  });
});

describe("sortNotes", () => {
  it("orders anchored notes by timestamp ascending before general notes", () => {
    const general = createItemNote({ id: "g", body: "general", createdAt: "2024-01-01T00:00:00.000Z" });
    const late = createItemNote({ id: "late", timestamp: 120, createdAt: "2024-01-01T00:00:00.000Z" });
    const early = createItemNote({ id: "early", timestamp: 10, createdAt: "2024-01-01T00:00:00.000Z" });
    const sorted = sortNotes([general, late, early]);
    expect(sorted.map((n) => n.id)).toEqual(["early", "late", "g"]);
  });

  it("breaks ties by createdAt and does not mutate the input array", () => {
    const a = createItemNote({ id: "a", createdAt: "2024-01-02T00:00:00.000Z" });
    const b = createItemNote({ id: "b", createdAt: "2024-01-01T00:00:00.000Z" });
    const input = [a, b];
    const sorted = sortNotes(input);
    expect(sorted.map((n) => n.id)).toEqual(["b", "a"]);
    expect(input.map((n) => n.id)).toEqual(["a", "b"]);
  });
});

describe("filterNotesForItem", () => {
  it("returns only notes matching the item id", () => {
    const notes = [
      createItemNote({ id: "1", itemId: "x" }),
      createItemNote({ id: "2", itemId: "y" }),
      createItemNote({ id: "3", itemId: "x" })
    ];
    expect(filterNotesForItem(notes, "x").map((n) => n.id)).toEqual(["1", "3"]);
  });

  it("returns an empty array for a falsy item id", () => {
    expect(filterNotesForItem([createItemNote({ itemId: "x" })], "")).toEqual([]);
  });
});

describe("formatNoteTime", () => {
  it("formats seconds as mm:ss", () => {
    expect(formatNoteTime(0)).toBe("0:00");
    expect(formatNoteTime(83)).toBe("1:23");
    expect(formatNoteTime(5)).toBe("0:05");
  });

  it("formats past an hour as h:mm:ss", () => {
    expect(formatNoteTime(3661)).toBe("1:01:01");
  });

  it("falls back to 0:00 for invalid input", () => {
    expect(formatNoteTime(-1)).toBe("0:00");
    expect(formatNoteTime("nope")).toBe("0:00");
  });
});

describe("describeNoteAnchor", () => {
  it("describes a time anchor in Arabic", () => {
    expect(describeNoteAnchor(createItemNote({ timestamp: 83 }))).toBe("عند 1:23");
  });

  it("describes a region anchor", () => {
    expect(describeNoteAnchor(createItemNote({ region: { x: 0, y: 0, w: 1, h: 1 } }))).toBe("منطقة محددة");
  });

  it("describes a general note", () => {
    expect(describeNoteAnchor(createItemNote({ body: "general" }))).toBe("ملاحظة عامة");
    expect(describeNoteAnchor(null)).toBe("ملاحظة عامة");
  });
});
