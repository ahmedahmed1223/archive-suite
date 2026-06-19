/**
 * Centralized framer-motion presets for the "Layered Editorial Bento" design
 * language. Single source of truth — components import from here instead of
 * redefining variants inline. Durations/easings mirror the locked motion tokens
 * in design-tokens.css (fast 120 / base 200 / slow 320ms, ease (.22,1,.36,1)).
 *
 * Consumers that animate should still gate with framer-motion's
 * `useReducedMotion()` — these presets describe the full-motion case.
 */

export const EASE_OUT = [0.22, 1, 0.36, 1];
export const EASE_EMPHASIZED = [0.16, 1, 0.3, 1];

export const DURATION = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
};

/** Page enter/exit — fade + small vertical slide. */
export const pageMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: DURATION.slow, ease: EASE_OUT },
};

/** Stagger container for lists/grids of cards. */
export const staggerContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
};

export const staggerItem = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DURATION.base, ease: EASE_OUT },
};

/** Overlay/dialog/popover fade-scale. */
export const overlayMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: DURATION.base, ease: EASE_OUT },
};

export const dialogMotion = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8, scale: 0.98 },
  transition: { duration: DURATION.base, ease: EASE_EMPHASIZED },
};

/** Drawer slide — RTL aware (drawers anchor on the inline-start edge). */
export const drawerMotion = {
  initial: { opacity: 0, x: -24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
  transition: { duration: DURATION.base, ease: EASE_OUT },
};
