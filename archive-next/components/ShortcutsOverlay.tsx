"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { formatShortcutDisplay, getAllShortcuts, getShortcut, isTypingTarget, matchesKeyEvent, type ShortcutKey } from "@/lib/keyboard-shortcuts";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function ShortcutsOverlay() {
  const { t } = useLocale();
  const copy = t.shared.shortcutsOverlay;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || isTypingTarget(event.target)) return;
      if (matchesKeyEvent(event, getShortcut("shortcutsHelp"))) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const shortcuts = getAllShortcuts();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="shortcuts-overlay"
        title={copy.title}
        description={copy.description}
      >
        <ul className="shortcuts-overlay__list">
          {Object.entries(shortcuts).map(([key, { binding }]) => (
            <li key={key} className="shortcuts-overlay__item">
              <span>{copy.labels[key as ShortcutKey]}</span>
              <kbd>{formatShortcutDisplay(binding)}</kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
