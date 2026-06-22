/**
 * CardV2 — v2 composable card primitive.
 * Use as <CardV2>, <CardV2.Header>, <CardV2.Body>, <CardV2.Footer>.
 * Variants: solid (default) | subtle. Token-driven border + surface only.
 *
 * @param {{ variant?: 'solid'|'subtle', className?: string, children: React.ReactNode }} props
 * @example
 * <CardV2 variant="solid">
 *   <CardV2.Header>عنوان البطاقة</CardV2.Header>
 *   <CardV2.Body>محتوى البطاقة</CardV2.Body>
 *   <CardV2.Footer><ButtonV2>إجراء</ButtonV2></CardV2.Footer>
 * </CardV2>
 */
import * as React from "react";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

const VARIANTS = {
  solid:
    "bg-[var(--va-surface)] border border-[var(--va-border-soft)] " +
    "shadow-[var(--va-elev-1,0_1px_2px_rgba(0,0,0,0.05))]",
  subtle:
    "bg-[var(--va-surface-2)] border border-transparent",
};

export function CardV2({ variant = "solid", className = "", children, ...rest }) {
  return (
    <div
      dir="rtl"
      className={cx(
        "rounded-[var(--va-radius-lg)] overflow-hidden text-[var(--va-text)]",
        VARIANTS[variant] ?? VARIANTS.solid,
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

CardV2.displayName = "CardV2";

CardV2.Header = function CardV2Header({ className = "", children, ...rest }) {
  return (
    <div
      className={cx(
        "px-[var(--va-card-padding)] pt-[var(--va-card-padding)]",
        "border-b border-[var(--va-border-soft)] pb-3",
        "text-base font-medium text-[var(--va-text)]",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
};
CardV2.Header.displayName = "CardV2.Header";

CardV2.Body = function CardV2Body({ className = "", children, ...rest }) {
  return (
    <div
      className={cx(
        "px-[var(--va-card-padding)] py-[var(--va-card-padding)]",
        "text-sm text-[var(--va-text-2)]",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
};
CardV2.Body.displayName = "CardV2.Body";

CardV2.Footer = function CardV2Footer({ className = "", children, ...rest }) {
  return (
    <div
      className={cx(
        "px-[var(--va-card-padding)] pb-[var(--va-card-padding)] pt-3",
        "border-t border-[var(--va-border-soft)]",
        "flex items-center justify-end gap-2",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
};
CardV2.Footer.displayName = "CardV2.Footer";
