import {
  useAppStore
} from "../stores/index.js";
import { EntityFormModal } from "../components/common/EntityFormModal.jsx";
import { ColorSwatchPicker } from "../components/common/ColorSwatchPicker.jsx";
import {
  Check,
  Copy,
  ExternalLink,
  FolderOpen,
  RefreshCw,
  PenLine,
  Plus,
  Search,
  Share2,
  Sparkles,
  Trash2,
  Video,
  Zap,
  BookmarkPlus
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { SavedFilterCard } from "../components/collections/SavedFilterCard.jsx";
import { motion } from "framer-motion";

import { appConfirm } from "../components/common/ConfirmDialog.js";
import { EmptyState } from "../components/common/EmptyState.jsx";
import { PageHero } from "../components/ui/V1Primitives.jsx";
import { reportError } from "../utils/errorReporting.js";
import {
  COLLECTION_COLORS,
  createVirtualCollectionValue,
  getAvailableCollectionItems,
  getCollectionSummary,
  getFilteredCollections,
  resolveCollectionItems
} from "../features/collections/viewModel.js";
import { formatDateTime, formatNumber } from "../utils/formatting.js";
import { canShare, mintShareLink } from "../features/share/shareClient.js";
import { getBackendUrl, resolveBackendChoice } from "../bootstrap/backendChoice.js";
import { getCloudToken } from "../bootstrap/cloudSession.js";


function CollectionForm({ collection, onCancel, onSave }) {
  const [name, setName] = React.useState(collection?.name || "");
  const [description, setDescription] = React.useState(collection?.description || "");
  const [icon, setIcon] = React.useState(collection?.icon || "📁");
  const [color, setColor] = React.useState(collection?.color || "#10b981");
  const iconId = React.useId();
  const nameId = React.useId();
  const descriptionId = React.useId();
  const colorGroupId = React.useId();
  const nameRef = React.useRef(null);

  const submit = async (keepOpen) => {
    if (!name.trim()) return;
    const ok = await onSave({
      ...collection,
      name,
      description,
      icon,
      color,
      type: collection?.type || "manual"
    }, { keepOpen });
    if (ok && keepOpen) {
      setName("");
      setDescription("");
      setIcon("📁");
      setColor("#10b981");
      window.requestAnimationFrame(() => nameRef.current?.focus());
    }
  };

  return jsx(EntityFormModal, {
    title: collection ? "تعديل مجموعة" : "مجموعة يدوية جديدة",
    icon: jsx(FolderOpen, { className: "h-4 w-4" }),
    onCancel,
    onSubmit: () => submit(false),
    onSubmitAndNew: () => submit(true),
    canSubmit: Boolean(name.trim()),
    submitLabel: collection ? "حفظ التعديل" : "إنشاء المجموعة",
    isEditing: Boolean(collection),
    children: jsxs("div", {
      className: "grid gap-3 md:grid-cols-[5rem_minmax(0,1fr)]",
      children: [
        jsxs("div", { className: "space-y-1 text-sm text-gray-300", children: [
          jsx("label", { htmlFor: iconId, className: "block", children: "الرمز" }),
          jsx("input", { id: iconId, value: icon, onChange: (event) => setIcon(event.target.value.slice(0, 4)), className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-center text-xl text-white outline-none focus:border-emerald-500/40" })
        ] }),
        jsxs("div", { className: "space-y-1 text-sm text-gray-300", children: [
          jsx("label", { htmlFor: nameId, className: "block", children: "اسم المجموعة" }),
          jsx("input", { id: nameId, ref: nameRef, "data-autofocus": true, value: name, onChange: (event) => setName(event.target.value), className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none focus:border-emerald-500/40", placeholder: "مثال: مقابلات مهمة" })
        ] }),
        jsxs("div", { className: "space-y-1 text-sm text-gray-300 md:col-span-2", children: [
          jsx("label", { htmlFor: descriptionId, className: "block", children: "الوصف" }),
          jsx("textarea", { id: descriptionId, value: description, onChange: (event) => setDescription(event.target.value), className: "min-h-[76px] w-full va-surface-deep rounded-xl border p-3 text-sm text-white outline-none focus:border-emerald-500/40", placeholder: "ملاحظة قصيرة عن استخدام المجموعة" })
        ] }),
        jsxs("div", { className: "space-y-1 md:col-span-2", children: [
          jsx("span", { id: colorGroupId, className: "text-sm text-gray-300", children: "اللون" }),
          jsx(ColorSwatchPicker, { value: color, onChange: setColor, presets: COLLECTION_COLORS, labelId: colorGroupId })
        ] })
      ]
    })
  });
}

function CollectionCard({ collection, itemCount, active, index, onOpen, onEdit, onDelete }) {
  const isSmart = collection.type === "smart";
  const accentColor = collection.color || "#10b981";
  return jsxs(motion.article, {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, delay: Math.min(index, 10) * 0.025 },
    onClick: onOpen,
    className: `va-entity-card cursor-pointer rounded-2xl border p-4 text-right transition-all ${active ? "va-accent-border va-accent-bg-soft" : "border-white/10 bg-gray-900/45 hover:border-white/20"}`,
    style: { boxShadow: `inset -3px 0 0 0 ${accentColor}${active ? "88" : "44"}` },
    dir: "rtl",
    children: [
      jsxs("div", { className: "flex items-start justify-between gap-3", children: [
        jsxs("div", { className: "flex min-w-0 items-start gap-3", children: [
          jsx("span", {
            className: "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl",
            style: { backgroundColor: `${accentColor}22`, color: accentColor, boxShadow: `0 0 0 1px ${accentColor}30` },
            children: collection.icon || "📁"
          }),
          jsxs("div", { className: "min-w-0", children: [
            jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
              jsx("h3", { className: "truncate text-base font-bold text-white", children: collection.name || "مجموعة بدون اسم" }),
              isSmart && jsxs("span", { className: "inline-flex items-center gap-1 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-200", children: [jsx(Sparkles, { className: "h-3 w-3" }), "ذكية"] })
            ] }),
            collection.description && jsx("p", { className: "mt-1 line-clamp-2 text-sm leading-relaxed text-gray-500", children: collection.description }),
            jsxs("span", {
              className: "mt-2.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
              style: { borderColor: `${accentColor}30`, backgroundColor: `${accentColor}12`, color: accentColor },
              children: [jsx(Video, { className: "h-3 w-3 opacity-70" }), `${formatNumber(itemCount)} عنصر`]
            })
          ] })
        ] }),
        jsxs("div", { className: "flex shrink-0 gap-1", onClick: (event) => event.stopPropagation(), children: [
          jsx("button", { type: "button", onClick: onEdit, className: "rounded-lg p-2 text-gray-500 hover:bg-white/5 hover:text-white", "aria-label": `تعديل ${collection.name}`, children: jsx(PenLine, { className: "h-4 w-4" }) }),
          jsx("button", { type: "button", onClick: onDelete, className: "rounded-lg p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-300", "aria-label": `حذف ${collection.name}`, children: jsx(Trash2, { className: "h-4 w-4" }) })
        ] })
      ] }),
      collection.updatedAt && jsx("p", { className: "mt-3 text-xs text-gray-700", children: `آخر تحديث: ${formatDateTime(collection.updatedAt)}` })
    ]
  }, collection.id);
}

function CollectionAddPicker({ availableItems, typeLabel, onAddItems }) {
  const [selectedIds, setSelectedIds] = React.useState([]);
  const [addQuery, setAddQuery] = React.useState("");

  const normalized = addQuery.trim().toLowerCase();
  const filteredAvailable = normalized
    ? availableItems.filter((item) => (item.title || "").toLowerCase().includes(normalized))
    : availableItems;
  const filteredIds = filteredAvailable.map((item) => item.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));

  const toggle = (id) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelectedIds(allFilteredSelected
    ? selectedIds.filter((id) => !filteredIds.includes(id))
    : Array.from(new Set([...selectedIds, ...filteredIds])));
  const handleAdd = async () => {
    if (selectedIds.length === 0) return;
    await onAddItems(selectedIds);
    setSelectedIds([]);
    setAddQuery("");
  };

  return jsxs("div", {
    className: "va-surface-muted space-y-2 rounded-xl border p-3",
    children: [
      jsxs("div", { className: "flex items-center justify-between gap-2", children: [
        jsx("p", { className: "text-sm font-semibold text-gray-300", children: "إضافة عناصر" }),
        jsx("span", { className: "text-xs text-gray-500", children: `${formatNumber(filteredAvailable.length)} متاح` })
      ] }),
      jsxs("div", { className: "relative", children: [
        jsx(Search, { className: "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" }),
        jsx("input", { value: addQuery, onChange: (event) => setAddQuery(event.target.value), placeholder: "ابحث عن عنصر لإضافته...", "aria-label": "بحث عن عنصر لإضافته", className: "min-h-10 w-full va-surface-deep rounded-lg border py-2 pl-3 pr-9 text-sm text-white outline-none placeholder:text-gray-600 focus:border-emerald-500/40" })
      ] }),
      jsx("div", {
        role: "listbox",
        "aria-multiselectable": true,
        "aria-label": "العناصر المتاحة للإضافة",
        className: "max-h-48 space-y-1 overflow-y-auto pr-0.5",
        children: filteredAvailable.length ? filteredAvailable.slice(0, 250).map((item) => {
          const checked = selectedIds.includes(item.id);
          const label = typeLabel?.(item);
          return jsxs("button", {
            type: "button",
            role: "option",
            "aria-selected": checked,
            onClick: () => toggle(item.id),
            className: `flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-right text-sm transition-colors ${checked ? "va-accent-border va-accent-bg-soft text-white" : "border-white/10 text-gray-300 hover:border-white/25 hover:bg-white/5"}`,
            children: [
              jsx("span", { className: `flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "va-accent-border va-accent-bg text-white" : "border-white/25"}`, children: checked ? jsx(Check, { className: "h-3 w-3" }) : null }),
              jsx("span", { className: "min-w-0 flex-1 truncate", dir: "auto", children: item.title || item.id }),
              label ? jsx("span", { className: "shrink-0 text-[10px] text-gray-500", children: label }) : null
            ]
          }, item.id);
        }) : jsx("p", { className: "py-4 text-center text-xs text-gray-600", children: "لا عناصر مطابقة" })
      }),
      jsxs("div", { className: "flex items-center justify-between gap-2", children: [
        jsx("button", { type: "button", onClick: toggleSelectAll, disabled: filteredIds.length === 0, className: "text-xs text-gray-400 hover:text-white disabled:opacity-40", children: allFilteredSelected ? "إلغاء التحديد" : "تحديد الكل" }),
        jsxs("button", { type: "button", disabled: selectedIds.length === 0, onClick: handleAdd, className: "va-primary-button inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40", children: [jsx(Plus, { className: "h-3.5 w-3.5" }), `إضافة ${formatNumber(selectedIds.length)}`] })
      ] })
    ]
  });
}

