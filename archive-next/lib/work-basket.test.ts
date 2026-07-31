// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { addToBasket, clearBasket, isInBasket, listBasket, removeFromBasket, toggleBasket } from "./work-basket";

describe("work basket (V1-845)", () => {
  beforeEach(() => window.localStorage.clear());

  it("adds a record to the basket", () => {
    addToBasket("r1", { title: "مادة 1", type: "video" });

    expect(isInBasket("r1")).toBe(true);
    expect(listBasket()).toHaveLength(1);
    expect(listBasket()[0].title).toBe("مادة 1");
  });

  it("re-adding the same record replaces the previous entry instead of duplicating", () => {
    addToBasket("r1", { title: "قديم" });
    addToBasket("r1", { title: "جديد" });

    expect(listBasket()).toHaveLength(1);
    expect(listBasket()[0].title).toBe("جديد");
  });

  it("removes a record from the basket", () => {
    addToBasket("r1");
    removeFromBasket("r1");

    expect(isInBasket("r1")).toBe(false);
    expect(listBasket()).toHaveLength(0);
  });

  it("toggle adds when absent and removes when present", () => {
    expect(toggleBasket("r1", { title: "مادة 1" })).toBe(true);
    expect(isInBasket("r1")).toBe(true);

    expect(toggleBasket("r1")).toBe(false);
    expect(isInBasket("r1")).toBe(false);
  });

  it("clears the whole basket", () => {
    addToBasket("r1");
    addToBasket("r2");
    clearBasket();

    expect(listBasket()).toHaveLength(0);
  });
});
