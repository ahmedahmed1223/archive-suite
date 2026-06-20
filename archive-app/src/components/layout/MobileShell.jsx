/**
 * MobileShell — mobile-specific layout wrapper.
 *
 * Provides:
 *   - Document-level swipe gestures for back navigation (swipeRight in RTL)
 *     and pull-to-refresh simulation (swipeDown)
 *   - BottomNav as the only mobile navigation surface
 *   - Safe-area-aware padding so content clears the dock
 *
 * Rendered inside AppRouter.jsx; BottomNav has `md:hidden` so only mobile sees it.
 *
 * Usage:
 *   <MobileShell>{children}</MobileShell>
 */
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { useAppStore } from "../../stores/index.js";
import { BottomNav } from "../navigation/BottomNav.jsx";
import { useSwipeGesture } from "../../hooks/useSwipeGesture.js";

export function MobileShell({ children }) {
  const currentPage    = useAppStore((s) => s.currentPage);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const pageHistory    = React.useRef([]);

  React.useEffect(() => {
    pageHistory.current = [...pageHistory.current, currentPage].slice(-20);
  }, [currentPage]);

  const goBack = React.useCallback(() => {
    const history = pageHistory.current;
    if (history.length < 2) return;
    const prev = history[history.length - 2];
    pageHistory.current = history.slice(0, -1);
    setCurrentPage(prev);
  }, [setCurrentPage]);

  const refresh = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent("va:mobile:refresh"));
  }, []);

  useSwipeGesture({
    onSwipeRight: goBack,
    onSwipeDown:  refresh,
  });

  return jsxs(React.Fragment, {
    children: [
      children,
      jsx(BottomNav, {}),
    ],
  });
}

export default MobileShell;
