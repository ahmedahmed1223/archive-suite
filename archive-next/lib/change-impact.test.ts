import { describe, expect, it } from "vitest";
import { buildChangeImpact, countAffectedRecords } from "./change-impact";

const records = [
  { id: "one", type: "photo", tags: ["مهم", "فعالية"] },
  { id: "two", type: "document", tags: ["مهم"] },
  { id: "three", type: "photo", tags: [] }
];

describe("change impact", () => {
  it("counts only records matched by the pending change", () => {
    expect(countAffectedRecords(records, (record) => record.tags.includes("مهم"))).toBe(2);
    expect(countAffectedRecords(records, (record) => record.type === "photo")).toBe(2);
  });

  it("uses explicit destructive wording for a merge", () => {
    const impact = buildChangeImpact({ action: "merge", entity: "وسم", affectedCount: 2 });

    expect(impact.tone).toBe("danger");
    expect(impact.summary).toContain("دمج");
    expect(impact.detail).toContain("2 سجل");
    expect(impact.detail).toContain("لا يمكن التراجع");
  });

  it("marks reversible changes and explains the undo action", () => {
    const impact = buildChangeImpact({ action: "move", entity: "بطاقة", affectedCount: 1, reversible: true });

    expect(impact.tone).toBe("warning");
    expect(impact.detail).toContain("يمكن التراجع");
    expect(impact.undoLabel).toBe("تراجع");
  });

  it("keeps no-impact updates safe and quiet", () => {
    const impact = buildChangeImpact({ action: "update", entity: "وسم", affectedCount: 0 });

    expect(impact.tone).toBe("safe");
    expect(impact.detail).toContain("لن يتأثر أي سجل");
    expect(impact.undoLabel).toBeUndefined();
  });
});
