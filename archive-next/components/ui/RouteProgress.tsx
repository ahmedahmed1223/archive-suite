"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { REDUCED_MOTION_QUERY, useMediaQuery } from "@/lib/use-media-query";

/** Brief delay after a route settles so the bar does not flash on instant navigations. */
const SETTLE_MS = 180;
/** Failsafe: a cancelled navigation must not leave the bar active forever. */
const FAILSAFE_MS = 8000;

/** Start only for genuine in-app links, never external, new-tab, or download links. */
function startsInAppNavigation(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

  const target = event.target;
  const anchor = target instanceof Element ? target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  if (anchor.origin !== window.location.origin) return false;

  // Same-page anchor links are not route navigations.
  return anchor.pathname !== window.location.pathname || anchor.search !== window.location.search;
}

/**
 * A thin top progress bar between routes.
 * It is deliberately decorative (aria-hidden): the page title already announces
 * route changes, while a live-region announcement on every navigation is noisy.
 */
export default function RouteProgress() {
  const pathname = usePathname();
  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const [isActive, setIsActive] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (startsInAppNavigation(event)) setIsActive(true);
    };
    // Capture before Next so the bar appears at click time, not after navigation.
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => setIsActive(false), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (!isActive) return;
    const timer = setTimeout(() => setIsActive(false), FAILSAFE_MS);
    return () => clearTimeout(timer);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div aria-hidden="true" className="ui-route-progress">
      <motion.div
        animate={{ scaleX: 0.9 }}
        className="ui-route-progress__fill"
        initial={{ scaleX: 0.05 }}
        // ponytail: approximate, not real, progress — App Router exposes no global percentage.
        // Per-link useLinkStatus is the route to true progress if needed later.
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 2.2, ease: "easeOut" }}
      />
    </div>
  );
}
