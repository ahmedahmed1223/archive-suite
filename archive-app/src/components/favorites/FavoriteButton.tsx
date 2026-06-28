import { Star } from "lucide-react";
import * as React from "react";

import { useAppStore } from "../../stores/appStore.js";
import { FAVORITE_ENTITY_TYPES } from "../../stores/slices/favoritesSlice.js";

export interface FavoriteButtonProps {
  entityType?: string;
  entityId: string;
  label?: string;
  className?: string;
  size?: "sm" | "md";
}

export function FavoriteButton({
  entityType = FAVORITE_ENTITY_TYPES.ITEM,
  entityId,
  label = "",
  className = "",
  size = "md"
}: FavoriteButtonProps) {
  const { addFavorite, removeFavorite, isFavorite } = useAppStore();
  const active = isFavorite(entityType, entityId);
  const sizeClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  async function handleToggle(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (active) {
      await removeFavorite({ entityType, entityId });
    } else {
      await addFavorite({ entityType, entityId, label });
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={active ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
      aria-label={active ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
      aria-pressed={active}
      // DaisyUI `btn btn-ghost btn-circle` — icon-button idiom; star tint preserved (§1881 Phase 3)
      className={`btn btn-ghost btn-circle btn-sm transition-colors ${
        active ? "text-yellow-400 hover:text-yellow-300" : "text-gray-500 hover:text-yellow-400"
      } ${className}`}
    >
      <Star className={sizeClass} fill={active ? "currentColor" : "none"} />
    </button>
  );
}
