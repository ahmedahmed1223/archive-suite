import * as React from "react";
import { ChevronLeft, Home } from "lucide-react";

import { getFolderBreadcrumb } from "../../features/folders/viewModel.js";

/**
 * FolderBreadcrumb — clickable ancestor trail for the active folder.
 *
 * Props:
 *   folderId     — string|null, the currently active folder
 *   foldersById  — object keyed by folder id (use the enriched `byId` from buildFolderTree)
 *   onNavigate   — (id|null) => void, called when an ancestor crumb is clicked
 */
export function FolderBreadcrumb({ folderId, foldersById = {}, onNavigate }) {
  const trail = getFolderBreadcrumb(folderId, foldersById);

  return (
    <nav aria-label="مسار المجلد" className="flex items-center text-sm text-gray-400 min-w-0">
      <ol className="flex items-center gap-1 min-w-0">
        <li className="shrink-0">
          <button
            type="button"
            onClick={() => onNavigate?.(null)}
            className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-white/5 hover:text-white transition-colors"
            aria-label="الجذر"
          >
            <Home className="w-3.5 h-3.5" aria-hidden="true" />
            <span>الجذر</span>
          </button>
        </li>
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1;
          return (
            <li key={crumb.id} className="flex items-center gap-1 min-w-0">
              <ChevronLeft className="w-3.5 h-3.5 shrink-0 text-gray-600" aria-hidden="true" />
              {isLast ? (
                <span className="px-1.5 py-1 font-medium text-white truncate" aria-current="page">
                  {crumb.name}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate?.(crumb.id)}
                  className="px-1.5 py-1 rounded hover:bg-white/5 hover:text-white transition-colors truncate"
                >
                  {crumb.name}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default FolderBreadcrumb;
