import { Bookmark, BookmarkPlus, Pencil, X } from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import { appPrompt } from "../../components/common/ConfirmDialog.js";

export function SavedViewsBar({ views = [], currentFilters, canSave = false, onApply, onSave, onRemove, onRename }: any) {
  if (!views.length && !canSave) return null;

  const handleSave = async () => {
    const name = await appPrompt("اسم العرض المحفوظ:", {
      title: "حفظ تجميعة الفلاتر",
      confirmLabel: "حفظ"
    });
    if (!name || !(name as any).trim()) return;
    onSave?.((name as any).trim(), currentFilters);
  };

  const handleRename = async (view: any) => {
    const name = await appPrompt("اسم العرض الجديد:", {
      title: `إعادة تسمية "${view.name}"`,
      confirmLabel: "تحديث",
      defaultValue: view.name
    });
    if (!name || !(name as any).trim()) return;
    onRename?.(view.id, (name as any).trim());
  };

  return jsxs("div", {
    className: "flex flex-wrap items-center gap-1.5",
    role: "group",
    "aria-label": "العروض المحفوظة",
    children: [
      views.length > 0 && jsxs("span", {
        className: "inline-flex items-center gap-1 text-[11px] text-gray-500",
        children: [jsx(Bookmark, { className: "h-3 w-3" }), "عروض محفوظة:"]
      }, "saved-views-label"),
      ...views.map((view: any) => jsxs("span", {
        className: "group inline-flex items-center rounded-full border border-white/10 va-surface-subtle text-[11px]",
        children: [
          jsx("button", {
            type: "button",
            onClick: () => onApply?.(view),
            className: "rounded-e-full px-2.5 py-1 font-medium text-gray-200 transition-colors hover:bg-white/[0.06] hover:text-white",
            title: `تطبيق "${view.name}"`,
            children: view.name
          }, "apply"),
          onRename && jsx("button", {
            type: "button",
            onClick: () => handleRename(view),
            "aria-label": `إعادة تسمية عرض ${view.name}`,
            className: "px-1.5 py-1 text-gray-500 opacity-0 transition-opacity hover:bg-white/[0.06] hover:text-gray-200 focus:opacity-100 group-hover:opacity-100",
            children: jsx(Pencil, { className: "h-3 w-3" })
          }, "rename"),
          onRemove && jsx("button", {
            type: "button",
            onClick: () => onRemove?.(view.id),
            "aria-label": `حذف عرض ${view.name}`,
            className: "rounded-s-full px-1.5 py-1 text-gray-500 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-300 focus:opacity-100 group-hover:opacity-100",
            children: jsx(X, { className: "h-3 w-3" })
          }, "remove")
        ]
      }, view.id)),
      canSave && jsxs("button", {
        type: "button",
        onClick: handleSave,
        className: "inline-flex items-center gap-1 rounded-full border border-dashed border-[color-mix(in_srgb,var(--va-action)_40%,transparent)] px-2.5 py-1 text-[11px] font-medium text-[color-mix(in_srgb,var(--va-action)_70%,#ffffff)] hover:bg-[color-mix(in_srgb,var(--va-action)_10%,transparent)]",
        title: "حفظ تجميعة الفلاتر الحالية كعرض",
        children: [jsx(BookmarkPlus, { className: "h-3 w-3" }), "احفظ كعرض"]
      }, "save-current-view")
    ]
  });
}

export default SavedViewsBar;
