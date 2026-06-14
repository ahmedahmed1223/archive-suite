import { describe, it, expect } from "vitest";
import { vi } from "vitest";
import {
  isTouchPointer,
  resolveTapAction,
  shouldOpenOnDoubleClick,
  buildCardActivationHandlers,
} from "./openInteraction.js";

describe("isTouchPointer", () => {
  it("treats touch and pen as touch input", () => {
    expect(isTouchPointer("touch")).toBe(true);
    expect(isTouchPointer("PEN")).toBe(true);
  });

  it("treats mouse and missing types as non-touch", () => {
    expect(isTouchPointer("mouse")).toBe(false);
    expect(isTouchPointer("")).toBe(false);
    expect(isTouchPointer(undefined)).toBe(false);
  });
});

describe("resolveTapAction", () => {
  it("opens details on a single touch tap", () => {
    expect(resolveTapAction({ pointerType: "touch" })).toBe("open");
  });

  it("selects on a single mouse click", () => {
    expect(resolveTapAction({ pointerType: "mouse" })).toBe("select");
  });

  it("toggles selection in bulk mode regardless of pointer", () => {
    expect(resolveTapAction({ pointerType: "touch", bulkMode: true })).toBe("toggle");
    expect(resolveTapAction({ pointerType: "mouse", bulkMode: true })).toBe("toggle");
  });
});

describe("shouldOpenOnDoubleClick", () => {
  it("opens on desktop double-click", () => {
    expect(shouldOpenOnDoubleClick({ pointerType: "mouse" })).toBe(true);
    expect(shouldOpenOnDoubleClick({})).toBe(true);
  });

  it("does not open-on-double-click for touch (single tap already opens)", () => {
    expect(shouldOpenOnDoubleClick({ pointerType: "touch" })).toBe(false);
  });

  it("never opens in bulk mode", () => {
    expect(shouldOpenOnDoubleClick({ pointerType: "mouse", bulkMode: true })).toBe(false);
  });
});

describe("buildCardActivationHandlers", () => {
  it("selects on mouse click and opens on mouse double-click", () => {
    const onSelect = vi.fn();
    const onOpen = vi.fn();
    const h = buildCardActivationHandlers({ onSelect, onOpen });

    h.onPointerUp({ pointerType: "mouse" });
    h.onClick();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();

    h.onDoubleClick();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("opens on a single touch tap and swallows the trailing click", () => {
    const onSelect = vi.fn();
    const onOpen = vi.fn();
    const h = buildCardActivationHandlers({ onSelect, onOpen });

    h.onPointerUp({ pointerType: "touch" });
    h.onClick(); // synthetic compatibility click after touch
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("toggles selection for every activation in bulk mode", () => {
    const onToggle = vi.fn();
    const onOpen = vi.fn();
    const h = buildCardActivationHandlers({ bulkMode: true, onToggle, onOpen });

    h.onPointerUp({ pointerType: "mouse" });
    h.onClick();
    h.onDoubleClick();
    expect(onToggle).toHaveBeenCalledTimes(2); // click + dblclick (mouse pointerup is a no-op)
    expect(onOpen).not.toHaveBeenCalled();
  });
});
