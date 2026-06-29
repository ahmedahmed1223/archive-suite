import { Bookmark, BookmarkCheck, Loader2, X } from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { useAppStore } from "../../stores/index.js";

export function SaveSearchButton({ query = "", filters = {}, className = "" }: any) {
  const { savedSearches, saveSearch, deleteSavedSearch } = useAppStore();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef(null);

  const normalizedQuery = String(query || "").trim();
  const hasContent = normalizedQuery || Object.keys(filters || {}).some((k: any) => {
    const v = filters[k];
    return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
  });

  const existing = React.useMemo(
    () => savedSearches.find((s: any) => s.query === normalizedQuery),
    [savedSearches, normalizedQuery]
  );

  React.useEffect(() => {
    if (open && inputRef.current) {
      (inputRef.current as any).focus();
      setName(normalizedQuery.slice(0, 40) || "");
    }
  }, [open, normalizedQuery]);

  if (!hasContent) return null;

  if (existing) {
    return jsx("button", {
      type: "button",
      onClick: () => deleteSavedSearch(existing.id),
      title: "إزالة من المحفوظات",
      className: `inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-blue-400 hover:text-red-400 transition-colors ${className}`,
      children: [jsx(BookmarkCheck, { className: "h-4 w-4" }), "محفوظ"]
    });
  }

  if (!open) {
    return jsx("button", {
      type: "button",
      onClick: () => setOpen(true),
      title: "حفظ هذا البحث",
      className: `inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-gray-400 hover:text-white transition-colors ${className}`,
      children: [jsx(Bookmark, { className: "h-4 w-4" }), "حفظ"]
    });
  }

  async function handleSave(e: any) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await saveSearch({ name: name.trim(), query: normalizedQuery, filters });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return jsxs("form", {
    onSubmit: handleSave,
    className: `inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 ${className}`,
    children: [
      jsx("input", {
        ref: inputRef,
        type: "text",
        value: name,
        onChange: (e: any) => setName(e.target.value),
        placeholder: "اسم البحث…",
        className: "w-32 bg-transparent text-xs text-gray-100 placeholder-gray-600 focus:outline-none",
        maxLength: 60
      }),
      jsx("button", {
        type: "submit",
        disabled: saving || !name.trim(),
        className: "text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40 transition-colors",
        children: saving ? jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin" }) : "حفظ"
      }),
      jsx("button", {
        type: "button",
        onClick: () => setOpen(false),
        className: "text-gray-600 hover:text-gray-400",
        children: jsx(X, { className: "h-3.5 w-3.5" })
      })
    ]
  });
}
