import { ArrowDownAZ, ArrowUpAZ, ArrowUpDown, Calendar, Heart, Search as SearchIcon, Tag, Trash2, X } from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

export const ARCHIVE_SORT_OPTIONS = [
  { value: "updatedAt", label: "آخر تحديث" },
  { value: "createdAt", label: "تاريخ الإنشاء" },
  { value: "title", label: "العنوان" },
  { value: "type", label: "النوع" }
];

export function ArchiveSortMenu({ sortField = "updatedAt", sortDirection = "desc", onChange }) {
  const [open, setOpen] = React.useState(false);
  const buttonRef = React.useRef(null);
  const menuRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return undefined;
    const handler = (event) => {
      if (!menuRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const escHandler = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", escHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", escHandler);
    };
  }, [open]);

  const activeOption = ARCHIVE_SORT_OPTIONS.find((option) => option.value === sortField) || ARCHIVE_SORT_OPTIONS[0];
  const DirectionIcon = sortDirection === "asc" ? ArrowUpAZ : ArrowDownAZ;

  return jsxs("div", {
    className: "relative",
    children: [
      jsxs("button", {
        ref: buttonRef,
        type: "button",
        onClick: () => setOpen((current) => !current),
        "aria-haspopup": "true",
        "aria-expanded": open,
        className: "inline-flex min-h-9 items-center gap-1.5 va-surface-muted rounded-xl border px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 hover:text-white",
        children: [
          jsx(ArrowUpDown, { className: "h-3.5 w-3.5" }),
          jsx("span", { children: "ترتيب:" }),
          jsx("strong", { className: "text-white", children: activeOption.label }),
          jsx(DirectionIcon, { className: "h-3.5 w-3.5 text-gray-500" })
        ]
      }),
      open && jsxs("div", {
        ref: menuRef,
        role: "menu",
        className: "absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-[var(--color-bg-surface,#0b1626)] p-1 shadow-2xl",
        children: [
          jsx("p", { className: "px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500", children: "ترتيب حسب" }),
          ...ARCHIVE_SORT_OPTIONS.map((option) => jsxs("button", {
            type: "button",
            role: "menuitemradio",
            "aria-checked": sortField === option.value,
            onClick: () => {
              onChange?.({ sortField: option.value, sortDirection });
              setOpen(false);
            },
            className: `flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-xs transition-colors ${sortField === option.value ? "bg-[color-mix(in_srgb,var(--va-action)_16%,transparent)] text-white" : "text-gray-300 hover:bg-white/5"}`,
            children: [
              jsx("span", { children: option.label }),
              sortField === option.value && jsx("span", { className: "text-[10px] text-[color-mix(in_srgb,var(--va-action)_70%,#ffffff)]", children: "النشط" })
            ]
          }, option.value)),
          jsx("hr", { className: "my-1 border-white/10" }),
          jsx("p", { className: "px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500", children: "الاتجاه" }),
          jsxs("div", {
            className: "flex gap-1 p-1",
            children: [
              jsxs("button", {
                type: "button",
                role: "menuitemradio",
                "aria-checked": sortDirection === "desc",
                onClick: () => onChange?.({ sortField, sortDirection: "desc" }),
                className: `flex-1 rounded-lg px-3 py-1.5 text-xs ${sortDirection === "desc" ? "bg-[color-mix(in_srgb,var(--va-action)_18%,transparent)] text-white" : "text-gray-400 hover:bg-white/5"}`,
                children: [jsx(ArrowDownAZ, { className: "mx-auto h-3.5 w-3.5" }), jsx("span", { className: "mt-0.5 block", children: "تنازلي" })]
              }),
              jsxs("button", {
                type: "button",
                role: "menuitemradio",
                "aria-checked": sortDirection === "asc",
                onClick: () => onChange?.({ sortField, sortDirection: "asc" }),
                className: `flex-1 rounded-lg px-3 py-1.5 text-xs ${sortDirection === "asc" ? "bg-[color-mix(in_srgb,var(--va-action)_18%,transparent)] text-white" : "text-gray-400 hover:bg-white/5"}`,
                children: [jsx(ArrowUpAZ, { className: "mx-auto h-3.5 w-3.5" }), jsx("span", { className: "mt-0.5 block", children: "تصاعدي" })]
              })
            ]
          })
        ]
      })
    ]
  });
}

function FilterChip({ icon, label, onRemove }) {
  return jsxs("span", {
    className: "inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--va-action)_30%,transparent)] bg-[color-mix(in_srgb,var(--va-action)_12%,transparent)] px-2.5 py-1 text-xs text-white",
    children: [
      icon && jsx("span", { className: "text-[color-mix(in_srgb,var(--va-action)_70%,#ffffff)]", children: icon }),
      jsx("span", { children: label }),
      jsx("button", {
        type: "button",
        onClick: onRemove,
        "aria-label": `إزالة فلتر ${label}`,
        className: "rounded-full p-0.5 text-gray-300 hover:bg-white/10 hover:text-white",
        children: jsx(X, { className: "h-3 w-3" })
      })
    ]
  });
}

export function ArchiveFilterChips({
  searchQuery,
  filterTypeLabel,
  filterSubtypeLabel,
  showFavoritesOnly,
  showDeleted,
  onClearSearch,
  onClearType,
  onClearSubtype,
  onClearFavorites,
  onClearDeleted,
  onResetAll
}) {
  const hasAny = !!searchQuery || !!filterTypeLabel || !!filterSubtypeLabel || showFavoritesOnly || showDeleted;
  if (!hasAny) return null;
  return jsxs("div", {
    className: "flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-gray-950/25 px-3 py-2",
    role: "region",
    "aria-label": "الفلاتر المطبقة",
    children: [
      jsx("span", { className: "text-[10px] font-semibold uppercase tracking-wide text-gray-500", children: "فلاتر:" }),
      searchQuery && jsx(FilterChip, { icon: jsx(SearchIcon, { className: "h-3 w-3" }), label: `"${searchQuery}"`, onRemove: onClearSearch }),
      filterTypeLabel && jsx(FilterChip, { icon: jsx(Tag, { className: "h-3 w-3" }), label: filterTypeLabel, onRemove: onClearType }),
      filterSubtypeLabel && jsx(FilterChip, { icon: jsx(Tag, { className: "h-3 w-3" }), label: filterSubtypeLabel, onRemove: onClearSubtype }),
      showFavoritesOnly && jsx(FilterChip, { icon: jsx(Heart, { className: "h-3 w-3" }), label: "المفضلة فقط", onRemove: onClearFavorites }),
      showDeleted && jsx(FilterChip, { icon: jsx(Trash2, { className: "h-3 w-3" }), label: "سلة المحذوفات", onRemove: onClearDeleted }),
      jsx("button", {
        type: "button",
        onClick: onResetAll,
        className: "ms-auto rounded-lg border border-white/10 px-2.5 py-1 text-xs text-gray-300 hover:bg-white/5 hover:text-white",
        children: "مسح الكل"
      })
    ]
  });
}

export default { ArchiveSortMenu, ArchiveFilterChips, ARCHIVE_SORT_OPTIONS };
