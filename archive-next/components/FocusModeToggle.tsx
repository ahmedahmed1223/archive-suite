"use client";

import * as Icons from "lucide-react";
import { useFocusMode } from "@/lib/use-focus-mode";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function FocusModeToggle() {
  const { t } = useLocale();
  const copy = t.shell.focusMode;
  const { isFocusMode, toggleFocusMode } = useFocusMode();

  return (
    <button
      type="button"
      className="icon-action focus-mode-toggle"
      onClick={toggleFocusMode}
      aria-label={isFocusMode ? copy.deactivateAriaLabel : copy.activateAriaLabel}
      title={isFocusMode ? copy.deactivateTitle : copy.activateTitle}
      aria-pressed={isFocusMode}
    >
      {isFocusMode ? (
        <Icons.ZoomOut aria-hidden="true" size={18} strokeWidth={2} />
      ) : (
        <Icons.Maximize aria-hidden="true" size={18} strokeWidth={2} />
      )}
      <span className="focus-mode-toggle__label">{isFocusMode ? copy.exitLabel : copy.enterLabel}</span>
    </button>
  );
}
