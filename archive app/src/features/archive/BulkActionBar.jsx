import { Check, CheckSquare, FolderInput, Square, Tag as TagIcon, Trash2, Wand2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import * as React from "react";
import { createPortal } from "react-dom";

import { appPrompt } from "../../components/common/ConfirmDialog.js";

export function BulkActionBar({
  selectedCount,
  totalVisible,
  allSelected,
  onSelectAll,
  onClear,
  onDelete,
  onRestore,
  onAddTags,
  onMoveToCollection,
  onMediaTranscode,
  onExport,
  collections = [],
  showRestore = false,
  busy = false
}) {
  const prefersReducedMotion = useReducedMotion();
  const [openMenu, setOpenMenu] = React.useState(null); // "tags" | "collection" | null

  const closeMenu = React.useCallback(() => setOpenMenu(null), []);

  React.useEffect(() => {
    if (!openMenu) return undefined;
    const handler = (event) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeMenu, openMenu]);

  const handleTagsClick = async () => {
    const raw = await appPrompt("اكتب الوسوم مفصولة بفواصل (مثال: محاضرة، أرشيف، عربي)", {
      title: "إضافة وسوم للعناصر المحددة",
      confirmLabel: "إضافة"
    });
    if (raw === null) return;
    const tags = String(raw).split(/[،,]+/).map((value) => value.trim()).filter(Boolean);
    if (!tags.length) return;
    onAddTags?.(tags);
  };

  const handleCollectionClick = () => {
    if (!collections.length) {
      onMoveToCollection?.(null);
      return;
    }
    setOpenMenu((current) => (current === "collection" ? null : "collection"));
  };

  return createPortal(
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          key="bulk-action-bar"
          initial={{ y: prefersReducedMotion ? 0 : 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: prefersReducedMotion ? 0 : 30, opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          dir="rtl"
          className="fixed bottom-4 left-1/2 z-[9960] flex w-[min(96vw,720px)] -translate-x-1/2 flex-col gap-2 rounded-2xl border border-white/10 bg-[var(--color-bg-surface,#0b1626)]/95 p-3 text-white shadow-2xl shadow-black/35 backdrop-blur"
          role="region"
          aria-label="إجراءات جماعية"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-[color-mix(in_srgb,var(--va-action)_38%,transparent)] bg-[color-mix(in_srgb,var(--va-action)_20%,transparent)] px-3 py-1 text-xs font-semibold">
                {selectedCount} محدد
              </span>
              <button
                type="button"
                onClick={allSelected ? onClear : onSelectAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-gray-300 hover:bg-white/5 hover:text-white"
              >
                {allSelected ? <Square className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />}
                {allSelected ? "إلغاء الكل" : `تحديد كل (${totalVisible})`}
              </button>
            </div>
            <button
              type="button"
              onClick={onClear}
              aria-label="إغلاق وضع التحديد"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTagsClick}
              disabled={busy}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-white/[0.08] disabled:opacity-50"
            >
              <TagIcon className="h-3.5 w-3.5" /> إضافة وسم
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={handleCollectionClick}
                disabled={busy || !collections.length}
                title={!collections.length ? "أنشئ مجموعة أولاً" : undefined}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FolderInput className="h-3.5 w-3.5" /> نقل لمجموعة
              </button>
              {openMenu === "collection" && (
                <div
                  role="menu"
                  className="absolute bottom-full right-0 mb-2 max-h-64 w-64 overflow-auto rounded-xl border border-white/10 bg-[var(--color-bg-surface,#0b1626)] p-1 shadow-xl"
                >
                  {collections.map((collection) => (
                    <button
                      key={collection.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onMoveToCollection?.(collection.id);
                        closeMenu();
                      }}
                      className="block w-full truncate rounded-lg px-3 py-2 text-right text-xs text-gray-200 hover:bg-white/[0.06]"
                    >
                      {collection.icon || ""} {collection.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {typeof onExport === "function" && (
              <button
                type="button"
                onClick={onExport}
                disabled={busy}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-white/[0.08] disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> تصدير المحدد
              </button>
            )}
            {typeof onMediaTranscode === "function" && (
              <button
                type="button"
                onClick={onMediaTranscode}
                disabled={busy}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-white/[0.08] disabled:opacity-50"
              >
                <Wand2 className="h-3.5 w-3.5" /> تجهيز ffmpeg
              </button>
            )}
            <span className="mx-1 h-5 w-px bg-white/10" aria-hidden="true" />
            {showRestore && (
              <button
                type="button"
                onClick={onRestore}
                disabled={busy}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/15 disabled:opacity-50"
              >
                استعادة المحدد
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/15 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> {showRestore ? "حذف نهائي" : "حذف"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default BulkActionBar;
