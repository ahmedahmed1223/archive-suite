import * as React from "react";
import { FolderPlus, FolderTree as FolderTreeIcon } from "lucide-react";

import { buildFolderTree } from "../../features/folders/viewModel.js";
import { FolderTreeNode } from "./FolderTreeNode.jsx";

/**
 * FolderTree — renders the full folder hierarchy as an accessible tree.
 *
 * Props:
 *   folders          — flat array of folder value objects
 *   selectedFolderId — string|null
 *   onSelect         — (id) => void
 *   onToggle         — (id) => void, expand/collapse a node
 *   onCreateFolder   — () => void, triggered by the "مجلد جديد" button
 *   onMoveFolder     — (id, newParentId) => void (reserved for drag/drop hosts)
 *   onContextMenu    — (id, event) => void
 */
export function FolderTree({
  folders = [],
  selectedFolderId = null,
  onSelect,
  onToggle,
  onCreateFolder,
  onMoveFolder,
  onContextMenu,
  onDropItems,
  title = "مجلدات الأرشيف",
  emptyDescription = "أنشئ أول مجلد لتنظيم عناصر الأرشيف في شجرة.",
  countEntityType = "archive-item"
}) {
  const tree = React.useMemo(() => buildFolderTree(folders), [folders]);
  const hasFolders = tree.roots.length > 0;

  return (
    <div className="flex flex-col gap-2" data-move-handler={onMoveFolder ? "enabled" : undefined}>
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
          <FolderTreeIcon className="w-3.5 h-3.5" aria-hidden="true" />
          {title}
        </h2>
        <button
          type="button"
          onClick={() => onCreateFolder?.()}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
        >
          <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
          مجلد جديد
        </button>
      </div>

      {hasFolders ? (
        <ul role="tree" aria-label={title} className="flex flex-col gap-0.5">
          {tree.roots.map((root) => (
            <FolderTreeNode
              key={root.id}
              folder={root}
              tree={tree}
              depth={0}
              selectedId={selectedFolderId}
              onSelect={onSelect}
              onToggle={onToggle}
              onContextMenu={onContextMenu}
              onDrop={onDropItems}
              countEntityType={countEntityType}
            />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 py-8 px-3 text-center rounded-xl border border-dashed border-white/10">
          <FolderTreeIcon className="w-8 h-8 text-gray-600" aria-hidden="true" />
          <p className="text-sm text-gray-400">لا توجد مجلدات بعد</p>
          <p className="text-xs text-gray-500">{emptyDescription}</p>
          <button
            type="button"
            onClick={() => onCreateFolder?.()}
            className="mt-1 flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/15 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
            إنشاء مجلد
          </button>
        </div>
      )}
    </div>
  );
}

export default FolderTree;
