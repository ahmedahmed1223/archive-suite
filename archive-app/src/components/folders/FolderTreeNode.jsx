import * as React from "react";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { DropZone } from "../dnd/DropZone.jsx";

const INDENT_PX = 16;

/**
 * FolderTreeNode — a single row in the folder tree, recursively rendering its
 * children when expanded.
 *
 * Props:
 *   folder        — folder value object (enriched from buildFolderTree.byId)
 *   tree          — { byId, childrenByParent } index from buildFolderTree
 *   depth         — number, nesting level (0 for roots)
 *   selectedId    — string|null, the currently selected folder id
 *   onSelect      — (id) => void
 *   onToggle      — (id) => void
 *   onContextMenu — (id, event) => void
 */
export function FolderTreeNode({ folder, tree, depth = 0, selectedId, onSelect, onToggle, onContextMenu, onDrop }) {
  const children = tree?.childrenByParent?.[folder.id] || [];
  const hasChildren = children.length > 0;
  const isExpanded = folder.isExpanded !== false;
  const isSelected = selectedId === folder.id;
  const itemCount = (folder.itemIds || []).length;

  const handleToggle = (event) => {
    event.stopPropagation();
    if (hasChildren) onToggle?.(folder.id);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect?.(folder.id);
    } else if (event.key === "ArrowLeft" && hasChildren && isExpanded) {
      onToggle?.(folder.id);
    } else if (event.key === "ArrowRight" && hasChildren && !isExpanded) {
      onToggle?.(folder.id);
    }
  };

  return (
    <li role="none">
      <DropZone
        as="div"
        onDrop={onDrop ? (ids) => onDrop(folder.id, ids) : undefined}
        disabled={!onDrop}
        label={`إفلات على مجلد ${folder.name || ""}`}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-level={depth + 1}
        aria-selected={isSelected}
        tabIndex={isSelected ? 0 : -1}
        onClick={() => onSelect?.(folder.id)}
        onKeyDown={handleKeyDown}
        onContextMenu={(event) => {
          event.preventDefault();
          onContextMenu?.(folder.id, event);
        }}
        style={{ paddingInlineStart: `${depth * INDENT_PX + 8}px` }}
        className={`group relative flex items-center gap-1.5 pe-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
          isSelected ? "bg-white/10 text-white" : "text-gray-300 hover:bg-white/5 hover:text-white"
        }`}
      >
        <button
          type="button"
          onClick={handleToggle}
          tabIndex={-1}
          aria-hidden={!hasChildren}
          className={`shrink-0 grid place-items-center w-5 h-5 rounded ${hasChildren ? "hover:bg-white/10" : "invisible"}`}
          aria-label={isExpanded ? "طي" : "توسيع"}
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </button>

        <span
          className="shrink-0 w-2.5 h-2.5 rounded-full ring-1 ring-white/10"
          style={{ backgroundColor: folder.color || "#6b7280" }}
          aria-hidden="true"
        />

        <span className="text-sm truncate flex-1">{folder.name || "بدون اسم"}</span>

        {itemCount > 0 && (
          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-400 tabular-nums">
            {itemCount}
          </span>
        )}
      </DropZone>

      {hasChildren && isExpanded && (
        <ul role="group">
          {children.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              tree={tree}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onToggle={onToggle}
              onContextMenu={onContextMenu}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default FolderTreeNode;
