import * as React from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonV2Props
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
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

const SIZES: Record<ButtonSize, string> = {
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

function ButtonV2Base(
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
  }: ButtonV2Props,
  ref: React.ForwardedRef<HTMLButtonElement>
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
}

export const ButtonV2 = React.forwardRef<HTMLButtonElement, ButtonV2Props>(ButtonV2Base);

ButtonV2.displayName = "ButtonV2";
