// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pathnameMock = vi.fn(() => "/archive");
vi.mock("next/navigation", () => ({ usePathname: () => pathnameMock() }));
vi.mock("@/lib/auth-session", () => ({ useAuthSession: () => ({ user: { id: "user-1" } }) }));
vi.mock("@/lib/personal-context", () => ({ isContextRecordingEnabled: () => true }));

import WorkspacePositionRestorer from "@/components/WorkspacePositionRestorer";
import { workspacePreferencesStorageKey } from "@/lib/workspace-preferences";

function setScrollY(value: number) {
  Object.defineProperty(window, "scrollY", { value, writable: true, configurable: true });
}

beforeEach(() => {
  window.localStorage.clear();
  pathnameMock.mockReturnValue("/archive");
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  setScrollY(0);
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("WorkspacePositionRestorer", () => {
  it("persists the scroll position while scrolling, not only on pagehide", () => {
    render(<WorkspacePositionRestorer />);

    setScrollY(420);
    act(() => {
      fireEvent.scroll(window);
    });

    const stored = JSON.parse(window.localStorage.getItem(workspacePreferencesStorageKey("user-1")) ?? "{}");
    expect(stored.routes["/archive"].workPosition).toBe(420);
  });

  it("restores the position saved while scrolling after a client-side navigation away and back", () => {
    render(<WorkspacePositionRestorer />);
    setScrollY(300);
    act(() => {
      fireEvent.scroll(window);
    });
    cleanup();

    const scrollToSpy = vi.fn();
    vi.stubGlobal("scrollTo", scrollToSpy);
    render(<WorkspacePositionRestorer />);

    expect(scrollToSpy).toHaveBeenCalledWith(0, 300);
  });
});
