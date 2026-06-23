/**
 * SwitchV2 — v2 design-system toggle switch primitive.
 * RTL-first with CSS logical properties, tap target ≥ 44px, ARIA switch role.
 *
 * @param {{ checked?: boolean, onChange?: (checked: boolean) => void, disabled?: boolean, label?: string, size?: 'sm'|'md', id?: string, className?: string }} props
 * @example
 * <SwitchV2
 *   checked={enabled}
 *   onChange={setEnabled}
 *   label="تفعيل الإشعارات"
 * />
 */
import * as React from "react";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

const TRACK_SIZES = {
  sm: "h-5 w-9",
  md: "h-6 w-11",
};

const THUMB_SIZES = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
};

/** Thumb translate when checked — accounts for RTL via translateX(-N) in RTL context. */
const THUMB_TRANSLATE = {
  sm: "translate-x-4",
  md: "translate-x-5",
};

export function SwitchV2({
  checked: controlledChecked,
  onChange,
  disabled = false,
  label,
  size = "md",
  id,
  className = "",
  ...rest
}) {
  const switchId = id ?? React.useId();

  // Support both controlled (checked prop) and uncontrolled usage.
  const isControlled = controlledChecked !== undefined;
  const [internalChecked, setInternalChecked] = React.useState(false);
  const checked = isControlled ? controlledChecked : internalChecked;

  function handleClick() {
    if (disabled) return;
    if (!isControlled) setInternalChecked((c) => !c);
    onChange?.(!checked);
  }

  function handleKeyDown(e) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleClick();
    }
  }

  const trackSize = TRACK_SIZES[size] ?? TRACK_SIZES.md;
  const thumbSize = THUMB_SIZES[size] ?? THUMB_SIZES.md;
  const thumbTranslate = THUMB_TRANSLATE[size] ?? THUMB_TRANSLATE.md;

  const switchEl = (
    /* Hit area: always ≥ 44px so touch targets meet WCAG 2.5.5 */
    <span className="inline-flex items-center justify-center min-h-[44px] min-w-[44px]">
      <span
        id={switchId}
        role="switch"
        tabIndex={disabled ? -1 : 0}
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cx(
          "relative inline-flex flex-shrink-0 items-center rounded-full",
          "cursor-pointer select-none",
          "transition-colors duration-[var(--va-duration-base)]",
          "focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-emerald-500/55 focus-visible:ring-offset-2",
          "focus-visible:ring-offset-[var(--va-bg,transparent)]",
          trackSize,
          checked
            ? "bg-emerald-500"
            : "bg-[var(--va-surface-2)] border border-[var(--va-border-strong)]",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
        {...rest}
      >
        {/* Thumb — logical translate direction handled by RTL context in app-overrides.css */}
        <span
          aria-hidden="true"
          className={cx(
            "absolute rounded-full bg-white shadow-sm",
            "transition-transform duration-[var(--va-duration-base)]",
            thumbSize,
            checked ? cx(thumbTranslate, "start-auto end-1") : "start-1 end-auto"
          )}
        />
      </span>
    </span>
  );

  if (!label) return switchEl;

  return (
    <label
      className={cx(
        "inline-flex items-center gap-2 cursor-pointer",
        disabled && "cursor-not-allowed opacity-50"
      )}
      htmlFor={switchId}
      onClick={(e) => {
        // Prevent double-fire; the role=switch handles the actual toggle
        e.preventDefault();
        handleClick();
      }}
    >
      {switchEl}
      <span className="text-sm text-[var(--va-text)]">{label}</span>
    </label>
  );
}

SwitchV2.displayName = "SwitchV2";
