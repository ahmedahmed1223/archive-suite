import { Bookmark, BookmarkCheck } from "lucide-react";
import * as React from "react";

import { DEFAULT_WATCH_LATER_ID } from "../../stores/slices/readingListsSlice.js";
import { useAppStore } from "../../stores/appStore.js";

export interface WatchLaterButtonProps {
  itemId: string;
  itemTitle?: string;
  className?: string;
  size?: "sm" | "md";
}

export function WatchLaterButton({
  itemId,
  itemTitle = "",
  className = "",
  size = "md"
}: WatchLaterButtonProps) {
  const { addToReadingList, removeFromReadingList, isInReadingList } = useAppStore();
  const active = isInReadingList(DEFAULT_WATCH_LATER_ID, itemId);
  const iconClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  async function handleToggle(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (active) {
      await removeFromReadingList({ listId: DEFAULT_WATCH_LATER_ID, itemId });
    } else {
      await addToReadingList({ listId: DEFAULT_WATCH_LATER_ID, itemId, itemTitle });
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={active ? "إزالة من شاهد لاحقاً" : "إضافة إلى شاهد لاحقاً"}
      aria-label={active ? "إزالة من شاهد لاحقاً" : "إضافة إلى شاهد لاحقاً"}
      aria-pressed={active}
      // DaisyUI `btn btn-ghost btn-circle` — icon-button idiom; bookmark tint preserved (§1881 Phase 3)
      className={`btn btn-ghost btn-circle btn-sm transition-colors ${
        active ? "text-blue-400 hover:text-blue-300" : "text-gray-500 hover:text-blue-400"
      } ${className}`}
    >
      {active ? <BookmarkCheck className={iconClass} /> : <Bookmark className={iconClass} />}
    </button>
  );
}
