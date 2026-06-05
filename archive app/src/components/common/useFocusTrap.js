import * as React from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']"
].join(",");

function listFocusable(container) {
  if (!container) return [];
  const nodes = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
  return nodes.filter((node) => !node.hasAttribute("aria-hidden") && node.offsetParent !== null);
}

/**
 * Trap focus inside a container while it is mounted/active.
 *
 * Usage:
 *   const ref = useRef(null);
 *   useFocusTrap(ref, open);
 *   <div ref={ref} ...>{children}</div>
 *
 * Behavior:
 * - When `active` flips to true, focuses the first focusable element
 *   inside the container (after `initialFocusRef` if provided).
 * - Tab and Shift+Tab cycle within the container; focus cannot escape
 *   while the trap is active.
 * - When `active` flips back to false, restores focus to whatever
 *   element was focused before activation.
 */
export function useFocusTrap(containerRef, active, options = {}) {
  const { initialFocusRef, restoreFocus = true } = options;
  const lastActiveElementRef = React.useRef(null);

  React.useEffect(() => {
    if (!active) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    lastActiveElementRef.current = typeof document !== "undefined" ? document.activeElement : null;

    const focusInitial = () => {
      const explicit = initialFocusRef?.current;
      if (explicit && typeof explicit.focus === "function") {
        explicit.focus();
        return;
      }
      const focusables = listFocusable(container);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else if (container.tabIndex < 0) {
        container.tabIndex = -1;
        container.focus();
      }
    };

    const animationFrame = window.requestAnimationFrame(focusInitial);

    const handleKeyDown = (event) => {
      if (event.key !== "Tab") return;
      const focusables = listFocusable(container);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const target = document.activeElement;

      if (event.shiftKey) {
        if (target === first || !container.contains(target)) {
          event.preventDefault();
          last.focus();
        }
      } else if (target === last || !container.contains(target)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("keydown", handleKeyDown);
      if (restoreFocus && lastActiveElementRef.current && typeof lastActiveElementRef.current.focus === "function") {
        try {
          lastActiveElementRef.current.focus();
        } catch {
          // Element may have unmounted; ignore.
        }
      }
    };
  }, [active, containerRef, initialFocusRef, restoreFocus]);
}
