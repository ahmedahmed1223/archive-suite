// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MOBILE_VIEWPORT_QUERY, matchesMediaQuery, useMediaQuery } from "@/lib/use-media-query";

type Listener = () => void;

/** بديل مبسّط لـ window.matchMedia يسمح بتبديل النتيجة وإطلاق حدث التغيير. */
function installMatchMedia(initialMatches: boolean) {
  const listeners = new Set<Listener>();
  let matches = initialMatches;
  const removeSpy = vi.fn();

  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches,
      media: query,
      addEventListener: (_event: string, listener: Listener) => listeners.add(listener),
      removeEventListener: (_event: string, listener: Listener) => {
        removeSpy();
        listeners.delete(listener);
      }
    }))
  );

  return {
    removeSpy,
    listenerCount: () => listeners.size,
    emit(next: boolean) {
      matches = next;
      act(() => listeners.forEach((listener) => listener()));
    }
  };
}

function Probe({ query = MOBILE_VIEWPORT_QUERY }: { query?: string }) {
  const matches = useMediaQuery(query);
  return <span data-testid="probe">{String(matches)}</span>;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("matchesMediaQuery", () => {
  test("returns the current match result", () => {
    installMatchMedia(true);
    expect(matchesMediaQuery(MOBILE_VIEWPORT_QUERY)).toBe(true);
  });

  test("returns false when matchMedia is unavailable (SSR-safe)", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(matchesMediaQuery(MOBILE_VIEWPORT_QUERY)).toBe(false);
  });
});

describe("useMediaQuery", () => {
  test("returns the initial match result", () => {
    installMatchMedia(true);
    render(<Probe />);
    expect(screen.getByTestId("probe").textContent).toBe("true");
  });

  test("re-renders when the media query result changes", () => {
    const media = installMatchMedia(false);
    render(<Probe />);
    expect(screen.getByTestId("probe").textContent).toBe("false");

    media.emit(true);

    expect(screen.getByTestId("probe").textContent).toBe("true");
  });

  test("unsubscribes the listener on unmount", () => {
    const media = installMatchMedia(false);
    const { unmount } = render(<Probe />);
    expect(media.listenerCount()).toBe(1);

    unmount();

    expect(media.removeSpy).toHaveBeenCalled();
    expect(media.listenerCount()).toBe(0);
  });

  test("does not throw when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(() => render(<Probe />)).not.toThrow();
    expect(screen.getByTestId("probe").textContent).toBe("false");
  });
});
