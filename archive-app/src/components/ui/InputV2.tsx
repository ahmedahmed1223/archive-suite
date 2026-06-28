import * as React from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export interface InputV2Props
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  type?: React.HTMLInputTypeAttribute;
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  error?: React.ReactNode;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  wrapperClassName?: string;
  required?: boolean;
}

const BASE_INPUT =
  "w-full bg-[var(--va-surface)] text-[var(--va-text)] " +
  "placeholder:text-[var(--va-text-muted)] text-sm " +
  "transition-colors duration-[var(--va-duration-base)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/45 " +
  "disabled:cursor-not-allowed disabled:opacity-55 " +
  "h-10";

function InputV2Base(
  {
    id,
    type = "text",
    label,
    helperText,
    error,
    prefix = null,
    suffix = null,
    required = false,
    className = "",
    wrapperClassName = "",
    ...rest
  }: InputV2Props,
  ref: React.ForwardedRef<HTMLInputElement>
) {
  const inputId = id ?? React.useId();
  const helpId = helperText || error ? `${inputId}-help` : undefined;
  const hasError = Boolean(error);

  const borderClass = hasError
    ? "border-[var(--va-status-danger)] focus-visible:ring-rose-500/45"
    : "border-[var(--va-border-strong)] focus-visible:border-emerald-500/60";

  const hasSide = Boolean(prefix || suffix);

  return (
    <div dir="rtl" className={cx("flex flex-col gap-1.5", wrapperClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-[var(--va-text-2)]"
        >
          {label}
          {required && (
            <span aria-hidden="true" className="me-1 text-[var(--va-status-danger)]">
              *
            </span>
          )}
        </label>
      )}

      <div className={cx("relative flex items-center", hasSide && "gap-0")}>
        {prefix && (
          <span
            aria-hidden="true"
            className={cx(
              "absolute end-3 flex items-center text-[var(--va-text-muted)]",
              "pointer-events-none select-none"
            )}
          >
            {prefix}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          required={required}
          aria-invalid={hasError || undefined}
          aria-describedby={helpId}
          className={cx(
            BASE_INPUT,
            borderClass,
            "rounded-[var(--va-radius-md)] border px-3",
            Boolean(prefix) && "pe-9",
            Boolean(suffix) && "ps-9",
            className
          )}
          {...rest}
        />

        {suffix && (
          <span
            aria-hidden="true"
            className={cx(
              "absolute start-3 flex items-center text-[var(--va-text-muted)]",
              "pointer-events-none select-none"
            )}
          >
            {suffix}
          </span>
        )}
      </div>

      {(error || helperText) && (
        <p
          id={helpId}
          role={hasError ? "alert" : undefined}
          className={cx(
            "text-xs",
            hasError ? "text-[var(--va-status-danger)]" : "text-[var(--va-text-muted)]"
          )}
        >
          {error ?? helperText}
        </p>
      )}
    </div>
  );
}

export const InputV2 = React.forwardRef<HTMLInputElement, InputV2Props>(InputV2Base);

InputV2.displayName = "InputV2";
