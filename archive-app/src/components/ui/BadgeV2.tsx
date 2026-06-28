import * as React from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";
type BadgeSize = "sm" | "md";

export interface BadgeV2Props extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

const VARIANTS: Record<BadgeVariant, string> = {
  default:
    "bg-[var(--va-surface-2)] text-[var(--va-text-2)] border border-[var(--va-border-soft)]",
  success:
    "bg-[color-mix(in_srgb,var(--va-status-success)_12%,transparent)] " +
    "text-[var(--va-status-success)] " +
    "border border-[color-mix(in_srgb,var(--va-status-success)_28%,transparent)]",
  warning:
    "bg-[color-mix(in_srgb,var(--va-status-warning)_12%,transparent)] " +
    "text-[var(--va-status-warning)] " +
    "border border-[color-mix(in_srgb,var(--va-status-warning)_28%,transparent)]",
  danger:
    "bg-[color-mix(in_srgb,var(--va-status-danger)_12%,transparent)] " +
    "text-[var(--va-status-danger)] " +
    "border border-[color-mix(in_srgb,var(--va-status-danger)_28%,transparent)]",
  info:
    "bg-[color-mix(in_srgb,var(--va-status-info)_12%,transparent)] " +
    "text-[var(--va-status-info)] " +
    "border border-[color-mix(in_srgb,var(--va-status-info)_28%,transparent)]",
};

const DOT_COLORS: Record<BadgeVariant, string> = {
  default: "bg-[var(--va-text-muted)]",
  success: "bg-[var(--va-status-success)]",
  warning: "bg-[var(--va-status-warning)]",
  danger: "bg-[var(--va-status-danger)]",
  info: "bg-[var(--va-status-info)]",
};

const SIZES: Record<BadgeSize, string> = {
  sm: "h-5 px-1.5 text-[10px] gap-1",
  md: "h-6 px-2 text-xs gap-1.5",
};

const DOT_SIZES: Record<BadgeSize, string> = {
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
};

export function BadgeV2({
  variant = "default",
  size = "md",
  dot = false,
  className = "",
  children,
  ...rest
}: BadgeV2Props) {
  const v = VARIANTS[variant] ?? VARIANTS.default;
  const s = SIZES[size] ?? SIZES.md;
  const dotColor = DOT_COLORS[variant] ?? DOT_COLORS.default;
  const dotSize = DOT_SIZES[size] ?? DOT_SIZES.md;

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-[var(--va-radius-full)] font-medium whitespace-nowrap",
        v,
        s,
        className
      )}
      {...rest}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cx("flex-shrink-0 rounded-full", dotColor, dotSize)}
        />
      )}
      {children}
    </span>
  );
}

BadgeV2.displayName = "BadgeV2";
