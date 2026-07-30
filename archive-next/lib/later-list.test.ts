// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { deferRecord, getLaterEntry, isDue, listDueLater, listLater, removeLater } from "./later-list";

describe("later list (V1-842)", () => {
  beforeEach(() => window.localStorage.clear());

  it("defers a record with a reason and optional review date", () => {
    deferRecord("r1", { title: "مادة 1", type: "video", reason: "بانتظار موافقة", reviewDate: "2026-08-05" });

    const entry = getLaterEntry("r1");
    expect(entry?.reason).toBe("بانتظار موافقة");
    expect(entry?.reviewDate).toBe("2026-08-05");
    expect(listLater()).toHaveLength(1);
  });

  it("re-deferring the same record replaces the previous entry", () => {
    deferRecord("r1", { reason: "سبب أول", reviewDate: null });
    deferRecord("r1", { reason: "سبب محدث", reviewDate: "2026-09-01" });

    expect(listLater()).toHaveLength(1);
    expect(getLaterEntry("r1")?.reason).toBe("سبب محدث");
  });

  it("removes a deferred record", () => {
    deferRecord("r1", { reason: "سبب", reviewDate: null });
    removeLater("r1");

    expect(getLaterEntry("r1")).toBeNull();
    expect(listLater()).toHaveLength(0);
  });

  it("an entry with no review date is due immediately", () => {
    const entry = { id: "r1", reason: "سبب", reviewDate: null, deferredAt: new Date().toISOString() };
    expect(isDue(entry)).toBe(true);
  });

  it("an entry becomes due only once its review date arrives", () => {
    const entry = { id: "r1", reason: "سبب", reviewDate: "2026-08-05", deferredAt: new Date().toISOString() };
    expect(isDue(entry, new Date("2026-08-01"))).toBe(false);
    expect(isDue(entry, new Date("2026-08-05"))).toBe(true);
    expect(isDue(entry, new Date("2026-08-10"))).toBe(true);
  });

  it("lists only due entries, future-dated ones excluded", () => {
    deferRecord("due-now", { reason: "بلا موعد", reviewDate: null });
    deferRecord("due-past", { reason: "فات موعده", reviewDate: "2026-08-01" });
    deferRecord("not-due", { reason: "لم يحن بعد", reviewDate: "2099-01-01" });

    const due = listDueLater(new Date("2026-08-05")).map((entry) => entry.id).sort();
    expect(due).toEqual(["due-now", "due-past"]);
  });
});