function CollectionItemRow({ item, typeLabel, canManageItems, onOpen, onRemove }) {
  const label = typeLabel?.(item);
  return jsxs("div", {
    className: "group flex items-center gap-2 rounded-xl va-surface-muted border p-3 transition-colors hover:border-white/20",
    children: [
      jsxs("button", { type: "button", onClick: onOpen, title: "فتح التفاصيل", className: "min-w-0 flex-1 text-right", children: [
        jsxs("div", { className: "flex items-center gap-2", children: [
          jsx("p", { className: "truncate text-sm font-semibold text-white group-hover:text-emerald-200", dir: "auto", children: item.title || "بدون عنوان" }),
          label ? jsx("span", { className: "shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-gray-400", children: label }) : null
        ] }),
        jsx("p", { className: "mt-1 text-xs text-gray-600", children: item.updatedAt ? formatDateTime(item.updatedAt) : "بدون تاريخ" })
      ] }),
      jsx("button", { type: "button", onClick: onOpen, "aria-label": `فتح ${item.title || "العنصر"}`, title: "فتح", className: "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white", children: jsx(ExternalLink, { className: "h-4 w-4" }) }),
      canManageItems ? jsx("button", { type: "button", onClick: onRemove, "aria-label": `إزالة ${item.title || "العنصر"} من المجموعة`, title: "إزالة من المجموعة", className: "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-300 hover:bg-red-500/10", children: jsx(Trash2, { className: "h-4 w-4" }) }) : null
    ]
  }, item.id);
}

