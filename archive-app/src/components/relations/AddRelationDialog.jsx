import * as React from "react";
import { Link2, Search, X } from "lucide-react";

import {
  RELATION_TYPES,
  createRelation,
  getRelationLabel
} from "../../features/relations/viewModel.js";

const RELATION_OPTIONS = Object.values(RELATION_TYPES);

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function getItemTitle(item) {
  return item?.title || item?.name || item?.id || "بدون عنوان";
}

/**
 * Dialog to create an explicit relation from a source item to a target item.
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {object} props.sourceItem
 * @param {object[]} props.allItems
 * @param {object[]} props.existingRelations  outgoing relations of the source
 * @param {(relation: object) => void} props.onAdd
 * @param {() => void} props.onClose
 */
export function AddRelationDialog({
  isOpen,
  sourceItem,
  initialTargetId = "",
  allItems = [],
  existingRelations = [],
  onAdd,
  onClose
}) {
  const [query, setQuery] = React.useState("");
  const [targetId, setTargetId] = React.useState("");
  const [type, setType] = React.useState(RELATION_TYPES.RELATED_TO.key);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (isOpen) {
      setQuery("");
      setTargetId(initialTargetId || "");
      setType(RELATION_TYPES.RELATED_TO.key);
      setNote("");
      setError("");
    }
  }, [isOpen, sourceItem?.id, initialTargetId]);

  React.useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const existingTargetIds = React.useMemo(
    () => new Set(existingRelations.map((relation) => relation.targetId)),
    [existingRelations]
  );

  const candidates = React.useMemo(() => {
    const normalizedQuery = normalize(query);
    return allItems
      .filter((item) => item && item.id !== sourceItem?.id && !item.isDeleted)
      .filter((item) => {
        if (!normalizedQuery) return true;
        return normalize(getItemTitle(item)).includes(normalizedQuery);
      })
      .slice(0, 50);
  }, [allItems, query, sourceItem?.id]);

  if (!isOpen) return null;

  const selectedTarget = allItems.find((item) => item.id === targetId) || null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!targetId) {
      setError("اختر عنصرًا للربط");
      return;
    }
    if (targetId === sourceItem?.id) {
      setError("لا يمكن ربط العنصر بنفسه");
      return;
    }
    const duplicate = existingRelations.some(
      (relation) => relation.targetId === targetId && relation.type === type
    );
    if (duplicate) {
      setError("هذه العلاقة موجودة بالفعل");
      return;
    }
    const bidirectional = Boolean(RELATION_OPTIONS.find((opt) => opt.key === type)?.bidirectional);
    const relation = createRelation({ sourceId: sourceItem?.id, targetId, type, note });
    onAdd?.({ ...relation, bidirectional });
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="إضافة علاقة"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-gray-900 text-white shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Link2 className="h-5 w-5 va-accent-text" aria-hidden="true" />
            <span>إضافة علاقة</span>
          </h2>
          <button
            type="button"
            onClick={() => onClose?.()}
            aria-label="إغلاق"
            className="rounded-lg border border-white/10 p-1.5 text-gray-300 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {sourceItem ? (
            <p className="text-xs text-gray-400">
              ربط من: <span className="font-medium text-gray-200">{getItemTitle(sourceItem)}</span>
            </p>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-gray-300">نوع العلاقة</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="select select-bordered min-h-11 w-full rounded-xl border border-white/10 bg-gray-800/70 px-3 text-sm text-white outline-none transition focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10"
            >
              {RELATION_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-gray-300">العنصر المرتبط</span>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ابحث عن عنصر..."
                aria-label="ابحث عن عنصر للربط"
                className="input input-bordered min-h-11 w-full rounded-xl border border-white/10 bg-gray-800/70 pr-10 pl-3 text-sm text-white outline-none transition focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10"
              />
            </div>
            <ul
              role="listbox"
              aria-label="نتائج البحث"
              className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-gray-800/40 p-1"
            >
              {candidates.length === 0 ? (
                <li className="px-3 py-4 text-center text-sm text-gray-500">لا توجد عناصر مطابقة</li>
              ) : (
                candidates.map((item) => {
                  const isSelected = item.id === targetId;
                  const alreadyLinked = existingTargetIds.has(item.id);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setTargetId(item.id);
                          setError("");
                        }}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-right text-sm transition ${
                          isSelected
                            ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/40"
                            : "text-gray-200 hover:bg-white/5"
                        }`}
                      >
                        <span className="truncate">{getItemTitle(item)}</span>
                        {alreadyLinked ? (
                          <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-400">مرتبط</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          {selectedTarget ? (
            <p className="text-xs text-gray-400">
              {getRelationLabel(type, true)}: <span className="font-medium text-gray-200">{getItemTitle(selectedTarget)}</span>
            </p>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-gray-300">ملاحظة (اختياري)</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="أضف ملاحظة توضيحية..."
              className="input input-bordered min-h-11 w-full rounded-xl border border-white/10 bg-gray-800/70 px-3 text-sm text-white outline-none transition focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10"
            />
          </label>

          {error ? (
            <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-white/10 p-4">
          <button
            type="button"
            onClick={() => onClose?.()}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-300 transition hover:bg-white/5"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={!targetId}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            إضافة علاقة
          </button>
        </footer>
      </form>
    </div>
  );
}

AddRelationDialog.displayName = "AddRelationDialog";

export default AddRelationDialog;
