import { Star } from "lucide-react";
import * as React from "react";
import { jsx } from "react/jsx-runtime";
import { useAppStore } from "../../stores/appStore.js";
import { FAVORITE_ENTITY_TYPES } from "../../stores/slices/favoritesSlice.js";

export function FavoriteButton({ entityType = FAVORITE_ENTITY_TYPES.ITEM, entityId, label = "", className = "", size = "md" }) {
  const { addFavorite, removeFavorite, isFavorite } = useAppStore();
  const active = isFavorite(entityType, entityId);

  const sizeClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  async function handleToggle(e) {
    e.stopPropagation();
    if (active) {
      await removeFavorite({ entityType, entityId });
    } else {
      await addFavorite({ entityType, entityId, label });
    }
  }

  return jsx("button", {
    type: "button",
    onClick: handleToggle,
    title: active ? "إزالة من المفضلة" : "إضافة إلى المفضلة",
    "aria-label": active ? "إزالة من المفضلة" : "إضافة إلى المفضلة",
    "aria-pressed": active,
    className: `inline-flex items-center justify-center rounded transition-colors ${
      active
        ? "text-yellow-400 hover:text-yellow-300"
        : "text-gray-500 hover:text-yellow-400"
    } ${className}`,
    children: jsx(Star, {
      className: sizeClass,
      fill: active ? "currentColor" : "none"
    })
  });
}
