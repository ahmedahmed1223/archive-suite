import * as React from "react";
import { Keyboard, X } from "lucide-react";

import { SHORTCUT_ACTIONS, getShortcutValue } from "../../features/settings/keyboardShortcuts.js";
import { markHintShown, markLearned, shouldShowHint } from "../../features/shortcuts/shortcutLearningState.js";

const AUTODISMISS_MS = 4500;

export interface ShortcutHintBubbleProps {
  actionId?: string;
  settings?: Record<string, unknown>;
  onDismiss?: () => void;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
}

function formatShortcut(key: string) {
  return key
    .split("+")
    .map((part) => {
      const p = part.trim();
      if (p.toLowerCase() === "ctrl") return "Ctrl";
      if (p.toLowerCase() === "shift") return "Shift";
      if (p.toLowerCase() === "alt") return "Alt";
      if (p.toLowerCase() === "escape") return "Esc";
      if (p.toLowerCase() === "delete") return "Del";
      if (p.length === 1) return p.toUpperCase();
      return p;
    })
    .join(" + ");
}

/**
 * ShortcutHintBubble - shows a subtle keyboard shortcut suggestion after a
 * mouse operation. Autodismisses after AUTODISMISS_MS and stops showing once
 * the user has seen it MAX_SHOWS times (tracked in shortcutLearningState).
 */
export function ShortcutHintBubble({
  actionId,
  settings = {},
  onDismiss,
  position = "bottom-right"
}: ShortcutHintBubbleProps) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (!actionId) return;
    if (!shouldShowHint(actionId)) return;
    markHintShown(actionId);
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, AUTODISMISS_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionId]);

  if (!visible) return null;

  const shortcutKey = actionId ? getShortcutValue(settings, actionId) : undefined;
  if (!shortcutKey || shortcutKey === "disabled") return null;

  const action = SHORTCUT_ACTIONS.find((a) => a.id === actionId);
  const label = action?.label ?? actionId;

  const positionClasses = {
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4"
  }[position] ?? "bottom-4 right-4";

  function dismiss() {
    setVisible(false);
    onDismiss?.();
  }

  function learnAndDismiss() {
    markLearned(actionId);
    dismiss();
  }

  return (
    <div role="status" aria-live="polite" aria-atomic="true" dir="rtl" className={`fixed z-[9999] ${positionClasses} pointer-events-auto`}>
      <div
        className={[
          "flex items-center gap-2 rounded-2xl border border-white/10 bg-gray-900/95",
          "px-3.5 py-2.5 shadow-xl backdrop-blur-sm",
          "animate-in fade-in slide-in-from-bottom-2 duration-200"
        ].join(" ")}
      >
        <Keyboard className="h-4 w-4 shrink-0 text-indigo-400" aria-hidden="true" />
        <span className="text-xs text-gray-300">
          <span className="text-gray-500">نصيحة: </span>
          {label} ←{" "}
          <kbd
            className={[
              "mx-0.5 inline-flex items-center rounded-md border border-white/20",
              "bg-white/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-white"
            ].join(" ")}
          >
            {formatShortcut(shortcutKey)}
          </kbd>
        </span>
        <button
          type="button"
          onClick={learnAndDismiss}
          aria-label="إخفاء التلميح"
          title="لن يظهر هذا التلميح مجدداً"
          className="ms-1 rounded-lg p-0.5 text-gray-500 transition-colors hover:text-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

ShortcutHintBubble.displayName = "ShortcutHintBubble";
