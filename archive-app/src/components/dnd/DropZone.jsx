/**
 * DropZone — wraps any content to make it an archive-items drop target (§1892).
 *
 * Props
 * -----
 *   onDrop(itemIds)   — called with string[] of archive item IDs on a successful drop.
 *   label             — accessible label for the drop region.
 *   className         — extra classes on the wrapper element.
 *   children          — content to render inside.
 *   disabled          — prevent drops when true.
 *   as                — element type to render (default "div").
 */

import * as React from "react";
import { getDragItemIds, useDndController, ARCHIVE_ITEMS_MIME } from "../../features/dnd/dndController.js";

function hasArchiveItems(event) {
  try {
    return event.dataTransfer?.types?.includes?.(ARCHIVE_ITEMS_MIME) ?? false;
  } catch {
    return false;
  }
}

export function DropZone({
  onDrop,
  label = "منطقة إفلات",
  className = "",
  children,
  disabled = false,
  as: Tag = "div",
  ...rest
}) {
  const { dragState } = useDndController() ?? {};
  const [isOver, setIsOver] = React.useState(false);

  const isActive = !disabled && (dragState?.count > 0 || isOver);

  const handleDragOver = React.useCallback((event) => {
    if (disabled || !hasArchiveItems(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setIsOver(true);
  }, [disabled]);

  const handleDragLeave = React.useCallback((event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsOver(false);
    }
  }, []);

  const handleDrop = React.useCallback((event) => {
    setIsOver(false);
    if (disabled) return;
    event.preventDefault();
    const ids = getDragItemIds(event);
    if (ids.length && onDrop) onDrop(ids);
  }, [disabled, onDrop]);

  const handleDragEnter = React.useCallback((event) => {
    if (disabled || !hasArchiveItems(event)) return;
    event.preventDefault();
    setIsOver(true);
  }, [disabled]);

  const dropClasses = isOver
    ? "ring-2 ring-inset ring-[var(--va-accent,#7c3aed)] bg-[var(--va-accent,#7c3aed)]/10 transition-all"
    : "transition-all";

  return React.createElement(
    Tag,
    {
      ...rest,
      className: `${dropClasses} ${className}`.trim(),
      onDragOver: handleDragOver,
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
      "data-drop-zone": isOver ? "active" : "idle",
      "aria-label": label,
      role: rest.role ?? "region",
    },
    isActive && isOver && dragState?.count > 1
      ? React.createElement(
          React.Fragment,
          null,
          children,
          React.createElement(
            "span",
            {
              className:
                "pointer-events-none absolute inset-0 flex items-center justify-center rounded-[inherit] text-xs font-bold text-white opacity-80",
              "aria-hidden": "true",
            },
            `إفلات ${dragState.count} عنصر`
          )
        )
      : children
  );
}

export default DropZone;
