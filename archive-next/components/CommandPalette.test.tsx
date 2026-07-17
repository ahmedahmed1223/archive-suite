// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

// cmdk measures item sizes via ResizeObserver and scrolls the active item
// into view on selection change — neither is implemented by jsdom.
beforeAll(() => {
  if (!("ResizeObserver" in window)) {
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

import CommandPalette, { openCommandPalette } from "@/components/CommandPalette";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("CommandPalette quick actions (V1-751)", () => {
  test("lists quick actions alongside navigation, not just routes", () => {
    render(<CommandPalette />);
    act(() => openCommandPalette());

    expect(screen.getByText("إجراءات سريعة")).toBeTruthy();
    expect(screen.getByText("تفعيل وضع التركيز")).toBeTruthy();
  });

  test("selecting the focus-mode action toggles it and closes the palette", () => {
    render(<CommandPalette />);
    act(() => openCommandPalette());

    fireEvent.click(screen.getByText("تفعيل وضع التركيز"));

    expect(window.localStorage.getItem("masar.focusMode")).toBe("true");
    expect(screen.queryByText("إجراءات سريعة")).toBeNull();
  });

  test("the action label flips once focus mode is already on", () => {
    window.localStorage.setItem("masar.focusMode", "true");
    render(<CommandPalette />);
    act(() => openCommandPalette());

    expect(screen.getByText("إنهاء وضع التركيز")).toBeTruthy();
  });
});
