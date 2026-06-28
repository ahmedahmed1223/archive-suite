// @ts-nocheck
import { describe, expect, it } from "vitest";

import {
  PRODUCT_TOUR,
  createTourStep,
  getStepIndex,
  isTourComplete,
  nextStep,
  prevStep
} from "./tourModel.js";

describe("createTourStep", () => {
  it("normalizes and defaults missing fields", () => {
    const step = createTourStep({ id: "  s1  ", title: "T", body: "B" });
    expect(step).toEqual({ id: "s1", target: null, title: "T", body: "B", page: null });
  });

  it("keeps target and page when provided", () => {
    const step = createTourStep({ id: "s1", target: "[data-tour='x']", page: "archive" });
    expect(step.target).toBe("[data-tour='x']");
    expect(step.page).toBe("archive");
  });
});

describe("PRODUCT_TOUR", () => {
  it("includes the high-value undiscovered features", () => {
    const ids = PRODUCT_TOUR.map((step) => step.id);
    expect(ids).toContain("search");
    expect(ids).toContain("htags");
    expect(ids).toContain("collections");
  });

  it("has unique step ids", () => {
    const ids = PRODUCT_TOUR.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("points every step at a real page id", () => {
    expect(PRODUCT_TOUR.every((step) => typeof step.page === "string" && step.page.length > 0)).toBe(true);
  });
});

describe("getStepIndex", () => {
  it("finds an existing step", () => {
    expect(getStepIndex(PRODUCT_TOUR, "search")).toBeGreaterThan(0);
  });

  it("returns -1 for unknown id or bad input", () => {
    expect(getStepIndex(PRODUCT_TOUR, "missing")).toBe(-1);
    expect(getStepIndex(null, "search")).toBe(-1);
  });
});

describe("nextStep / prevStep", () => {
  const steps = [
    createTourStep({ id: "a" }),
    createTourStep({ id: "b" }),
    createTourStep({ id: "c" })
  ];

  it("advances to the following step", () => {
    expect(nextStep(steps, "a").id).toBe("b");
    expect(nextStep(steps, "b").id).toBe("c");
  });

  it("returns null past the last step", () => {
    expect(nextStep(steps, "c")).toBeNull();
  });

  it("steps backward", () => {
    expect(prevStep(steps, "c").id).toBe("b");
    expect(prevStep(steps, "b").id).toBe("a");
  });

  it("returns null before the first step", () => {
    expect(prevStep(steps, "a")).toBeNull();
  });

  it("returns null for an unknown id", () => {
    expect(nextStep(steps, "zzz")).toBeNull();
    expect(prevStep(steps, "zzz")).toBeNull();
  });
});

describe("isTourComplete", () => {
  const steps = [createTourStep({ id: "a" }), createTourStep({ id: "b" })];

  it("is true only when all step ids are seen", () => {
    expect(isTourComplete(["a", "b"], steps)).toBe(true);
    expect(isTourComplete(new Set(["a", "b"]), steps)).toBe(true);
  });

  it("is false when a step is unseen", () => {
    expect(isTourComplete(["a"], steps)).toBe(false);
  });

  it("treats empty steps or seen as not complete", () => {
    expect(isTourComplete(["a"], [])).toBe(false);
    expect(isTourComplete([], steps)).toBe(false);
    expect(isTourComplete(null, steps)).toBe(false);
  });
});
