import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, PenLine, X } from "lucide-react";

import { useAppStore } from "../../stores/index.js";
import { TagAutocomplete } from "../forms/TagAutocomplete.jsx";
import { parseVideoTags } from "../../features/videos/viewModel.js";
import { recordRecentTags, recordRecentType } from "../../features/workflow/recentDefaults.js";

/**
 * SideEditPanel — slide-in drawer for quick-editing an item without leaving the archive list.
 *
 * @param {object} props
 * @param {object|null} props.item - item to edit; null means panel is closed
 * @param {Array<{id:string,name:string}>} props.contentTypes
 * @param {(item: object) => Promise<void>} props.onSave
 * @param {() => void} props.onClose
 */
export function SideEditPanel({ item, contentTypes = [], onSave, onClose }) {
  const showToast = useAppStore(state => state.showToast);
  const allTags = useAppStore(state => {
    const tagSet = new Set();
    for (const v of (state.videoItems || [])) {
      for (const t of parseVideoTags(v.tags)) tagSet.add(t);
    }
    return [...tagSet];
  });

  const [title, setTitle] = React.useState("");
  const [tagsText, setTagsText] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [typeId, setTypeId] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    if (!item) return;
    setTitle(item.title || "");
    setTagsText(parseVideoTags(item.tags).join("، "));
    setNotes(item.notes || "");
    setTypeId(item.type || contentTypes[0]?.id || "");
    setDirty(false);
  }, [item?.id]);

  function markDirty() { setDirty(true); }

  async function handleSave() {
    if (!item || saving) return;
    setSaving(true);
    try {
      const tags = parseVideoTags(tagsText);
      await onSave?.({
        ...item,
        title: title.trim() || item.title,
        tags,
        notes,
        type: typeId,
        version: (item.version || 1) + 1
      });
      recordRecentType(typeId);
      recordRecentTags(tags);
      showToast?.("تم الحفظ", "success");
      setDirty(false);
      onClose?.();
    } catch {
      showToast?.("فشل الحفظ — حاول مرة أخرى", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") onClose?.();
    if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); handleSave(); }
  }

  return jsx(AnimatePresence, {
    children: item && jsxs(React.Fragment, {
      children: [
        jsx(motion.div, {
          key: "backdrop",
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.15 },
          className: "fixed inset-0 z-40 bg-black/40",
          onClick: onClose,
          "aria-hidden": "true"
        }),
        jsx(motion.aside, {
          key: "panel",
          initial: { x: "-100%" },
          animate: { x: 0 },
          exit: { x: "-100%" },
          transition: { type: "spring", damping: 28, stiffness: 300 },
          className: "fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-r border-white/10 bg-gray-900 shadow-2xl",
          dir: "rtl",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": "تعديل سريع",
          onKeyDown: handleKeyDown,
          children: jsxs("div", {
            className: "flex flex-1 flex-col overflow-hidden",
            children: [
              jsxs("header", {
                className: "flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3",
                children: [
                  jsxs("div", {
                    className: "flex items-center gap-2",
                    children: [
                      jsx(PenLine, { className: "h-4 w-4 text-indigo-400", "aria-hidden": "true" }),
                      jsx("h2", { className: "text-sm font-semibold text-white", children: "تعديل سريع" })
                    ]
                  }),
                  jsx("button", {
                    type: "button",
                    onClick: onClose,
                    "aria-label": "إغلاق لوحة التعديل",
                    className: "rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors",
                    children: jsx(X, { className: "h-4 w-4", "aria-hidden": "true" })
                  })
                ]
              }),

              jsx("div", {
                className: "flex-1 overflow-y-auto p-4",
                children: jsxs("div", {
                  className: "space-y-4",
                  children: [
                    jsxs("div", {
                      className: "space-y-1",
                      children: [
                        jsx("label", { htmlFor: "sep-title", className: "block text-xs font-medium text-gray-400", children: "العنوان" }),
                        jsx("input", {
                          id: "sep-title",
                          type: "text",
                          value: title,
                          onChange: e => { setTitle(e.target.value); markDirty(); },
                          className: "w-full rounded-xl border border-gray-700 bg-gray-800/60 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30",
                          placeholder: "عنوان العنصر"
                        })
                      ]
                    }),

                    contentTypes.length > 0 && jsxs("div", {
                      className: "space-y-1",
                      children: [
                        jsx("label", { htmlFor: "sep-type", className: "block text-xs font-medium text-gray-400", children: "نوع المحتوى" }),
                        jsx("select", {
                          id: "sep-type",
                          value: typeId,
                          onChange: e => { setTypeId(e.target.value); markDirty(); },
                          className: "w-full rounded-xl border border-gray-700 bg-gray-800/60 px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500/60",
                          children: contentTypes
                            .filter(ct => ct.status !== "archived")
                            .map(ct => jsx("option", { value: ct.id, children: ct.name || ct.id }, ct.id))
                        })
                      ]
                    }),

                    jsxs("div", {
                      className: "space-y-1",
                      children: [
                        jsx("label", { className: "block text-xs font-medium text-gray-400", children: "الوسوم" }),
                        jsx(TagAutocomplete, {
                          value: tagsText,
                          onChange: v => { setTagsText(v); markDirty(); },
                          suggestions: allTags,
                          placeholder: "وسوم — فصل بالفاصلة",
                          className: "w-full"
                        })
                      ]
                    }),

                    jsxs("div", {
                      className: "space-y-1",
                      children: [
                        jsx("label", { htmlFor: "sep-notes", className: "block text-xs font-medium text-gray-400", children: "ملاحظات" }),
                        jsx("textarea", {
                          id: "sep-notes",
                          value: notes,
                          onChange: e => { setNotes(e.target.value); markDirty(); },
                          rows: 4,
                          className: "w-full resize-none rounded-xl border border-gray-700 bg-gray-800/60 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30",
                          placeholder: "ملاحظات اختيارية..."
                        })
                      ]
                    })
                  ]
                })
              }),

              jsx("footer", {
                className: "border-t border-white/10 p-4",
                children: jsxs("div", {
                  className: "flex items-center justify-between gap-3",
                  children: [
                    jsx("p", { className: "text-xs text-gray-500", children: "Ctrl+S للحفظ · Esc للإغلاق" }),
                    jsxs("button", {
                      type: "button",
                      onClick: handleSave,
                      disabled: !dirty || saving,
                      className: "flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50",
                      children: [
                        saving
                          ? jsx(Loader2, { className: "h-4 w-4 animate-spin", "aria-hidden": "true" })
                          : jsx(Check, { className: "h-4 w-4", "aria-hidden": "true" }),
                        saving ? "جاري الحفظ..." : "حفظ"
                      ]
                    })
                  ]
                })
              })
            ]
          })
        })
      ]
    })
  });
}

SideEditPanel.displayName = "SideEditPanel";
