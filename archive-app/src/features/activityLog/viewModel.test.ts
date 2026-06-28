import { describe, expect, it } from "vitest";
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_TARGET_TYPES,
  buildDiff,
  createActivityEntry,
  describeActivity,
  filterActivityEntries,
  groupActivitiesByDay
} from "./viewModel.js";

describe("buildDiff", () => {
  it("returns only changed fields with before/after pairs", () => {
    const before = { title: "قديم", tags: ["a"], views: 3 };
    const after = { title: "جديد", tags: ["a"], views: 3 };

    const diff = buildDiff(before, after);

    expect(diff).toEqual({ title: { before: "قديم", after: "جديد" } });
  });

  it("maps added and removed fields to null on the missing side", () => {
    const diff = buildDiff({ removed: 1 }, { added: 2 });
    expect(diff.removed).toEqual({ before: 1, after: null });
    expect(diff.added).toEqual({ before: null, after: 2 });
  });

  it("treats deep-equal objects as unchanged", () => {
    const diff = buildDiff({ meta: { a: 1 } }, { meta: { a: 1 } });
    expect(diff).toEqual({});
  });

  it("returns empty diff for non-object inputs", () => {
    expect(buildDiff(null, undefined)).toEqual({});
  });
});

describe("describeActivity", () => {
  it("describes an update on an item in Arabic", () => {
    const entry = createActivityEntry({
      action: ACTIVITY_ACTIONS.UPDATE,
      targetType: ACTIVITY_TARGET_TYPES.ITEM,
      targetName: "فيديو تجريبي"
    });
    expect(describeActivity(entry)).toBe("تم تعديل عنصر: فيديو تجريبي");
  });

  it("omits the name when targetName is empty", () => {
    const entry = createActivityEntry({ action: ACTIVITY_ACTIONS.DELETE, targetType: ACTIVITY_TARGET_TYPES.FOLDER });
    expect(describeActivity(entry)).toBe("تم حذف مجلد");
  });

  it("returns empty string for missing entry", () => {
    expect(describeActivity(null)).toBe("");
  });
});

describe("createActivityEntry", () => {
  it("applies safe defaults", () => {
    const entry = createActivityEntry();
    expect(entry.id).toMatch(/^activity_/);
    expect(new Date(entry.timestamp).getTime()).not.toBeNaN();
    expect(entry.userId).toBe("system");
    expect(entry.userName).toBe("النظام");
    expect(entry.action).toBe(ACTIVITY_ACTIONS.UPDATE);
    expect(entry.targetType).toBe(ACTIVITY_TARGET_TYPES.ITEM);
    expect(entry.snapshot).toEqual({ before: null, after: null, diff: null });
    expect(entry.relatedIds).toEqual([]);
    expect(entry.undoable).toBe(false);
    expect(entry.undone).toBe(false);
    expect(entry.undoneAt).toBeNull();
  });

  it("falls back to update/item for unknown action and targetType", () => {
    const entry = createActivityEntry({ action: "explode", targetType: "galaxy" } as never);
    expect(entry.action).toBe(ACTIVITY_ACTIONS.UPDATE);
    expect(entry.targetType).toBe(ACTIVITY_TARGET_TYPES.ITEM);
  });

  it("auto-builds the diff from before/after snapshots", () => {
    const entry = createActivityEntry({
      snapshot: { before: { title: "أ" }, after: { title: "ب" } } as never
    });
    expect(entry.snapshot.diff).toEqual({ title: { before: "أ", after: "ب" } });
  });
});

describe("filterActivityEntries", () => {
  const entries = [
    createActivityEntry({ action: "create", targetType: "item", targetName: "مادة أولى", userName: "أحمد" } as never),
    createActivityEntry({ action: "delete", targetType: "folder", targetName: "مجلد قديم", userName: "سارة" } as never)
  ];

  it("filters by action and targetType", () => {
    expect(filterActivityEntries(entries, { action: "create" })).toHaveLength(1);
    expect(filterActivityEntries(entries, { targetType: "folder" })).toHaveLength(1);
  });

  it("filters by free-text query against name and user", () => {
    const result = filterActivityEntries(entries, { query: "سارة" });
    expect(result).toHaveLength(1);
    expect(result[0].targetName).toBe("مجلد قديم");
  });
});

describe("groupActivitiesByDay", () => {
  it("groups entries by day, newest day first, labelling today", () => {
    const today = createActivityEntry({ timestamp: new Date().toISOString() });
    const older = createActivityEntry({ timestamp: "2020-01-05T12:00:00" });

    const groups = groupActivitiesByDay([older, today]);

    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe("اليوم");
    expect(groups[0].entries[0].id).toBe(today.id);
    expect(groups[1].date).toBe("2020-01-05");
  });
});
