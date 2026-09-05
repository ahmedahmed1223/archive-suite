"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export interface ContextPanelProps {
  title: ReactNode;
  description?: ReactNode;
  presentation?: "inline" | "drawer";
  open?: boolean;
  onDismiss?: () => void;
  dismissLabel?: string;
  children: ReactNode;
}

export function ContextPanel({
  title,
  description,
  presentation = "inline",
  open = true,
  onDismiss,
  dismissLabel,
  children
}: Readonly<ContextPanelProps>) {
  const { t } = useLocale();
  const headingId = useId();
  const resolvedDismissLabel = dismissLabel ?? t.shared.operational.closeContext;
  const panelRef = useRef<HTMLElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const wasDrawerOpenRef = useRef(false);
  const isDrawer = presentation === "drawer";

  useEffect(() => {
    if (!isDrawer) {
      wasDrawerOpenRef.current = false;
      return;
    }

    if (open && !wasDrawerOpenRef.current) {
      const activeElement = document.activeElement;
      previouslyFocusedElementRef.current = activeElement instanceof HTMLElement ? activeElement : null;
      panelRef.current?.focus();
    }

    if (!open && wasDrawerOpenRef.current) {
      const previouslyFocusedElement = previouslyFocusedElementRef.current;
      if (previouslyFocusedElement?.isConnected && !previouslyFocusedElement.matches(":disabled")) {
        previouslyFocusedElement.focus();
      }
      previouslyFocusedElementRef.current = null;
    }

    wasDrawerOpenRef.current = open;
  }, [isDrawer, open]);

  if (isDrawer && !open) return null;

  return (
    <aside
      ref={panelRef}
      className="context-panel"
      data-presentation={presentation}
      aria-labelledby={headingId}
      role={isDrawer ? "dialog" : undefined}
      tabIndex={isDrawer ? -1 : undefined}
    >
      <div className="context-panel__header">
        <div>
          <h2 id={headingId}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {isDrawer && onDismiss ? (
          <button className="button button-secondary" type="button" onClick={onDismiss} aria-label={resolvedDismissLabel}>
            {resolvedDismissLabel}
          </button>
        ) : null}
      </div>
      <div className="context-panel__content">{children}</div>
    </aside>
  );
}
