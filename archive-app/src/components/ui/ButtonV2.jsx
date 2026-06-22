/**
 * ButtonV2 — v2 design-system primitive.
 * Token-driven, RTL-first, full keyboard a11y, min tap-target 44 px on touch.
 *
 * @param {{ variant?: 'primary'|'secondary'|'ghost'|'destructive', size?: 'sm'|'md'|'lg', leadingIcon?: React.ReactNode, trailingIcon?: React.ReactNode, loading?: boolean, disabled?: boolean }} props
 * @example
 * <ButtonV2 variant="primary" size="md" leadingIcon={<PlusIcon />} onClick={save}>
 *   حفظ
 * </ButtonV2>
 */
import * as React from "react";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

const VARIANTS = {
  primary:
    "bg-emerald-500 text-[var(--va-text-inverse)] border border-transparent " +
    "hover:bg-emerald-600 active:bg-emerald-700",
  secondary:
    "bg-[var(--va-surface)] text-[var(--va-text)] border border-[var(--va-border-strong)] " +
    "hover:bg-[var(--va-surface-2)]",
  ghost:
    "bg-transparent text-[var(--va-text-2)] border border-transparent " +
    "hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)]",
  destructive:
    "bg-[var(--va-status-danger)] text-[var(--va-text-inverse)] border border-transparent " +
    "hover:brightness-110 active:brightness-90",
};

/** min-h-9/10/11 ensures the 44 px touch target; visual height matches the scale. */
const SIZES = {
  sm: "min-h-9 h-9 px-3 text-xs gap-1.5",
  md: "min-h-10 h-10 px-4 text-sm gap-2",
  lg: "min-h-11 h-11 px-5 text-base gap-2.5",
};

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

export const ButtonV2 = React.forwardRef(function ButtonV2(
  {
    variant = "secondary",
    size = "md",
    loading = false,
    leadingIcon = null,
    trailingIcon = null,
    disabled = false,
    className = "",
    children,
    type = "button",
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex items-center justify-center rounded-[var(--va-radius-md)] font-medium",
        "transition-colors duration-[var(--va-duration-base)]",
        "focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-emerald-500/55 focus-visible:ring-offset-1",
        "focus-visible:ring-offset-[var(--va-bg,transparent)]",
        "disabled:cursor-not-allowed disabled:opacity-55",
        VARIANTS[variant] ?? VARIANTS.secondary,
        SIZES[size] ?? SIZES.md,
        className
      )}
      {...rest}
    >
      {loading ? <Spinner /> : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </button>
  );
});

ButtonV2.displayName = "ButtonV2";
