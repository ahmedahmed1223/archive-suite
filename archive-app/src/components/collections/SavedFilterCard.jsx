import * as React from "react";
import { Zap, Trash2, FolderOpen } from "lucide-react";

/**
 * SavedFilterCard — renders one saved filter / smart collection entry.
 *
 * Props:
 *   filter  — { id, name, query, isLive, createdAt, updatedAt }
 *   onDelete(id)     — called when the trash button is clicked
 *   onOpen(filter)   — called when the card body is clicked/activated
 */
export function SavedFilterCard({ filter, onDelete, onOpen }) {
  return (
    <div
      className="card card-border group relative flex flex-col gap-2 p-4 rounded-xl border border-white/10 bg-gray-900/45 hover:bg-gray-900/70 hover:border-white/20 transition-colors cursor-pointer"
      onClick={() => onOpen(filter)}
      role="button"
      tabIndex={0}
      aria-label={`فتح المجموعة: ${filter.name}`}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen(filter)}
    >
      <div className="flex items-center gap-2">
        {filter.isLive ? (
          <Zap className="w-4 h-4 text-cyan-400 shrink-0" aria-label="مجموعة ذكية حية" />
        ) : (
          <FolderOpen className="w-4 h-4 text-gray-400 shrink-0" />
        )}
        <span className="font-medium text-sm truncate text-white">{filter.name}</span>
        {filter.isLive && (
          <span className="mr-auto text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-medium">
            ذكي
          </span>
        )}
      </div>
      <button
        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-red-400 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(filter.id);
        }}
        aria-label={`حذف ${filter.name}`}
        tabIndex={-1}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default SavedFilterCard;
