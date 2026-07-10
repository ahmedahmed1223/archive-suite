"use client";

import * as Icons from "lucide-react";
import { useFocusMode } from "@/lib/use-focus-mode";

export default function FocusModeToggle() {
  const { isFocusMode, toggleFocusMode } = useFocusMode();

  return (
    <button
      type="button"
      className="icon-action focus-mode-toggle"
      onClick={toggleFocusMode}
      aria-label={isFocusMode ? "إيقاف وضع التركيز" : "تفعيل وضع التركيز"}
      title={isFocusMode ? "إيقاف (F11)" : "تفعيل (F11)"}
      aria-pressed={isFocusMode}
    >
      {isFocusMode ? (
        <Icons.ZoomOut aria-hidden="true" size={18} strokeWidth={2} />
      ) : (
        <Icons.Maximize aria-hidden="true" size={18} strokeWidth={2} />
      )}
      <span className="focus-mode-toggle__label">{isFocusMode ? "إنهاء التركيز" : "وضع التركيز"}</span>
    </button>
  );
}
