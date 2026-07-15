// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const pathnameMock = vi.fn(() => "/archive");
vi.mock("next/navigation", () => ({ usePathname: () => pathnameMock() }));

import RouteProgress from "@/components/ui/RouteProgress";

function stubMatchMedia(reducedMotion: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? reducedMotion : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {}
    }))
  );
}

/** يركّب رابطًا داخليًا قابلًا للنقر لمحاكاة بدء التنقل. */
function renderWithLink() {
  const utils = render(
    <>
      <a href="/files">الملفات</a>
      <RouteProgress />
    </>
  );
  return { ...utils, link: utils.getByText("الملفات") };
}

const bar = () => document.querySelector(".ui-route-progress");

beforeEach(() => {
  vi.useFakeTimers();
  pathnameMock.mockReturnValue("/archive");
  stubMatchMedia(false);
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  cleanup();
});

describe("RouteProgress", () => {
  test("renders nothing while idle", () => {
    render(<RouteProgress />);
    expect(bar()).toBeNull();
  });

  test("shows the bar after an internal link click", () => {
    const { link } = renderWithLink();

    fireEvent.click(link);

    expect(bar()).not.toBeNull();
  });

  test("is hidden from assistive technology and is not a live region", () => {
    const { link } = renderWithLink();
    fireEvent.click(link);

    const element = bar();
    expect(element?.getAttribute("aria-hidden")).toBe("true");
    expect(element?.getAttribute("aria-live")).toBeNull();
    expect(element?.getAttribute("role")).toBeNull();
  });

  test("hides the bar once the pathname settles on the new route", () => {
    const { link, rerender } = renderWithLink();
    fireEvent.click(link);
    expect(bar()).not.toBeNull();

    pathnameMock.mockReturnValue("/files");
    rerender(
      <>
        <a href="/files">الملفات</a>
        <RouteProgress />
      </>
    );
    act(() => {
      vi.runAllTimers();
    });

    expect(bar()).toBeNull();
  });

  test("ignores external links and new-tab clicks", () => {
    render(
      <>
        <a href="https://example.com/x">خارجي</a>
        <a href="/files" target="_blank" rel="noreferrer">
          تبويب جديد
        </a>
        <RouteProgress />
      </>
    );

    fireEvent.click(document.querySelectorAll("a")[0]);
    expect(bar()).toBeNull();

    fireEvent.click(document.querySelectorAll("a")[1]);
    expect(bar()).toBeNull();
  });

  test("ignores modified clicks that do not start an in-app navigation", () => {
    const { link } = renderWithLink();

    fireEvent.click(link, { metaKey: true });

    expect(bar()).toBeNull();
  });

  test("still shows the bar when reduced motion is requested", () => {
    stubMatchMedia(true);
    const { link } = renderWithLink();

    fireEvent.click(link);

    expect(bar()).not.toBeNull();
  });
});
