import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { X } from "lucide-react";

import { useFocusOnMount } from "./useFocusOnMount.js";

/**
 * Shared create/edit modal for entity forms (collections, vocabulary, users,
 * hierarchical tags). It is pure layout + behavior so every entity form looks
 * and behaves identically:
 *  - centered, theme-aware solid panel over a dark backdrop;
 *  - Esc and backdrop-click cancel; Enter inside a text input submits;
 *  - autofocus of the first [data-autofocus] field (via useFocusOnMount);
 *  - body scroll locked while open;
 *  - consistent footer: Cancel / (create only) "حفظ وجديد" / primary submit.
 *
 * The form component owns its state and passes the action handlers. For
 * "save & new" the form persists, then resets its own fields and the modal
 * stays open (onSubmitAndNew is only shown in create mode).
 */
export function EntityFormModal({
  title,
  icon,
  onCancel,
  onSubmit,
  onSubmitAndNew,
  onSubmitAndOpen,
  canSubmit = true,
  submitLabel = "حفظ",
  submitAndOpenLabel = "حفظ وفتح",
  isEditing = false,
  size = "lg",
  children
}) {
  const titleId = React.useId();
  const panelRef = useFocusOnMount();

  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") { event.stopPropagation(); onCancel?.(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  React.useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  const maxWidth = size === "md" ? "max-w-md" : size === "xl" ? "max-w-2xl" : "max-w-lg";

  return jsx("div", {
    className: "va-dialog-backdrop fixed inset-0 z-[2000] flex items-start justify-center overflow-y-auto p-4 py-[6vh] backdrop-blur-md",
    style: { background: "rgba(3, 7, 18, 0.72)" },
    dir: "rtl",
    onClick: (event) => { if (event.target === event.currentTarget) onCancel?.(); },
    children: jsxs("section", {
      ref: panelRef,
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": titleId,
      className: `va-surface-muted w-full ${maxWidth} rounded-2xl border p-5 text-right text-white shadow-2xl`,
      onClick: (event) => event.stopPropagation(),
      onKeyDown: (event) => {
        if (event.key === "Enter" && !event.shiftKey && event.target?.tagName === "INPUT" && canSubmit) {
          event.preventDefault();
          onSubmit?.();
        }
      },
      children: [
        jsxs("div", {
          className: "mb-4 flex items-center justify-between gap-3",
          children: [
            jsxs("h2", {
              id: titleId,
              className: "flex items-center gap-2.5 text-base font-bold text-white",
              children: [
                icon ? jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300", children: icon }) : null,
                jsx("span", { children: title })
              ]
            }),
            jsx("button", {
              type: "button",
              onClick: onCancel,
              "aria-label": "إغلاق",
              title: "إغلاق (Esc)",
              className: "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white",
              children: jsx(X, { className: "h-4 w-4" })
            })
          ]
        }),
        jsx("div", { children }),
        jsxs("div", {
          className: "mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-4",
          children: [
            jsx("button", {
              type: "button",
              onClick: onCancel,
              className: "rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5",
              children: "إلغاء"
            }),
            (!isEditing && onSubmitAndNew) ? jsx("button", {
              type: "button",
              onClick: onSubmitAndNew,
              disabled: !canSubmit,
              title: "حفظ هذا العنصر وبدء إنشاء عنصر جديد مباشرة",
              className: "va-secondary-button inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40",
              children: "حفظ وجديد"
            }) : null,
            (!isEditing && onSubmitAndOpen) ? jsx("button", {
              type: "button",
              onClick: onSubmitAndOpen,
              disabled: !canSubmit,
              title: "حفظ هذا العنصر ثم فتح صفحته المناسبة",
              className: "va-secondary-button inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold text-gray-100 disabled:cursor-not-allowed disabled:opacity-40",
              children: submitAndOpenLabel
            }) : null,
            jsx("button", {
              type: "button",
              onClick: onSubmit,
              disabled: !canSubmit,
              className: "va-primary-button rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40",
              children: submitLabel
            })
          ]
        })
      ]
    })
  });
}

export default EntityFormModal;
