import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { jsx, jsxs } from "react/jsx-runtime";

/**
 * Theme-aware password input with a show/hide reveal icon (Eye / EyeOff).
 *
 * Used everywhere a password is entered (first-run wizard, lock screen,
 * password setup, user form, settings) so every password field has a
 * consistent reveal affordance instead of a missing or text-only toggle.
 *
 * - Surface uses `.va-surface-deep` + the shared `--va-*` token layer, so it
 *   follows the active theme identity (v1–v4) and light/dark with the right
 *   accent — no hardcoded colors and no v2-indigo bleed under v4.
 * - The reveal button sits on the visual left, matching the input's reserved
 *   left padding (`ps-11` on the ltr input) so it never overlaps the value.
 * - The value keeps `dir="ltr"` (passwords are latin/symbol sequences) while
 *   the control still lives in the surrounding RTL layout.
 */
export function PasswordField({
  value,
  onChange,
  id,
  name,
  placeholder = "",
  autoComplete = "current-password",
  className = "",
  inputClassName = "",
  ariaLabel,
  autoFocus = false,
  onKeyDown
}) {
  const [revealed, setRevealed] = React.useState(false);
  const RevealIcon = revealed ? EyeOff : Eye;
  return jsxs("div", {
    className: `va-password-field relative ${className}`,
    children: [
      jsx("input", {
        id,
        name,
        type: revealed ? "text" : "password",
        value,
        onChange,
        onKeyDown,
        placeholder,
        autoComplete,
        autoFocus,
        dir: "ltr",
        "aria-label": ariaLabel,
        className:
          `va-surface-deep min-h-11 w-full rounded-xl border ps-11 pe-3 py-2 text-sm outline-none ` +
          `text-[color:var(--va-text-strong)] placeholder:text-[color:var(--va-text-faint)] ` +
          `focus:border-[color:var(--va-action)] ${inputClassName}`
      }),
      jsx("button", {
        type: "button",
        onClick: () => setRevealed((current) => !current),
        "aria-label": revealed ? "إخفاء كلمة المرور" : "إظهار كلمة المرور",
        "aria-pressed": revealed,
        title: revealed ? "إخفاء كلمة المرور" : "إظهار كلمة المرور",
        className:
          "absolute left-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center " +
          "rounded-lg text-[color:var(--va-text-soft)] transition-colors hover:text-[color:var(--va-text-strong)] " +
          "hover:bg-[color:var(--va-line)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--va-action)]",
        children: jsx(RevealIcon, { className: "h-4 w-4" })
      })
    ]
  });
}

export default PasswordField;
