"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { formatShortcutDisplay, getAllShortcuts, getShortcut, matchesKeyEvent } from "@/lib/keyboard-shortcuts";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

export default function ShortcutsOverlay() {
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
        title="اختصارات لوحة المفاتيح"
        description="نظرة سريعة على اختصارات لوحة المفاتيح المتاحة حاليًا."
      >
        <ul className="shortcuts-overlay__list">
          {Object.entries(shortcuts).map(([key, { label, binding }]) => (
            <li key={key} className="shortcuts-overlay__item">
              <span>{label}</span>
              <kbd>{formatShortcutDisplay(binding)}</kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