function CollectionDetails({ collection, items, availableItems, typeLabel, onAddItems, onRemoveItem, onOpenItem, onShare, shareEnabled, onCopyTitles }) {
  const [itemQuery, setItemQuery] = React.useState("");

  React.useEffect(() => {
    setItemQuery("");
  }, [collection?.id]);

  if (!collection) {
    return jsxs("aside", {
      className: "va-card rounded-2xl border border-dashed border-white/10 bg-gray-900/35 p-8 text-center",
      children: [
        jsx(FolderOpen, { className: "mx-auto h-12 w-12 text-gray-600" }),
        jsx("h2", { className: "mt-3 text-lg font-bold text-white", children: "اختر مجموعة" }),
        jsx("p", { className: "mt-2 text-sm text-gray-500", children: "ستظهر معاينة العناصر وإجراءات الإضافة والإزالة هنا." })
      ]
    });
  }

  const canManageItems = collection.type !== "smart";
  const panelAccent = collection.color || "#10b981";
  const normalizedItemQuery = itemQuery.trim().toLowerCase();
  const filteredItems = normalizedItemQuery
    ? items.filter((item) => (item.title || "").toLowerCase().includes(normalizedItemQuery))
    : items;

  return jsxs("aside", {
    className: "va-preview-panel space-y-4 rounded-2xl va-surface-muted border p-4 text-right",
    style: { borderTopColor: `${panelAccent}50` },
    dir: "rtl",
    children: [
      jsxs("div", { className: "flex items-start gap-3", children: [
        jsx("span", {
          className: "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl",
          style: { backgroundColor: `${panelAccent}22`, color: panelAccent, boxShadow: `0 0 0 1px ${panelAccent}30` },
          children: collection.icon || "📁"
        }),
        jsxs("div", { className: "min-w-0 flex-1", children: [
          jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
            jsx("h2", { className: "text-lg font-bold text-white", children: collection.name || "مجموعة" }),
            jsxs("span", { className: "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", style: { borderColor: `${panelAccent}35`, backgroundColor: `${panelAccent}14`, color: panelAccent }, children: [jsx(Video, { className: "h-3 w-3 opacity-70" }), `${formatNumber(items.length)} عنصر`] })
          ] }),
          jsx("p", { className: "mt-1 text-sm text-gray-500", children: collection.description || (collection.type === "smart" ? "مجموعة ذكية تتحدث حسب قواعدها." : "مجموعة يدوية لتنظيم العناصر.") })
        ] }),
        shareEnabled && jsxs("button", {
          type: "button",
          onClick: () => onShare?.(collection),
          className: "inline-flex shrink-0 items-center gap-1.5 rounded-xl border va-accent-border va-accent-bg-soft px-3 py-1.5 text-xs font-semibold va-accent-text-on-soft hover:bg-emerald-500/20",
          title: "إنشاء رابط مشاركة عام للقراءة فقط",
          children: [jsx(Share2, { className: "h-3.5 w-3.5" }), "مشاركة"]
        })
      ] }),
      canManageItems && availableItems.length > 0 && jsx(CollectionAddPicker, {
        availableItems,
        typeLabel,
        onAddItems
      }, `add-${collection.id}`),
      jsxs("div", {
        className: "flex items-center justify-between gap-2",
        children: [
          jsxs("p", { className: "text-sm font-semibold text-gray-300", children: ["العناصر ", jsx("span", { className: "text-gray-500", children: `(${formatNumber(items.length)})` })] }),
          jsxs("div", { className: "flex items-center gap-2", children: [
            items.length > 6 && jsx("input", { value: itemQuery, onChange: (event) => setItemQuery(event.target.value), placeholder: "تصفية...", "aria-label": "تصفية عناصر المجموعة", className: "min-h-8 w-28 va-surface-deep rounded-lg border px-2 text-xs text-white outline-none placeholder:text-gray-600 focus:border-emerald-500/40" }),
            items.length > 0 && jsx("button", { type: "button", onClick: () => onCopyTitles?.(items), "aria-label": "نسخ عناوين العناصر", title: "نسخ عناوين العناصر", className: "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white", children: jsx(Copy, { className: "h-4 w-4" }) })
          ] })
        ]
      }),
      items.length ? (filteredItems.length ? jsx("div", {
        className: "space-y-2",
        children: filteredItems.slice(0, 200).map((item) => jsx(CollectionItemRow, {
          item,
          typeLabel,
          canManageItems,
          onOpen: () => onOpenItem(item),
          onRemove: () => onRemoveItem(item.id)
        }, item.id))
      }) : jsx("p", { className: "rounded-xl border border-dashed border-white/10 bg-gray-950/30 p-4 text-center text-xs text-gray-500", children: "لا عناصر مطابقة للتصفية." })) : jsxs("div", {
        className: "rounded-xl border border-dashed border-white/10 bg-gray-950/30 p-6 text-center",
        children: [
          jsx(Video, { className: "mx-auto h-10 w-10 text-gray-600" }),
          jsx("p", { className: "mt-2 text-sm font-semibold text-gray-300", children: "المجموعة فارغة" }),
          jsx("p", { className: "mt-1 text-xs text-gray-600", children: canManageItems ? "أضف عناصر من القائمة أعلاه." : "ستظهر العناصر عندما تطابق قواعد المجموعة الذكية." })
        ]
      })
    ]
  });
}

