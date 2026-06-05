import {
  useAppStore
} from "../../stores/index.js";
import {
  Keyboard,
  Search
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import {
  SHORTCUT_ACTIONS,
  SHORTCUT_DISABLED,
  getEffectiveKeyboardShortcuts
} from "../../features/settings/keyboardShortcuts.js";
import {
  createShortcutDialogItems,
  filterShortcutDialogItems,
  formatShortcutDialogValue,
  getShortcutDialogCategories,
  getShortcutDialogItemsForCategory
} from "./shortcutDialogViewModel.js";

const allShortcuts = createShortcutDialogItems(SHORTCUT_ACTIONS);

export function KeyboardShortcutsDialog({ open, onOpenChange }) {
  const { settings, updateSettings } = useAppStore();
  const [shortcutQuery, setShortcutQuery] = React.useState(settings.ui?.shortcutDialogQuery || "");

  React.useEffect(() => {
    if (open) setShortcutQuery(settings.ui?.shortcutDialogQuery || "");
  }, [open, settings.ui?.shortcutDialogQuery]);

  React.useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onOpenChange?.(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const effectiveShortcuts = React.useMemo(() => {
    return getEffectiveKeyboardShortcuts(settings);
  }, [settings]);

  const visibleShortcuts = React.useMemo(() => {
    return filterShortcutDialogItems(allShortcuts, shortcutQuery, effectiveShortcuts);
  }, [shortcutQuery, effectiveShortcuts]);

  const categories = getShortcutDialogCategories(visibleShortcuts);

  const updateShortcutQuery = (value) => {
    setShortcutQuery(value);
    updateSettings?.({ ui: { ...(settings.ui || {}), shortcutDialogQuery: value } });
  };

  if (!open) return null;

  return jsx("div", {
    className: "fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm",
    dir: "rtl",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "اختصارات لوحة المفاتيح",
    onMouseDown: (event) => {
      if (event.target === event.currentTarget) onOpenChange?.(false);
    },
    children: jsxs("section", {
      className: "w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-gray-900 text-white shadow-2xl",
      children: [
        jsxs("div", {
          className: "border-b border-white/10 p-4",
          children: [
            jsxs("div", {
              className: "flex items-center justify-between gap-3",
              children: [
                jsxs("h2", {
                  className: "flex items-center gap-2 text-base font-semibold",
                  children: [
                    jsx(Keyboard, { className: "h-5 w-5 text-emerald-400" }),
                    "اختصارات لوحة المفاتيح"
                  ]
                }),
                jsx("button", {
                  type: "button",
                  onClick: () => onOpenChange?.(false),
                  className: "rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 hover:text-white",
                  children: "إغلاق"
                })
              ]
            }),
            jsxs("div", {
              className: "relative mt-3",
              children: [
                jsx(Search, { className: "absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" }),
                jsx("input", {
                  value: shortcutQuery,
                  onChange: (event) => updateShortcutQuery(event.target.value),
                  placeholder: "ابحث في الاختصارات...",
                  className: "min-h-11 w-full rounded-xl border border-white/10 bg-gray-800/70 pr-10 pl-3 text-sm text-white outline-none transition focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10",
                  autoFocus: true
                })
              ]
            })
          ]
        }),
        jsx("div", {
          className: "max-h-[62vh] overflow-y-auto p-4",
          children: categories.length === 0 ? jsx("p", {
            className: "rounded-xl border border-white/10 bg-white/5 p-4 text-center text-sm text-gray-400",
            children: "لا توجد اختصارات مطابقة"
          }) : jsxs("div", {
            className: "space-y-4",
            children: categories.map((category) => jsxs("section", {
              children: [
                jsx("h3", { className: "mb-2 text-sm font-medium text-emerald-400", children: category }),
                jsx("div", {
                  className: "space-y-1",
                  role: "list",
                  children: getShortcutDialogItemsForCategory(SHORTCUT_ACTIONS, visibleShortcuts, category).map((shortcut) => {
                    const value = effectiveShortcuts[shortcut.id] || SHORTCUT_DISABLED;
                    const disabled = value === SHORTCUT_DISABLED;
                    return jsxs("div", {
                      className: "flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-white/5",
                      role: "listitem",
                      children: [
                        jsx("span", { className: "text-sm text-gray-300", children: shortcut.label }),
                        jsx("kbd", {
                          className: `va-mixed-token shrink-0 rounded-md border px-2 py-1 text-xs font-mono ${
                            disabled
                              ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                              : "border-white/10 bg-gray-800 text-gray-300"
                          }`,
                          children: formatShortcutDialogValue(value)
                        })
                      ]
                    }, shortcut.id);
                  })
                })
              ]
            }, category))
          })
        })
      ]
    })
  });
}

KeyboardShortcutsDialog.displayName = "KeyboardShortcutsDialog";
KeyboardShortcutsDialog.componentId = "keyboard-shortcuts-dialog";
KeyboardShortcutsDialog.migrationStatus = "native";

export default KeyboardShortcutsDialog;
