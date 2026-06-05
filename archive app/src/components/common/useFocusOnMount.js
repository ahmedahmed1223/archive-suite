import * as React from "react";

/**
 * Brings a freshly-opened panel (create/edit form) into view and focuses its
 * primary field when it mounts.
 *
 * Create forms mount when the user clicks "new X", so running on mount = running
 * on open. This addresses "new sections should appear at the top": the form is
 * scrolled into view and made ready to type, instead of opening silently lower
 * on the page with focus left on <body>.
 *
 * Usage:
 *   const formRef = useFocusOnMount();
 *   return jsx("section", { ref: formRef, ... })
 * Mark the preferred field with `"data-autofocus": true`; otherwise the first
 * input/textarea/select is focused.
 *
 * Respects `prefers-reduced-motion` (jumps instead of smooth-scrolling) and
 * never throws if the element is detached.
 */
export function useFocusOnMount({ enabled = true } = {}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return undefined;

    const reduceMotion = typeof window !== "undefined"
      && window.matchMedia
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    } catch {
      // older engines: ignore
    }

    const target = el.querySelector("[data-autofocus]")
      || el.querySelector('input:not([type="hidden"]), textarea, select');
    if (!target) return undefined;

    // Defer a tick so layout/scroll settle before moving focus.
    const timer = setTimeout(() => {
      try {
        target.focus({ preventScroll: true });
      } catch {
        // ignore
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [enabled]);

  return ref;
}

export default useFocusOnMount;
