import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import * as React from "react";
import { createPortal } from "react-dom";
import { jsx, jsxs } from "react/jsx-runtime";

import { useFocusTrap } from "./useFocusTrap.js";

/**
 * Right-click style context menu.
 *
 * Usage:
 *   const [menu, setMenu] = useState(null);
 *   <article onContextMenu={(e) => {
 *     e.preventDefault();
 *     setMenu({ x: e.clientX, y: e.clientY, items: [...] });
 *   }} />
 *   <ContextMenu menu={menu} onClose={() => setMenu(null)} />
 *
 * The `items` array can contain:
 *   { id, label, icon?, onSelect, danger?, disabled?, kbd? }
 *   { type: "separator" }
 */
export function ContextMenu({ menu, onClose }) {
  const open = !!menu;
  const prefersReducedMotion = useReducedMotion();
  const panelRef = React.useRef(null);
  useFocusTrap(panelRef, open);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });

  React.useEffect(() => {
    if (!open) return;
    // Reposition near the click but inside the viewport.
    const panel = panelRef.current;
    if (!panel) {
      setPosition({ x: menu.x, y: menu.y });
      return;
    }
    const rect = panel.getBoundingClientRect();
    const margin = 8;
    const maxX = window.innerWidth - rect.width - margin;
    const maxY = window.innerHeight - rect.height - margin;
    setPosition({
      x: Math.max(margin, Math.min(menu.x, maxX)),
      y: Math.max(margin, Math.min(menu.y, maxY))
    });
  }, [open, menu]);

  React.useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    const handleScroll = () => onClose?.();
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    jsx(AnimatePresence, {
      children: open && jsxs(motion.div, {
        key: "context-menu-overlay",
        className: "fixed inset-0 z-[9970]",
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: prefersReducedMotion ? 0 : 0.12 },
        onMouseDown: (event) => {
          if (event.target === event.currentTarget) onClose?.();
        },
        onContextMenu: (event) => {
          // Suppress nested right-clicks while open; first close, then let next click reopen.
          event.preventDefault();
          onClose?.();
        },
        dir: "rtl",
        children: [
          menu.title && jsx("p", {
            className: "sr-only",
            children: menu.title
          }),
          jsxs(motion.div, {
            ref: panelRef,
            role: "menu",
            "aria-label": menu.title || "قائمة الإجراءات",
            initial: { opacity: 0, scale: 0.96, y: prefersReducedMotion ? 0 : -2 },
            animate: { opacity: 1, scale: 1, y: 0 },
            exit: { opacity: 0, scale: 0.96 },
            transition: { duration: prefersReducedMotion ? 0 : 0.12, ease: "easeOut" },
            style: { position: "fixed", left: position.x, top: position.y, minWidth: "12rem", maxWidth: "18rem" },
            className: "va-surface-raised rounded-lg border p-1 text-sm shadow-xl",
            children: [
              menu.heading && jsx("div", {
                className: "px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500",
                children: menu.heading
              }),
              (menu.items || []).map((entry, index) => {
                if (entry?.type === "separator") {
                  return jsx("div", {
                    className: "my-1 h-px bg-white/5",
                    role: "separator"
                  }, `sep-${index}`);
                }
                if (!entry) return null;
                const disabled = !!entry.disabled;
                const Icon = entry.icon || null;
                const handleClick = () => {
                  if (disabled) return;
                  try { entry.onSelect?.(); } catch (error) { console.warn("[ContextMenu] onSelect threw", error); }
                  if (entry.keepOpen !== true) onClose?.();
                };
                return jsxs("button", {
                  type: "button",
                  role: "menuitem",
                  disabled,
                  onClick: handleClick,
                  className: `flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-right text-sm transition-colors ${entry.danger
                    ? "text-red-200 hover:bg-red-500/10 hover:text-red-100"
                    : "text-gray-200 hover:bg-white/[0.06] hover:text-white"} disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent`,
                  children: [
                    jsxs("span", {
                      className: "flex min-w-0 items-center gap-2",
                      children: [
                        Icon && jsx(Icon, { className: "h-3.5 w-3.5 shrink-0" }),
                        jsx("span", { className: "truncate", children: entry.label })
                      ]
                    }),
                    entry.kbd && jsx("span", {
                      className: "shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-gray-500",
                      dir: "ltr",
                      children: entry.kbd
                    })
                  ]
                }, entry.id || `item-${index}`);
              })
            ]
          })
        ]
      })
    }),
    document.body
  );
}

export default ContextMenu;
