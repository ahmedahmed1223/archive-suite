// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { addToQueue, clearQueue, isInQueue, listQueue, moveInQueue, removeFromQueue, toggleQueue } from "./personal-queue";

describe("personal processing queue (V1-862)", () => {
  beforeEach(() => window.localStorage.clear());

  it("adds a record to the queue", () => {
    addToQueue("r1", { title: "مادة 1", type: "video" });

    expect(isInQueue("r1")).toBe(true);
    expect(listQueue()).toHaveLength(1);
    expect(listQueue()[0].title).toBe("مادة 1");
  });

  it("re-adding the same record replaces the previous entry instead of duplicating", () => {
    addToQueue("r1", { title: "قديم" });
    addToQueue("r1", { title: "جديد" });

    expect(listQueue()).toHaveLength(1);
    expect(listQueue()[0].title).toBe("جديد");
  });

  it("removes a record from the queue", () => {
    addToQueue("r1");
    removeFromQueue("r1");

    expect(isInQueue("r1")).toBe(false);
    expect(listQueue()).toHaveLength(0);
  });

  it("toggle adds when absent and removes when present", () => {
    expect(toggleQueue("r1", { title: "مادة 1" })).toBe(true);
    expect(isInQueue("r1")).toBe(true);

    expect(toggleQueue("r1")).toBe(false);
    expect(isInQueue("r1")).toBe(false);
  });

  it("clears the whole queue", () => {
    addToQueue("r1");
    addToQueue("r2");
    clearQueue();

    expect(listQueue()).toHaveLength(0);
  });

  it("moves a record up and down the order", () => {
    addToQueue("r1");
    addToQueue("r2");
    addToQueue("r3");

    moveInQueue("r3", -1);
    expect(listQueue().map((entry) => entry.id)).toEqual(["r1", "r3", "r2"]);

    moveInQueue("r1", 1);
    expect(listQueue().map((entry) => entry.id)).toEqual(["r3", "r1", "r2"]);
  });

  it("does nothing when moving past either end", () => {
    addToQueue("r1");
    addToQueue("r2");

    moveInQueue("r1", -1);
    moveInQueue("r2", 1);

    expect(listQueue().map((entry) => entry.id)).toEqual(["r1", "r2"]);
  });
});