// ── SaveFilterModal ───────────────────────────────────────────────────────
// Small inline modal to name and save the current search query as a
// saved filter / smart collection.
function SaveFilterModal({ onSave, onCancel, initialQuery }) {
  const [name, setName] = React.useState("");
  const [isLive, setIsLive] = React.useState(true);
  const nameId = React.useId();
  const isLiveId = React.useId();
  const nameRef = React.useRef(null);
  React.useEffect(() => {
    window.requestAnimationFrame(() => nameRef.current?.focus());
  }, []);
  return jsx(EntityFormModal, {
    title: "حفظ البحث الحالي",
    icon: jsx(BookmarkPlus, { className: "h-4 w-4" }),
    onCancel,
    onSubmit: () => name.trim() && onSave(name.trim(), isLive),
    canSubmit: Boolean(name.trim()),
    submitLabel: "حفظ كمجموعة",
    isEditing: false,
    children: jsxs("div", {
      className: "grid gap-3",
      children: [
        jsxs("div", { className: "space-y-1 text-sm text-gray-300", children: [
          jsx("label", { htmlFor: nameId, className: "block", children: "اسم المجموعة" }),
          jsx("input", {
            id: nameId,
            ref: nameRef,
            value: name,
            onChange: (e) => setName(e.target.value),
            className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none focus:border-emerald-500/40",
            placeholder: "مثال: أرشيف أكتوبر 2026"
          })
        ] }),
        jsxs("label", {
          htmlFor: isLiveId,
          className: "flex items-center gap-3 cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 hover:bg-white/8 transition-colors",
          children: [
            jsx("input", {
              id: isLiveId,
              type: "checkbox",
              checked: isLive,
              onChange: (e) => setIsLive(e.target.checked),
              className: "h-4 w-4 accent-cyan-400"
            }),
            jsxs("span", { className: "flex-1 text-sm", children: [
              jsx("span", { className: "font-medium text-white", children: "مجموعة ذكية (حية)" }),
              jsx("span", { className: "block text-xs text-gray-500 mt-0.5", children: "يُعاد تشغيل الاستعلام تلقائياً في كل زيارة" })
            ] }),
            jsx(Zap, { className: "h-4 w-4 text-cyan-400 shrink-0" })
          ]
        }),
        initialQuery && jsx("p", {
          className: "rounded-lg border border-white/10 bg-gray-950/40 px-3 py-2 text-xs text-gray-500 font-mono truncate",
          title: JSON.stringify(initialQuery),
          children: `استعلام: "${typeof initialQuery === "string" ? initialQuery : JSON.stringify(initialQuery)}"`
        })
      ]
    })
  });
}

