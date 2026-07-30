// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { clearEditDraftPosition, getEditDraftPosition, saveEditDraftPosition } from "./edit-draft-position";

afterEach(() => {
  clearEditDraftPosition();
});

describe("edit-draft-position (V1-826)", () => {
  test("returns null when nothing has been saved", () => {
    expect(getEditDraftPosition()).toBeNull();
  });

  test("round-trips a saved position", () => {
    saveEditDraftPosition("rec-1", "description");
    const position = getEditDraftPosition();
    expect(position?.recordId).toBe("rec-1");
    expect(position?.field).toBe("description");
  });

  test("clear removes the saved position", () => {
    saveEditDraftPosition("rec-1", "title");
    clearEditDraftPosition();
    expect(getEditDraftPosition()).toBeNull();
  });

  test("saving again overwrites the previous position", () => {
    saveEditDraftPosition("rec-1", "title");
    saveEditDraftPosition("rec-2", "tags");
    const position = getEditDraftPosition();
    expect(position?.recordId).toBe("rec-2");
    expect(position?.field).toBe("tags");
  });
});
