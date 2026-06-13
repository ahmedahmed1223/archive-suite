/**
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useVirtualList } from "./useVirtualList.js";

const makeItems = (count) => Array.from({ length: count }, (_, index) => ({ id: index }));

function setViewportWidth(width) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width
  });
}

describe("useVirtualList", () => {
  afterEach(() => {
    setViewportWidth(1024);
  });

  it("virtualizes mobile lists over 20 items", () => {
    setViewportWidth(390);

    const { result } = renderHook(() => useVirtualList({ items: makeItems(21) }));

    expect(result.current.shouldVirtualize).toBe(true);
  });

  it("keeps short mobile lists unvirtualized", () => {
    setViewportWidth(390);

    const { result } = renderHook(() => useVirtualList({ items: makeItems(20) }));

    expect(result.current.shouldVirtualize).toBe(false);
  });

  it("preserves the larger desktop threshold", () => {
    setViewportWidth(1024);

    expect(renderHook(() => useVirtualList({ items: makeItems(50) })).result.current.shouldVirtualize).toBe(false);
    expect(renderHook(() => useVirtualList({ items: makeItems(51) })).result.current.shouldVirtualize).toBe(true);
  });
});
