import { describe, expect, it } from "vitest";
import { visualPrimitive, workInboxGroupHeading } from "./visual-primitives";

describe("visual primitives (V15-VISUAL-002)", () => {
  it("maps every primitive to an existing design-system token", () => {
    expect(visualPrimitive.surface.secondary).toContain("var(--");
    expect(visualPrimitive.text.primary).toContain("var(--");
    expect(visualPrimitive.focusRing).toContain("var(--");
  });

  it("exposes a focus ring for keyboard users", () => {
    expect(visualPrimitive.focusRing).toMatch(/0 0 0 2px/);
  });

  it("keeps the group heading style token-backed", () => {
    expect(workInboxGroupHeading.color).toContain("var(--");
    expect(workInboxGroupHeading.display).toBe("flex");
  });
});
