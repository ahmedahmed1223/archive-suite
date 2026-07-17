// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";

function dispatchBeforeUnload() {
  const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
  window.dispatchEvent(event);
  return event;
}

describe("useUnsavedChangesGuard", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("does not intercept beforeunload when there are no unsaved changes", () => {
    renderHook(() => useUnsavedChangesGuard(false));

    const event = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(false);
  });

  test("intercepts beforeunload and sets returnValue when there are unsaved changes", () => {
    renderHook(() => useUnsavedChangesGuard(true));

    const event = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(true);
    // returnValue is a spec'd boolean IDL attribute (DOM `Event.returnValue`);
    // jsdom coerces any assigned value to boolean, so "" becomes false here.
    expect(event.returnValue).toBe(false);
  });

  test("stops intercepting once isDirty becomes false", () => {
    const { rerender } = renderHook(({ isDirty }) => useUnsavedChangesGuard(isDirty), {
      initialProps: { isDirty: true }
    });

    rerender({ isDirty: false });
    const event = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(false);
  });

  test("removes its listener on unmount", () => {
    const { unmount } = renderHook(() => useUnsavedChangesGuard(true));

    unmount();
    const event = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(false);
  });
});
