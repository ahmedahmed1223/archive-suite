import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from "react";
import { Search, X, ChevronRight } from "lucide-react";
import { searchSettings, SETTINGS_CATEGORY_LABELS } from "../../features/settings/settingsRegistry.js";

/**
 * Live settings search bar.
 * Clicking a result calls onSelectEntry(entry) — the hub uses entry.tab
 * to navigate to the correct SettingsPage tab.
 *
 * @param {{ onSelectEntry: (entry: object) => void, autoFocus?: boolean }} props
 */
export function SettingsSearch({ onSelectEntry, autoFocus = false }) {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState([]);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function handleChange(e) {
    const q = e.target.value;
    setQuery(q);
    setResults(q.trim().length >= 1 ? searchSettings(q) : []);
  }

  function handleClear() {
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  }

  function handleSelect(entry) {
    setQuery("");
    setResults([]);
    onSelectEntry?.(entry);
  }

  const showResults = focused && results.length > 0;
  const showEmpty   = focused && query.trim().length >= 2 && results.length === 0;

  return jsx("div", {
    className: "relative w-full",
    children: jsxs("div", {
      className: "flex flex-col gap-1",
      children: [
        jsxs("label", {
          className: `flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
            focused
              ? "border-emerald-500/40 bg-emerald-500/5"
              : "border-white/10 bg-white/[0.03] hover:border-white/20"
          }`,
          children: [
            jsx(Search, { className: "h-4 w-4 shrink-0 text-gray-500" }),
            jsx("input", {
              ref: inputRef,
              type: "text",
              value: query,
              onChange: handleChange,
              onFocus: () => setFocused(true),
              onBlur: () => setTimeout(() => setFocused(false), 150),
              placeholder: "ابحث في الإعدادات… (مثال: لون، نسخ احتياطي، اختصار)",
              className: "min-w-0 flex-1 bg-transparent text-sm text-gray-200 outline-none placeholder:text-gray-600",
              dir: "auto",
            }),
            query && jsx("button", {
              type: "button",
              onClick: handleClear,
              className: "shrink-0 text-gray-600 hover:text-gray-400",
              children: jsx(X, { className: "h-3.5 w-3.5" }),
            }),
          ],
        }),

        showResults && jsx("div", {
          className: "absolute top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#111] shadow-2xl",
          children: jsx("ul", {
            className: "max-h-72 overflow-y-auto py-1",
            children: results.slice(0, 12).map((entry) => (
              jsxs("li", {
                children: [
                  jsxs("button", {
                    type: "button",
                    onClick: () => handleSelect(entry),
                    className: "flex w-full items-center gap-3 px-4 py-2.5 text-right transition-colors hover:bg-white/[0.04]",
                    children: [
                      jsxs("span", {
                        className: "min-w-0 flex-1",
                        children: [
                          jsx("span", { className: "block text-sm font-medium text-gray-200", children: entry.label }),
                          jsx("span", { className: "block truncate text-[11px] text-gray-600", children: entry.description }),
                        ],
                      }),
                      jsxs("span", {
                        className: "flex shrink-0 items-center gap-1 rounded-md border border-white/5 bg-white/[0.03] px-2 py-0.5 text-[11px] text-gray-600",
                        children: [
                          SETTINGS_CATEGORY_LABELS[entry.category] || entry.category,
                          jsx(ChevronRight, { className: "h-3 w-3" }),
                        ],
                      }),
                    ],
                  }),
                ],
              }, entry.id)
            )),
          }),
        }),

        showEmpty && jsx("div", {
          className: "absolute top-full z-50 mt-2 w-full rounded-xl border border-white/10 bg-[#111] p-4 text-center text-sm text-gray-600 shadow-2xl",
          children: `لا توجد إعدادات تطابق "${query}"`,
        }),
      ],
    }),
  });
}