export function CollectionsPage() {
  const {
    virtualCollections = [],
    videoItems = [],
    contentTypes = [],
    settings = {},
    addVirtualCollection,
    updateVirtualCollection,
    deleteVirtualCollection,
    addItemsToCollection,
    removeItemsFromCollection,
    setCurrentPage,
    setSelectedItemId,
    showToast,
    showNotification
  } = useAppStore();

  const [query, setQuery] = React.useState("");
  const [selectedCollectionId, setSelectedCollectionId] = React.useState(virtualCollections[0]?.id || null);
  const [editingCollection, setEditingCollection] = React.useState(null);
  const [showForm, setShowForm] = React.useState(false);

  // ── Smart Collections / Saved Filters state ──────────────────────────────
  const [savedFilters, setSavedFilters] = React.useState([]);
  const [loadingFilters, setLoadingFilters] = React.useState(false);
  const [showSaveFilterModal, setShowSaveFilterModal] = React.useState(false);

  const fetchSavedFilters = React.useCallback(async () => {
    setLoadingFilters(true);
    try {
      const res = await fetch("/api/saved-filters", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSavedFilters(data.filters || []);
      }
    } catch {
      // Non-critical — silently skip if backend doesn't support it
    } finally {
      setLoadingFilters(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSavedFilters();
  }, [fetchSavedFilters]);

  const handleSaveFilter = async (name, isLive) => {
    try {
      const res = await fetch("/api/saved-filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, query: query || {}, isLive }),
      });
      if (res.ok) {
        setShowSaveFilterModal(false);
        await fetchSavedFilters();
        showToast?.(`تم حفظ المجموعة الذكية: ${name}`, "success");
      } else {
        const err = await res.json().catch(() => ({}));
        showToast?.(err.error || "تعذّر حفظ المجموعة", "error");
      }
    } catch {
      showToast?.("تعذّر حفظ المجموعة", "error");
    }
  };

  const handleDeleteSavedFilter = async (id) => {
    try {
      const res = await fetch(`/api/saved-filters/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setSavedFilters((prev) => prev.filter((f) => f.id !== id));
        showToast?.("تم حذف المجموعة الذكية", "info");
      }
    } catch {
      showToast?.("تعذّر حذف المجموعة", "error");
    }
  };

  const handleOpenSavedFilter = (filter) => {
    // Navigate to the archive/search view using the saved query.
    // The query is stored as a string or object — we set the collections
    // search field if it's a plain string, otherwise serialize it.
    const queryStr = typeof filter.query === "string"
      ? filter.query
      : (filter.query?.text || filter.query?.q || "");
    setQuery(queryStr);
    showToast?.(`تم تطبيق مجموعة: ${filter.name}`, "info");
  };

  const typeById = React.useMemo(() => new Map(contentTypes.map((type) => [type.id, type])), [contentTypes]);
  const typeLabel = React.useCallback((item) => typeById.get(item?.type)?.name || "", [typeById]);

  const filteredCollections = React.useMemo(() => getFilteredCollections(virtualCollections, query), [query, virtualCollections]);
  const selectedCollection = virtualCollections.find((collection) => collection.id === selectedCollectionId) || filteredCollections[0] || null;
  const selectedItems = React.useMemo(() => resolveCollectionItems(selectedCollection, videoItems), [selectedCollection, videoItems]);
  const availableItems = React.useMemo(() => getAvailableCollectionItems(selectedCollection, videoItems), [selectedCollection, videoItems]);
  const summary = React.useMemo(() => getCollectionSummary(virtualCollections, videoItems), [videoItems, virtualCollections]);

  React.useEffect(() => {
    if (selectedCollectionId && virtualCollections.some((collection) => collection.id === selectedCollectionId)) return;
    setSelectedCollectionId(filteredCollections[0]?.id || null);
  }, [filteredCollections, selectedCollectionId, virtualCollections]);

  const startCreate = () => {
    setEditingCollection(null);
    setShowForm(true);
  };

  const saveCollection = async (draft, opts = {}) => {
    try {
      if (editingCollection) {
        const updated = createVirtualCollectionValue({ ...editingCollection, ...draft, createdAt: editingCollection.createdAt });
        await updateVirtualCollection?.(updated);
        setSelectedCollectionId(updated.id);
      } else {
        const created = createVirtualCollectionValue(draft);
        await addVirtualCollection?.(created);
        setSelectedCollectionId(created.id);
      }
      if (!opts.keepOpen) {
        setShowForm(false);
        setEditingCollection(null);
      }
      return true;
    } catch (error) {
      reportError(showNotification, error, {
        context: "حفظ المجموعة",
        recovery: { run: () => saveCollection(draft, opts) }
      });
      return false;
    }
  };

  const deleteCollection = async (collection) => {
    const confirmed = await appConfirm(`هل تريد حذف المجموعة "${collection.name}"؟ لن يتم حذف عناصر الفيديو نفسها.`, {
      title: "حذف مجموعة",
      kind: "danger",
      confirmLabel: "حذف"
    });
    if (!confirmed) return;
    try {
      await deleteVirtualCollection?.(collection.id);
      if (selectedCollectionId === collection.id) setSelectedCollectionId(null);
    } catch (error) {
      reportError(showNotification, error, {
        context: "حذف المجموعة",
        recovery: { run: () => deleteCollection(collection) }
      });
    }
  };

  const openItem = (item) => {
    setSelectedItemId?.(item.id);
    setCurrentPage?.("detail");
  };

  const copyTitles = async (list = []) => {
    const text = list.map((item) => item.title || "بدون عنوان").join("\n");
    if (!text) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        showToast?.(`تم نسخ ${formatNumber(list.length)} عنوان`, "success");
      } else {
        showToast?.("النسخ غير مدعوم في هذا المتصفح", "error");
      }
    } catch {
      showToast?.("تعذّر نسخ العناوين", "error");
    }
  };

  const shareEnabled = React.useMemo(() => canShare({ backend: resolveBackendChoice().backend, token: getCloudToken() }), []);
  const shareCollection = async (collection) => {
    try {
      const { url } = await mintShareLink({
        scope: { type: "collection", ids: [collection.id], label: collection.name },
        title: collection.name ? `مراجعة: ${collection.name}` : "مراجعة أرشيف مشتركة",
        expiresInDays: settings.sharing?.defaultExpiryDays || 30,
        baseUrl: getBackendUrl(),
        getToken: getCloudToken
      });
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url).catch(() => {});
        showNotification?.("تم إنشاء رابط المشاركة ونسخه.", { type: "success", category: "share", title: "رابط مشاركة جديد", targetLabel: collection.name || "مجموعة" });
      } else {
        showNotification?.(`رابط المشاركة: ${url}`, { type: "success", category: "share", title: "رابط مشاركة جديد", targetLabel: collection.name || "مجموعة" });
      }
    } catch (error) {
      showNotification?.(error?.message || "تعذّر إنشاء رابط المشاركة", { type: "error", category: "share", title: "فشل إنشاء المشاركة", targetLabel: collection.name || "مجموعة" });
    }
  };

  return jsxs(motion.div, {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.2 },
    className: "va-page-shell space-y-6 p-4 sm:p-6",
    dir: "rtl",
    children: [
      jsx(PageHero, {
        icon: jsx(FolderOpen, { className: "h-6 w-6 va-accent-text" }),
        title: "المجموعات",
        description: "تنظيم يدوي وذكي للعناصر مع معاينة مباشرة وإدارة سريعة للمحتوى داخل كل مجموعة.",
        actions: jsxs("div", { className: "flex items-center gap-2", children: [
          jsxs("button", {
            type: "button",
            onClick: () => setShowSaveFilterModal(true),
            className: "inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/20 transition-colors",
            title: "حفظ البحث الحالي كمجموعة ذكية",
            children: [jsx(BookmarkPlus, { className: "h-4 w-4" }), "حفظ البحث"]
          }),
          jsxs("button", { type: "button", onClick: startCreate, className: "va-primary-button inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white", children: [jsx(Plus, { className: "h-4 w-4" }), "مجموعة جديدة"] })
        ] })
      }),
      showSaveFilterModal && jsx(SaveFilterModal, {
        initialQuery: query || null,
        onCancel: () => setShowSaveFilterModal(false),
        onSave: handleSaveFilter,
      }),
      showForm && jsx(CollectionForm, {
        collection: editingCollection,
        onCancel: () => {
          setShowForm(false);
          setEditingCollection(null);
        },
        onSave: saveCollection
      }),
      virtualCollections.length > 0 && jsx("section", {
        className: "grid gap-3 sm:grid-cols-4",
        children: [
          ["كل المجموعات", summary.total, FolderOpen],
          ["يدوية", summary.manual, FolderOpen],
          ["ذكية", summary.smart, Sparkles],
          ["عناصر مرتبطة", summary.linkedItems, Video]
        ].map(([label, value, Icon]) => jsxs("div", { className: "va-metric-card rounded-2xl va-surface-muted border p-4 text-right", children: [
          jsxs("div", { className: "flex items-center justify-between gap-3", children: [
            jsx("span", { className: "text-sm text-gray-500", children: label }),
            jsx(Icon, { className: "h-5 w-5 va-accent-text" })
          ] }),
          jsx("p", { className: "mt-2 text-2xl font-bold text-white", children: formatNumber(value, settings.numberSystem) })
        ] }, label))
      }),
      virtualCollections.length === 0 ? jsx("div", {
        className: "va-card rounded-2xl border border-dashed border-white/10 bg-gray-900/35",
        children: jsx(EmptyState, {
          icon: jsx(FolderOpen, { className: "h-16 w-16" }),
          title: "ابدأ تنظيم الأرشيف",
          description: "أنشئ مجموعة يدوية لتجميع الفيديوهات المهمة، أو مجموعة ذكية تتحدّث تلقائياً حسب قواعد البحث.",
          actionLabel: "إنشاء مجموعة",
          onAction: startCreate,
          hintItems: ["مجموعات يدوية", "مجموعات ذكية", "ألوان مخصصة"]
        })
      }) : jsxs("section", { className: "grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]", children: [
        jsxs("div", { className: "space-y-4", children: [
          jsxs("label", { className: "va-filter-surface relative block rounded-2xl va-surface-muted border p-3", children: [
            jsx(Search, { className: "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" }),
            jsx("input", { value: query, onChange: (event) => setQuery(event.target.value), placeholder: "بحث في المجموعات...", className: "min-h-11 w-full va-surface-deep rounded-xl border py-2 pl-3 pr-10 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-emerald-500/40" })
          ] }),
          filteredCollections.length ? jsx("div", { className: "grid gap-3 lg:grid-cols-2", children: filteredCollections.map((collection, index) => jsx(CollectionCard, {
            collection,
            index,
            itemCount: resolveCollectionItems(collection, videoItems).length,
            active: selectedCollection?.id === collection.id,
            onOpen: () => setSelectedCollectionId(collection.id),
            onEdit: () => {
              setEditingCollection(collection);
              setShowForm(true);
            },
            onDelete: () => deleteCollection(collection)
          }, collection.id)) }) : jsx("div", { className: "va-card rounded-2xl border border-dashed border-white/10 bg-gray-900/35", children: jsx(EmptyState, {
            icon: jsx(FolderOpen, { className: "h-16 w-16" }),
            title: virtualCollections.length ? "لا توجد مجموعات مطابقة" : "ابدأ تنظيم الأرشيف",
            description: virtualCollections.length ? "امسح البحث أو استخدم كلمة أبسط." : "أنشئ مجموعة يدوية لتجميع الفيديوهات المهمة.",
            actionLabel: virtualCollections.length ? "مسح البحث" : "إنشاء مجموعة",
            onAction: virtualCollections.length ? () => setQuery("") : startCreate,
            actionIcon: virtualCollections.length ? RefreshCw : undefined,
            hintItems: virtualCollections.length ? [] : ["مجموعات يدوية", "مجموعات ذكية", "ألوان مخصصة"]
          }) })
        ] }),
        jsx(CollectionDetails, {
          collection: selectedCollection,
          items: selectedItems,
          availableItems,
          typeLabel,
          onCopyTitles: copyTitles,
          onAddItems: async (ids) => {
            await addItemsToCollection?.(selectedCollection.id, ids);
            showToast?.("تمت إضافة العناصر للمجموعة", "success");
          },
          onRemoveItem: async (id) => {
            await removeItemsFromCollection?.(selectedCollection.id, [id]);
            showToast?.("تمت إزالة العنصر من المجموعة", "info");
          },
          onOpenItem: openItem,
          onShare: shareCollection,
          shareEnabled
        })
      ] }),
      // ── Smart Collections (Saved Filters) section ─────────────────────────
      jsxs("section", {
        className: "space-y-3",
        children: [
          jsxs("div", { className: "flex items-center justify-between gap-3", children: [
            jsxs("div", { className: "flex items-center gap-2", children: [
              jsx(Zap, { className: "h-4 w-4 text-cyan-400" }),
              jsx("h2", { className: "text-base font-bold text-white", children: "المجموعات الذكية المحفوظة" }),
              savedFilters.length > 0 && jsx("span", {
                className: "rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[10px] font-medium text-cyan-300",
                children: formatNumber(savedFilters.length)
              })
            ] }),
            jsxs("button", {
              type: "button",
              onClick: () => setShowSaveFilterModal(true),
              className: "inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/15 transition-colors",
              children: [jsx(Plus, { className: "h-3 w-3" }), "حفظ البحث الحالي"]
            })
          ] }),
          loadingFilters ? jsx("p", { className: "text-xs text-gray-500 py-2", children: "جارٍ التحميل..." }) :
          savedFilters.length === 0 ? jsxs("div", {
            className: "rounded-xl border border-dashed border-cyan-500/20 bg-cyan-500/5 px-4 py-6 text-center",
            children: [
              jsx(Zap, { className: "mx-auto h-8 w-8 text-cyan-500/40 mb-2" }),
              jsx("p", { className: "text-sm font-semibold text-gray-400", children: "لا توجد مجموعات ذكية بعد" }),
              jsx("p", { className: "text-xs text-gray-600 mt-1", children: "احفظ بحثاً لإنشاء مجموعة ذكية تتحدّث تلقائياً." })
            ]
          }) :
          jsx("div", {
            className: "grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
            children: savedFilters.map((filter) => jsx(SavedFilterCard, {
              filter,
              onDelete: handleDeleteSavedFilter,
              onOpen: handleOpenSavedFilter,
            }, filter.id))
          })
        ]
      })
    ]
  });
}

CollectionsPage.pageId = "collections";
CollectionsPage.migrationStatus = "native";

export default CollectionsPage;
