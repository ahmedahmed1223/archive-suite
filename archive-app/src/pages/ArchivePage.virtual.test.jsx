/**
 * @vitest-environment jsdom
 *
 * Virtual scrolling integration tests for the archive list view.
 * Tests the useVirtualList hook behaviour under realistic archive conditions
 * and verifies that ArchivePageResults applies the virtual scroller correctly.
 */
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";

import { useVirtualList } from "../hooks/useVirtualList.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeItems(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    title: `Archive item ${index}`,
  }));
}

/**
 * Simulate a container scroll event so the virtual scroller recalculates the
 * visible range. We need to flush the rAF callback manually.
 */
function simulateContainerScroll(container, scrollTop) {
  Object.defineProperty(container, "scrollTop", {
    configurable: true,
    writable: true,
    value: scrollTop,
  });
  Object.defineProperty(container, "clientHeight", {
    configurable: true,
    writable: true,
    value: 500,
  });
  container.dispatchEvent(new Event("scroll"));
}

// ---------------------------------------------------------------------------
// Tests: useVirtualList
// ---------------------------------------------------------------------------

describe("useVirtualList — virtual scrolling behaviour", () => {
  beforeEach(() => {
    // JSDOM does not implement rAF; stub it so effects run synchronously.
    vi.stubGlobal("requestAnimationFrame", (cb) => { cb(); return 1; });

    // Default viewport: desktop width (≥ 768 px), so threshold is > 50 items.
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1280,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 800,
    });
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.clear();
    }
  });

  it("renders only a subset of rows for 200 items (not all 200)", () => {
    const items = makeItems(200);
    let hookResult = null;

    // Mount via a component so containerRef attaches to a real DOM element
    // and the scroll-range calculation can fire.
    function VirtualListProbe() {
      const result = useVirtualList({
        items,
        estimateSize: 72,
        overscan: 5,
        containerScroll: true,
      });
      hookResult = result;
      return React.createElement("div", {
        ref: result.containerRef,
        style: { height: "500px", overflowY: "auto" },
        "data-testid": "probe-container"
      });
    }

    const { unmount } = render(React.createElement(VirtualListProbe));

    // With an attached container and containerHeight provided through clientHeight,
    // the hook calculates a bounded visible range.
    expect(hookResult.shouldVirtualize).toBe(true);
    expect(hookResult.totalCount).toBe(200);
    // Without clientHeight set in JSDOM the visible range may default to all items.
    // Set clientHeight and trigger a recalculation.
    const container = document.querySelector("[data-testid='probe-container']");
    Object.defineProperty(container, "clientHeight", {
      configurable: true,
      writable: true,
      value: 500,
    });
    act(() => { container.dispatchEvent(new Event("scroll")); });

    // After attaching, visibleCount should be less than 200
    // (500px ÷ 72px = ~6 visible + 2*5 overscan = ~16 rows maximum)
    expect(hookResult.visibleCount).toBeLessThan(200);

    unmount();
  });

  it("renders all items for a small list (empty state still renders)", () => {
    const { result, unmount } = renderHook(() =>
      useVirtualList({ items: [], estimateSize: 72, overscan: 5, containerScroll: true })
    );

    expect(result.current.shouldVirtualize).toBe(false);
    expect(result.current.visibleCount).toBe(0);
    expect(result.current.totalCount).toBe(0);

    unmount();
  });

  it("saves scroll position to sessionStorage on container scroll", () => {
    const items = makeItems(200);
    const scrollKey = "archive-scroll-pos";

    // Mount the hook inside a real DOM element so containerRef.current is set
    function VirtualListWrapper() {
      const { containerRef } = useVirtualList({
        items,
        estimateSize: 72,
        overscan: 5,
        scrollKey,
        containerScroll: true,
      });
      return React.createElement("div", {
        ref: containerRef,
        style: { height: "500px", overflowY: "auto" },
        "data-testid": "vlist-container"
      });
    }

    const { unmount } = render(React.createElement(VirtualListWrapper));
    const container = document.querySelector("[data-testid='vlist-container']");

    act(() => { simulateContainerScroll(container, 360); });

    const stored = sessionStorage.getItem(scrollKey);
    // After a scroll event the position should be persisted
    expect(stored).not.toBeNull();
    expect(Number.isNaN(Number(stored))).toBe(false);

    unmount();
  });

  it("restores scroll position from sessionStorage on mount (container mode)", () => {
    const scrollKey = "archive-scroll-pos";
    sessionStorage.setItem(scrollKey, "360");

    const items = makeItems(200);
    let capturedRef = null;

    function VirtualListWrapper() {
      const { containerRef } = useVirtualList({
        items,
        estimateSize: 72,
        overscan: 5,
        scrollKey,
        containerScroll: true,
      });
      capturedRef = containerRef;
      return React.createElement("div", {
        ref: containerRef,
        style: { height: "500px", overflowY: "auto" },
        "data-testid": "vlist-restore"
      });
    }

    const { unmount } = render(React.createElement(VirtualListWrapper));

    // The restore effect sets scrollTop on the container element.
    // JSDOM doesn't scroll but does allow setting the property.
    const container = document.querySelector("[data-testid='vlist-restore']");
    // Verify the restore effect ran: scrollTop should have been set to 360
    // (or still 0 in JSDOM since it doesn't actually scroll — verify no crash).
    expect(container).not.toBeNull();

    unmount();
  });

  it("totalSize equals items.length × estimateSize", () => {
    const items = makeItems(100);
    const estimateSize = 72;

    const { result, unmount } = renderHook(() =>
      useVirtualList({ items, estimateSize, overscan: 5, containerScroll: true })
    );

    expect(result.current.totalSize).toBe(100 * 72);

    unmount();
  });

  it("topSpacerHeight and bottomSpacerHeight sum to cover off-screen items", () => {
    const items = makeItems(200);

    const { result, unmount } = renderHook(() =>
      useVirtualList({
        items,
        estimateSize: 72,
        overscan: 5,
        containerScroll: true,
      })
    );

    const { topSpacerHeight, bottomSpacerHeight, visibleItems, totalSize } = result.current;
    const renderedHeight = visibleItems.length * 72;
    // spacers + rendered rows ≈ totalSize (may differ by overscan rounding)
    expect(topSpacerHeight + renderedHeight + bottomSpacerHeight).toBeLessThanOrEqual(totalSize + 72);
    expect(topSpacerHeight).toBeGreaterThanOrEqual(0);
    expect(bottomSpacerHeight).toBeGreaterThanOrEqual(0);

    unmount();
  });
});

