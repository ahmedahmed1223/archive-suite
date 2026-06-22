/**
 * InputV2 — v2 design-system text input primitive.
 * Supports label, helper text, error state with aria-invalid, prefix/suffix slots.
 * RTL-safe via logical CSS; token-driven colors only.
 *
 * @param {{ type?: string, label?: string, helperText?: string, error?: string, prefix?: React.ReactNode, suffix?: React.ReactNode, id?: string, required?: boolean }} props
 * @example
 * <InputV2
 *   label="البريد الإلكتروني"
 *   type="email"
 *   error="صيغة البريد غير صحيحة"
 *   prefix={<MailIcon className="h-4 w-4" />}
 * />
 */
import * as React from "react";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

const BASE_INPUT =
  "w-full bg-[var(--va-surface)] text-[var(--va-text)] " +
  "placeholder:text-[var(--va-text-muted)] text-sm " +
  "transition-colors duration-[var(--va-duration-base)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/45 " +
  "disabled:cursor-not-allowed disabled:opacity-55 " +
  "h-10";

export const InputV2 = React.forwardRef(function InputV2(
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
  },
  ref
) {
  const inputId = id ?? React.useId();
  const helpId = helperText || error ? `${inputId}-help` : undefined;
  const hasError = Boolean(error);

  const borderClass = hasError
    ? "border-[var(--va-status-danger)] focus-visible:ring-rose-500/45"
    : "border-[var(--va-border-strong)] focus-visible:border-emerald-500/60";

  const hasSide = prefix || suffix;

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
            prefix && "pe-9",
            suffix && "ps-9",
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
});

InputV2.displayName = "InputV2";
