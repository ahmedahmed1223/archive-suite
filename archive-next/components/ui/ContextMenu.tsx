"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// ponytail: no Radix context-menu primitive is installed in this workspace
// (checked package.json — only dialog/dropdown-menu/select/switch/tabs/toast/tooltip
// are present). Adding a new dependency for a 3-item menu isn't worth a lockfile
// change, so this is a minimal portal-based menu instead. Swap for
// @radix-ui/react-context-menu if the menu grows submenus/checkbox items.

export interface ContextMenuItemConfig {
  label: string;
  onSelect: () => void;
}

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface ContextMenuProps {
  position: ContextMenuPosition;
  items: ContextMenuItemConfig[];
  onClose: () => void;
}

export function ContextMenu({ position, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("contextmenu", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("blur", onClose);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("contextmenu", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  return createPortal(
    <ul
      ref={menuRef}
      role="menu"
      className="ui-context-menu"
      style={{
        position: "fixed",
        top: position.y,
        left: position.x,
        zIndex: 1000,
        listStyle: "none",
        margin: 0,
        minInlineSize: "10rem",
        border: "1px solid var(--color-border-secondary)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-2)",
        background: "var(--color-bg-secondary)",
        boxShadow: "var(--shadow-md)"
      }}
    >
      {items.map((item) => (
        <li key={item.label} role="none">
          <button
            type="button"
            role="menuitem"
            className="ui-context-menu__item"
            onClick={() => {
              item.onSelect();
              onClose();
            }}
            style={{
              display: "flex",
              inlineSize: "100%",
              border: "none",
              background: "none",
              textAlign: "start",
              font: "inherit",
              color: "var(--color-text-primary)",
              borderRadius: "var(--radius-md)",
              padding: "0.55rem 0.7rem",
              cursor: "pointer"
            }}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>,
    document.body
  );
}
