/**
 * V15-VISUAL-002: shared visual primitives.
 *
 * Centralised, token-backed constants so the new V15 surfaces (work-inbox
 * groups, active-filter bar, resume link) stay consistent with the existing
 * design system instead of hard-coding values. Every value maps to a CSS
 * custom property already defined in app/styles/01-base.css.
 */
export const visualPrimitive = {
  radius: {
    sm: "var(--radius-sm)",
    md: "var(--radius-md)",
  },
  space: {
    1: "var(--space-1)",
    2: "var(--space-2)",
    3: "var(--space-3)",
    4: "var(--space-4)",
    6: "var(--space-6)",
  },
  surface: {
    secondary: "var(--color-bg-secondary)",
    tertiary: "var(--color-bg-tertiary)",
  },
  text: {
    primary: "var(--color-text-primary)",
    secondary: "var(--color-text-secondary)",
    tertiary: "var(--color-text-tertiary)",
  },
  focusRing: "0 0 0 2px var(--color-focus-ring, var(--color-accent))",
} as const;

/** A single source of truth for the work-inbox group heading style. */
export const workInboxGroupHeading = {
  display: "flex",
  alignItems: "center",
  gap: visualPrimitive.space[2],
  margin: `0 0 ${visualPrimitive.space[3]}`,
  fontSize: "var(--font-size-sm)",
  fontWeight: 600,
  color: visualPrimitive.text.secondary,
} as const;
