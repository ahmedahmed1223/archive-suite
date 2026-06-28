import { useState, useRef, useEffect, useCallback } from "react";

interface VirtualListOptions<T> {
  items?: T[];
  itemHeight?: number;
  estimateSize?: number;
  overscan?: number;
  scrollKey?: string;
  containerScroll?: boolean;
}

interface VirtualListItem<T> {
  item: T;
  index: number;
  style: React.CSSProperties;
}

interface VirtualListResult<T> {
  containerRef: React.RefObject<HTMLElement | null>;
  visibleItems: Array<VirtualListItem<T>>;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
  totalSize: number;
  shouldVirtualize: boolean;
  totalCount: number;
  visibleCount: number;
}

const MOBILE_MIN_ITEMS_TO_VIRTUALIZE = 20;
const DESKTOP_MIN_ITEMS_TO_VIRTUALIZE = 50;
const MOBILE_VIEWPORT_QUERY = "(max-width: 767px)";
const DEFAULT_OVERSCAN = 5;

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia === "function") {
    return window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
  }
  return window.innerWidth <= 767;
}

export function useVirtualList<T>({
  items = [] as T[],
  itemHeight = 120,
  estimateSize,
  overscan = DEFAULT_OVERSCAN,
  scrollKey,
  containerScroll = false,
}: VirtualListOptions<T> = {}): VirtualListResult<T> {
  const rowHeight = estimateSize ?? itemHeight;
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: items.length });
  const [isMobile, setIsMobile] = useState(isMobileViewport);
  const containerRef = useRef<HTMLElement | null>(null);
  const scrollRestoredRef = useRef(false);

  const minItemsToVirtualize = isMobile ? MOBILE_MIN_ITEMS_TO_VIRTUALIZE : DESKTOP_MIN_ITEMS_TO_VIRTUALIZE;
  const shouldVirtualize = items.length > minItemsToVirtualize;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const updateViewport = () => setIsMobile(isMobileViewport());
    updateViewport();
    window.addEventListener("resize", updateViewport, { passive: true });

    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  const saveScrollPosition = useCallback(
    (scrollTop: number) => {
      if (!scrollKey || typeof sessionStorage === "undefined") return;
      try {
        sessionStorage.setItem(scrollKey, String(scrollTop));
      } catch {
        // ignore
      }
    },
    [scrollKey]
  );

  useEffect(() => {
    if (!scrollKey || !containerRef.current || scrollRestoredRef.current) return;
    if (typeof sessionStorage === "undefined") return;

    try {
      const saved = sessionStorage.getItem(scrollKey);
      if (saved !== null) {
        const offset = Number(saved);
        if (!Number.isNaN(offset) && offset > 0) {
          if (containerScroll && containerRef.current) {
            containerRef.current.scrollTop = offset;
          } else {
            window.scrollTo({ top: offset, behavior: "auto" });
          }
        }
      }
    } catch {
      // ignore
    }
    scrollRestoredRef.current = true;
  }, [scrollKey, containerScroll]);

  useEffect(() => {
    if (!shouldVirtualize || !containerRef.current) {
      setVisibleRange({ start: 0, end: items.length });
      return;
    }

    const container = containerRef.current;
    let ticking = false;

    const update = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        let scrollTop: number;
        let viewportH: number;

        if (containerScroll && container) {
          scrollTop = container.scrollTop;
          viewportH = container.clientHeight;

          const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
          const end = Math.min(items.length, Math.ceil((scrollTop + viewportH) / rowHeight) + overscan);
          setVisibleRange({ start, end });
          saveScrollPosition(scrollTop);
        } else {
          scrollTop = window.scrollY;
          viewportH = window.innerHeight;
          const containerTop = container.getBoundingClientRect().top + scrollTop;

          const start = Math.max(0, Math.floor((scrollTop - containerTop) / rowHeight) - overscan);
          const end = Math.min(
            items.length,
            Math.ceil((scrollTop - containerTop + viewportH) / rowHeight) + overscan
          );
          setVisibleRange({ start, end });
          saveScrollPosition(scrollTop);
        }

        ticking = false;
      });
    };

    update();

    const target: Window | HTMLElement = containerScroll ? (container as HTMLElement) : window;
    target.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });

    return () => {
      target.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items.length, rowHeight, overscan, shouldVirtualize, containerScroll, saveScrollPosition]);

  const totalSize = items.length * rowHeight;

  const visibleItems = shouldVirtualize
    ? items.slice(visibleRange.start, visibleRange.end).map((item, idx) => ({
        item,
        index: visibleRange.start + idx,
        style: {},
      }))
    : items.map((item, index) => ({ item, index, style: {} }));

  const topSpacerHeight = shouldVirtualize ? visibleRange.start * rowHeight : 0;
  const bottomSpacerHeight = shouldVirtualize ? (items.length - visibleRange.end) * rowHeight : 0;

  return {
    containerRef,
    visibleItems,
    topSpacerHeight,
    bottomSpacerHeight,
    totalSize,
    shouldVirtualize,
    totalCount: items.length,
    visibleCount: visibleItems.length,
  };
}