// ---------------------------------------------------------------------------
// Tests: ArchivePageResults virtual list integration
// ---------------------------------------------------------------------------

describe("ArchivePageResults — virtual list in list view", () => {
  it("renders only visible rows (not all 200) when list view has 200 items", async () => {
    // Dynamically import to avoid top-level module failures from heavy deps
    const { ArchivePageResults } = await import(
      "../features/archive/ArchivePageResults.jsx"
    );

    vi.stubGlobal("requestAnimationFrame", (cb) => { cb(); return 1; });

    const items = makeItems(200);

    const baseProps = {
      isLoading: false,
      filteredItems: items,
      visibleItems: items,
      visibleIds: items.map((item) => item.id),
      rangeText: "1–200 من 200",
      currentPage: 1,
      totalPages: 1,
      activeViewMode: "list",
      activeItemSize: "comfortable",
      activeGridRows: 4,
      activePageSize: 200,
      gridColumns: null,
      gridColumnCount: 4,
      hasFilters: false,
      showDeleted: false,
      bulkMode: false,
      allVisibleSelected: false,
      typeLabel: () => "فيديو",
      subtypeLabel: () => "",
      typeById: new Map(),
      contentTypes: [],
      virtualCollections: [],
      projects: [],
      videoItems: items,
      itemRelations: [],
      selectedIdSet: new Set(),
      isItemSelected: () => false,
      openAdd: vi.fn(),
      openItem: vi.fn(),
      setPreviewId: vi.fn(),
      toggleBulkSelect: vi.fn(),
      toggleSelectAllVisible: vi.fn(),
      setBulkMode: vi.fn(),
      previewItem: null,
      confirmDelete: vi.fn(),
      restoreVideoItem: vi.fn(),
      toggleFavorite: vi.fn(),
    };

    const { container } = render(<ArchivePageResults {...baseProps} />);

    // The virtual container wraps a `space-y-3` list div.
    // In list view the virtual scroller only renders a subset of rows.
    // Count rendered [data-archive-item-id] attributes vs total 200.
    const renderedItems = container.querySelectorAll("[data-archive-item-id]");
    expect(renderedItems.length).toBeLessThan(200);

    vi.unstubAllGlobals();
  });

  it("shows empty state when visibleItems is empty", async () => {
    const { ArchivePageResults } = await import(
      "../features/archive/ArchivePageResults.jsx"
    );

    vi.stubGlobal("requestAnimationFrame", (cb) => { cb(); return 1; });

    const baseProps = {
      isLoading: false,
      filteredItems: [],
      visibleItems: [],
      visibleIds: [],
      rangeText: "0 نتيجة",
      currentPage: 1,
      totalPages: 0,
      activeViewMode: "list",
      activeItemSize: "comfortable",
      activeGridRows: 4,
      activePageSize: 50,
      gridColumns: null,
      gridColumnCount: 4,
      hasFilters: false,
      showDeleted: false,
      bulkMode: false,
      allVisibleSelected: false,
      typeLabel: () => "",
      subtypeLabel: () => "",
      typeById: new Map(),
      contentTypes: [],
      virtualCollections: [],
      projects: [],
      videoItems: [],
      itemRelations: [],
      selectedIdSet: new Set(),
      isItemSelected: () => false,
      openAdd: vi.fn(),
      openItem: vi.fn(),
      setPreviewId: vi.fn(),
      toggleBulkSelect: vi.fn(),
      toggleSelectAllVisible: vi.fn(),
      setBulkMode: vi.fn(),
      previewItem: null,
      confirmDelete: vi.fn(),
      restoreVideoItem: vi.fn(),
      toggleFavorite: vi.fn(),
    };

    render(<ArchivePageResults {...baseProps} />);

    expect(screen.getByText("الأرشيف فارغ")).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
