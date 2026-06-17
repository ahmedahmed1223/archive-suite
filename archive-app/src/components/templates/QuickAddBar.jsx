import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronDown, ChevronUp, Plus, Sparkles, X, Zap } from "lucide-react";

import { useAppStore } from "../../stores/index.js";
import { createVideoItemValue, parseVideoTags } from "../../features/videos/viewModel.js";
import { resolveDynamicFields } from "../../features/templates/viewModel.js";
import { TagAutocomplete } from "../forms/TagAutocomplete.jsx";

function buildContext(counter, lastItem) {
  return {
    counter,
    lastValues: lastItem
      ? {
          title: lastItem.title || "",
          notes: lastItem.notes || "",
          tags: Array.isArray(lastItem.tags) ? lastItem.tags.join("، ") : lastItem.tags || ""
        }
      : {}
  };
}

/**
 * QuickAddBar — sequential batch-add mode.
 * Keeps type/tags/template between submissions so the user can add dozens
 * of items rapidly without navigating away.
 *
 * @param {object} props
 * @param {object|null} [props.initialTemplate] - pre-selected template
 * @param {Array<{id:string,name:string}>} [props.contentTypes] - available content types
 * @param {string} [props.defaultTypeId] - default type id
 * @param {(count: number) => void} [props.onDone]
 * @param {() => void} [props.onClose]
 */
