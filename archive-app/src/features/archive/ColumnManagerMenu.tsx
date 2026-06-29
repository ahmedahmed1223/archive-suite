import { ArrowDown, ArrowUp, Check, Columns3, RotateCcw } from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import {
  ARCHIVE_TABLE_COLUMNS,
  getColumnMeta,
  moveColumn,
  normalizeArchiveTableColumns,
  resetArchiveTableColumns,
  toggleColumnVisibility
} from "./tableColumns.js";

export function ColumnManagerMenu({ stored, onChange }: any) {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef(null);
  const triggerRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (event: any) => {
      if ((menuRef.current as any)?.contains(event.target)) return;
      if ((triggerRef.current as any)?.contains(event.target)) return;
      setOpen(false);
    };
    const handleKey = (event: any) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const list = normalizeArchiveTableColumns(stored);
  const visibleCount = list.filter((column: any) => column.visible).length;

  const handleToggle = (columnId: any) => onChange?.(toggleColumnVisibility(list, columnId));
  const handleMove = (columnId: any, direction: any) => onChange?.(moveColumn(list, columnId, direction));
  const handleReset = () => onChange?.(resetArchiveTableColumns());

  return jsxs("div", {
    className: "relative",
    children: [
      jsxs("button", {
        ref: triggerRef,
        type: "button",
        onClick: () => setOpen((value: any) => !value),
        "aria-expanded": open,
        "aria-haspopup": "true",
        className: "inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-white/10 va-surface-muted px-2.5 py-1.5 text-xs font-medium text-gray-200 hover:bg-white/5",
        children: [
          jsx(Columns3, { className: "h-3.5 w-3.5" }),
          jsxs("span", { children: ["الأعمدة (", visibleCount, ")"] })
        ]
      }),
      open && jsxs("div", {
        ref: menuRef,
        role: "menu",
        "aria-label": "إدارة أعمدة التفاصيل",
        className: "absolute z-50 mt-2 w-72 va-surface-raised rounded-xl border p-2 text-sm shadow-xl",
        style: { insetInlineStart: 0 },
        children: [
          jsx("p", {
            className: "px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500",
            children: "إظهار وترتيب الأعمدة"
          }),
          jsx("ul", {
            className: "max-h-80 space-y-1 overflow-auto",
            children: list.map((entry: any, index: any) => {
              const meta = getColumnMeta(entry.id);
              if (!meta) return null;
              const locked = !!meta.locked;
              return jsxs("li", {
                className: "flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5",
                children: [
                  jsxs("button", {
                    type: "button",
                    onClick: () => !locked && handleToggle(entry.id),
                    disabled: locked,
                    className: "flex flex-1 items-center gap-2 text-right disabled:cursor-not-allowed",
                    "aria-label": locked ? `${meta.label} (مثبت)` : entry.visible ? `إخفاء ${meta.label}` : `إظهار ${meta.label}`,
                    children: [
                      jsx("span", {
                        className: `flex h-5 w-5 shrink-0 items-center justify-center rounded border ${entry.visible
                          ? "border-[color-mix(in_srgb,var(--va-action)_55%,transparent)] bg-[color-mix(in_srgb,var(--va-action)_25%,transparent)] text-white"
                          : "border-white/15 bg-white/[0.03]"} ${locked ? "opacity-60" : ""}`,
                        children: entry.visible ? jsx(Check, { className: "h-3 w-3" }) : null
                      }),
                      jsxs("span", {
                        className: "flex-1 text-xs text-gray-200",
                        children: [meta.label, locked && jsx("span", { className: "mr-1 text-[10px] text-gray-500", children: "مثبت" })]
                      })
                    ]
                  }),
                  jsxs("div", {
                    className: "flex shrink-0 gap-0.5",
                    children: [
                      jsx("button", {
                        type: "button",
                        onClick: () => handleMove(entry.id, "up"),
                        disabled: index === 0,
                        "aria-label": `نقل ${meta.label} للأعلى`,
                        className: "rounded p-0.5 text-gray-400 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30",
                        children: jsx(ArrowUp, { className: "h-3.5 w-3.5" })
                      }),
                      jsx("button", {
                        type: "button",
                        onClick: () => handleMove(entry.id, "down"),
                        disabled: index === list.length - 1,
                        "aria-label": `نقل ${meta.label} للأسفل`,
                        className: "rounded p-0.5 text-gray-400 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30",
                        children: jsx(ArrowDown, { className: "h-3.5 w-3.5" })
                      })
                    ]
                  })
                ]
              }, entry.id);
            })
          }),
          jsx("div", {
            className: "mt-2 border-t border-white/5 pt-2",
            children: jsxs("button", {
              type: "button",
              onClick: handleReset,
              className: "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-gray-300 hover:bg-white/5",
              children: [jsx(RotateCcw, { className: "h-3 w-3" }), "إعادة للافتراضي"]
            })
          })
        ]
      })
    ]
  });
}

export default ColumnManagerMenu;