export function QuickAddBar({ initialTemplate = null, contentTypes = [], defaultTypeId = "", onDone, onClose }) {
  const addVideoItem = useAppStore(state => state.addVideoItem);
  const incrementTemplateUsage = useAppStore(state => state.incrementTemplateUsage);
  const showToast = useAppStore(state => state.showToast);
  const allTags = useAppStore(state => {
    const items = state.videoItems || [];
    const tagSet = new Set();
    for (const item of items) {
      const parsed = parseVideoTags(item.tags);
      for (const t of parsed) tagSet.add(t);
    }
    return [...tagSet];
  });

  const [title, setTitle] = React.useState("");
  const [typeId, setTypeId] = React.useState(defaultTypeId || contentTypes[0]?.id || "");
  const [tagsText, setTagsText] = React.useState("");
  const [template, setTemplate] = React.useState(initialTemplate);
  const [counter, setCounter] = React.useState(0);
  const [recentItems, setRecentItems] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const [showRecent, setShowRecent] = React.useState(true);

  const titleRef = React.useRef(null);

  const resolvedTitle = React.useMemo(() => {
    if (!template) return "";
    const ctx = buildContext(counter, recentItems[0] || null);
    const resolved = resolveDynamicFields(template, ctx);
    return resolved.title || "";
  }, [template, counter, recentItems]);

  React.useEffect(() => {
    if (resolvedTitle) setTitle(resolvedTitle);
  }, [resolvedTitle]);

  React.useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleAdd = async () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const tags = parseVideoTags(tagsText);
      const item = createVideoItemValue({ title: trimmed, type: typeId, tags });
      await addVideoItem?.(item);
      if (template) incrementTemplateUsage?.(template.id);
      showToast?.(`تمت إضافة «${trimmed}»`, "success");
      const newRecent = [{ title: trimmed, type: typeId, tags }, ...recentItems].slice(0, 8);
      setRecentItems(newRecent);
      setCounter(c => c + 1);
      setTitle("");
      titleRef.current?.focus();
    } catch {
      showToast?.("فشلت الإضافة — حاول مرة أخرى", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAdd(); }
    if (e.key === "Escape") onClose?.();
  };

  return jsxs("div", {
    dir: "rtl",
    className: "flex flex-col gap-3 rounded-2xl border border-emerald-500/20 bg-gray-900/90 p-4 shadow-xl backdrop-blur-sm",
    children: [
      // Header
      jsxs("div", {
        className: "flex items-center justify-between gap-2",
        children: [
          jsxs("div", {
            className: "flex items-center gap-2",
            children: [
              jsx(Zap, { className: "h-4 w-4 text-emerald-400", "aria-hidden": "true" }),
              jsx("span", { className: "text-sm font-semibold text-emerald-300", children: "وضع الإضافة السريعة" }),
              counter > 0 && jsx("span", {
                className: "rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300",
                children: `${counter} مضاف`
              })
            ]
          }),
          jsxs("div", {
            className: "flex items-center gap-1",
            children: [
              counter > 0 && jsx("button", {
                type: "button",
                onClick: () => onDone?.(counter),
                className: "rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 transition-colors",
                children: "انتهاء"
              }),
              jsx("button", {
                type: "button",
                onClick: onClose,
                "aria-label": "إغلاق وضع الإضافة السريعة",
                className: "rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors",
                children: jsx(X, { className: "h-4 w-4", "aria-hidden": "true" })
              })
            ]
          })
        ]
      }),

      // Active template badge
      template && jsxs("div", {
        className: "flex items-center gap-1.5 text-xs text-gray-400",
        children: [
          jsx(Sparkles, { className: "h-3.5 w-3.5 text-violet-400", "aria-hidden": "true" }),
          jsx("span", { children: "القالب:" }),
          jsx("span", { className: "font-medium text-violet-300", children: template.name }),
          jsx("button", {
            type: "button",
            onClick: () => { setTemplate(null); setTitle(""); },
            "aria-label": "إزالة القالب",
            className: "mr-1 rounded p-0.5 text-gray-500 hover:text-gray-200 transition-colors",
            children: jsx(X, { className: "h-3 w-3", "aria-hidden": "true" })
          })
        ]
      }),

      // Input row
      jsxs("div", {
        className: "flex flex-wrap items-center gap-2",
        children: [
          jsx("input", {
            ref: titleRef,
            type: "text",
            value: title,
            onChange: e => setTitle(e.target.value),
            onKeyDown: handleKeyDown,
            placeholder: "عنوان العنصر... (Enter للإضافة)",
            disabled: saving,
            "aria-label": "عنوان العنصر للإضافة السريعة",
            className: "input input-bordered w-full"
          }),
          contentTypes.length > 0 && jsx("select", {
            value: typeId,
            onChange: e => setTypeId(e.target.value),
            "aria-label": "نوع المحتوى",
            className: "select select-bordered w-full"
          }, contentTypes.map(ct =>
            jsx("option", { value: ct.id, children: ct.name || ct.id }, ct.id)
          )),
          jsxs("button", {
            type: "button",
            onClick: handleAdd,
            disabled: !title.trim() || saving,
            "aria-label": "إضافة عنصر",
            className: "flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95",
            children: [
              saving
                ? jsx("span", { className: "h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white", "aria-hidden": "true" })
                : jsx(Plus, { className: "h-4 w-4", "aria-hidden": "true" }),
              jsx("span", { children: saving ? "جاري..." : "إضافة" })
            ]
          })
        ]
      }),

      // Tags (compact)
      jsx(TagAutocomplete, {
        value: tagsText,
        onChange: setTagsText,
        suggestions: allTags,
        placeholder: "وسوم مشتركة (اختياري) — فصل بالفاصلة",
        className: "w-full"
      }),

      // Recent items log
      recentItems.length > 0 && jsxs("div", {
        className: "space-y-1",
        children: [
          jsxs("button", {
            type: "button",
            onClick: () => setShowRecent(v => !v),
            className: "flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors",
            children: [
              jsx("span", { children: `العناصر المضافة (${recentItems.length})` }),
              showRecent
                ? jsx(ChevronUp, { className: "h-3 w-3", "aria-hidden": "true" })
                : jsx(ChevronDown, { className: "h-3 w-3", "aria-hidden": "true" })
            ]
          }),
          jsx(AnimatePresence, {
            children: showRecent && jsx(motion.ul, {
              key: "recent",
              initial: { opacity: 0, height: 0 },
              animate: { opacity: 1, height: "auto" },
              exit: { opacity: 0, height: 0 },
              transition: { duration: 0.15 },
              className: "overflow-hidden space-y-1",
              role: "list",
              "aria-label": "العناصر المضافة للتو",
              children: recentItems.map((item, i) =>
                jsxs("li", {
                  className: "flex items-center gap-2 rounded-lg bg-gray-800/40 px-2.5 py-1.5 text-xs text-gray-300",
                  children: [
                    jsx(CheckCircle2, { className: "h-3.5 w-3.5 shrink-0 text-emerald-400", "aria-hidden": "true" }),
                    jsx("span", { className: "truncate", children: item.title })
                  ]
                }, i)
              )
            })
          })
        ]
      })
    ]
  });
}

QuickAddBar.displayName = "QuickAddBar";
